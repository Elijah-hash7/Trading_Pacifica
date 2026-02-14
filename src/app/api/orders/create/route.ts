import { pacifica } from "@/lib/pacifica";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signOrderWithAgent } from "@/lib/pacificaAgent";

function isSolanaAddress(addr: string) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
        promise
            .then((v) => {
                clearTimeout(t);
                resolve(v);
            })
            .catch((e) => {
                clearTimeout(t);
                reject(e);
            });
    });
}

type PacificaOrderResponse = {
    success?: boolean;
    data?: {
        order_id?: string;
        entry_price?: number;
    };
    error?: string;
    details?: string;
};

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const {
            account,
            timeStamp,
            symbol,
            amount,
            side,
            type = "market",
            tick_level,
        } = body;

        if (!account || !symbol || !amount || !side) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Solana address validation
        if (typeof account !== "string" || !isSolanaAddress(account)) {
            return NextResponse.json({ error: "Invalid Solana account address" }, { status: 400 });
        }

        const tradeSize = Number.parseFloat(amount);
        if (!Number.isFinite(tradeSize) || tradeSize <= 0) {
            return NextResponse.json({ error: "Invalid trade size" }, { status: 400 });
        }
        const normalizedTimeStamp =
            typeof timeStamp === "string" && timeStamp.length > 0
                ? timeStamp
                : new Date().toISOString();

        const requestedLeverage = Number.parseFloat(String(body.leverage ?? 1));
        const leverage = Number.isFinite(requestedLeverage) && requestedLeverage > 0
            ? requestedLeverage
            : 1;
        const requiredMargin = tradeSize / leverage;

        if (type === "market") {
            const accountResponse = await withTimeout(
                pacifica.getAccountState(account),
                10000,
                "Pacifica account state"
            );
            const accountData =
                accountResponse?.data && typeof accountResponse.data === "object"
                    ? accountResponse.data
                    : accountResponse;
            const availableToSpend = Number(accountData?.available_to_spend ?? 0);
            const balance = Number(accountData?.balance ?? 0);
            const accountEquity = Number(accountData?.account_equity ?? 0);
            const totalMarginUsed = Number(accountData?.total_margin_used ?? 0);

            if (!Number.isFinite(availableToSpend)) {
                return NextResponse.json(
                    {
                        error: "Unable to read Pacifica account state",
                        code: "ACCOUNT_STATE_UNAVAILABLE",
                    },
                    { status: 502 }
                );
            }

            if (availableToSpend < requiredMargin) {
                return NextResponse.json(
                    {
                        error: "Insufficient margin. Deposit collateral in Pacifica.",
                        code: "INSUFFICIENT_MARGIN",
                        details: {
                            available_to_spend: availableToSpend,
                            required_margin: requiredMargin,
                            balance,
                            account_equity: accountEquity,
                            total_margin_used: totalMarginUsed,
                        },
                    },
                    { status: 400 }
                );
            }
        }

        let signedLimitPayload: string | null = null;
        if (type === "limit") {
            try {
                const out = await signOrderWithAgent({
                    account,
                    symbol,
                    amount,
                    side,
                    type,
                    tick_level,
                    leverage,
                    timeStamp: normalizedTimeStamp,
                });
                signedLimitPayload = JSON.stringify({
                    payload: out.signedPayload,
                    headers: {
                        agent_wallet: out.agentPublicKey,
                    },
                });
            } catch (e) {
                const message = e instanceof Error ? e.message : "Agent wallet setup required";
                return NextResponse.json(
                    {
                        error: message,
                        code: "AGENT_NOT_READY",
                    },
                    { status: 400 }
                );
            }
        }

        // find or create user
        let user = await prisma.user.findUnique({ where: { walletAddress: account } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    fid: 0,
                    username: account.slice(0, 8),
                    walletAddress: account,
                    totalVolume: 0,
                    totalFees: 0,
                },
            });
        }

        const fee = tradeSize * 0.0004;

        const order = await prisma.order.create({
            data: {
                userId: user.id,
                pairId: String(symbol).toLowerCase(),
                pairSymbol: symbol,
                type,
                side: side === "bid" ? "long" : "short",
                size: tradeSize,
                leverage: Math.floor(leverage),
                limitPrice: tick_level ? parseFloat(tick_level) : null,
                status: "pending",
                signedPayload: signedLimitPayload,
                filledAt: null,
            },
        });

        if (type === "market") {
            let pacificaResponse: PacificaOrderResponse;
            let signed: Awaited<ReturnType<typeof signOrderWithAgent>>;
            try {
                signed = await signOrderWithAgent({
                    account,
                    symbol,
                    amount,
                    side,
                    type,
                    tick_level,
                    leverage,
                    timeStamp: normalizedTimeStamp,
                });
            } catch (e) {
                await prisma.order.update({ where: { id: order.id }, data: { status: "failed" } });
                const message = e instanceof Error ? e.message : "Pacifica agent setup required";
                return NextResponse.json(
                    {
                        error: message,
                        code: "AGENT_NOT_READY",
                    },
                    { status: 400 }
                );
            }

            try {
                pacificaResponse = await withTimeout(
                    pacifica.placeMarketOrder(signed.signedPayload, {
                        headers: {
                            agent_wallet: signed.agentPublicKey,
                        },
                    }),
                    15000,
                    "Pacifica API"
                );
            } catch (e) {
                await prisma.order.update({ where: { id: order.id }, data: { status: "failed" } });
                const message = e instanceof Error ? e.message : "Pacifica API error";
                return NextResponse.json({ error: message }, { status: 504 });
            }

            if (!pacificaResponse.success) {
                await prisma.order.update({ where: { id: order.id }, data: { status: "failed" } });
                const backendMessage =
                    pacificaResponse.error || pacificaResponse.details || "Failed to place order with Pacifica";
                if (/insufficient|margin|deposit|required/i.test(backendMessage)) {
                    return NextResponse.json(
                        {
                            error: "Insufficient margin. Deposit collateral in Pacifica.",
                            code: "INSUFFICIENT_MARGIN",
                            details: backendMessage,
                        },
                        { status: 400 }
                    );
                }
                return NextResponse.json(
                    {
                        error: backendMessage,
                        details: pacificaResponse.details || null,
                    },
                    { status: 500 }
                );
            }

            await prisma.$transaction([
                prisma.order.update({
                    where: { id: order.id },
                    data: {
                        status: "filled",
                        filledAt: new Date(),
                        pacificaOrderId: pacificaResponse.data?.order_id || null,
                    },
                }),
                prisma.trade.create({
                    data: {
                        orderId: order.id,
                        userId: user.id,
                        pairId: String(symbol).toLowerCase(),
                        pairSymbol: symbol,
                        side: side === "bid" ? "long" : "short",
                        size: tradeSize,
                        leverage: Math.floor(leverage),
                        entryPrice: pacificaResponse.data?.entry_price || 0,
                        fee,
                        status: "open",
                    },
                }),
                prisma.user.update({
                    where: { id: user.id },
                    data: {
                        totalVolume: { increment: tradeSize },
                        totalFees: { increment: fee },
                    },
                }),
            ]);
        }

        return NextResponse.json({
            success: true,
            order,
            message:
                order.type === "limit"
                    ? "Limit order placed! Will execute automatically when price hits."
                    : "Market order executed!",
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: "Internal server error", details: message }, { status: 500 });
    }
}
