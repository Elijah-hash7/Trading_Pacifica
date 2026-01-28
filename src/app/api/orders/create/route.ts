import { pacifica } from "@/lib/pacifica";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";

function isSolanaAddress(addr: string) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function verifySolanaSignature(opts: {
    account: string;
    message: string;
    signatureBase64: string;
}) {
    const { account, message, signatureBase64 } = opts;

    // Strong validation
    const pubkey = new PublicKey(account); // throws if invalid
    const messageBytes = new TextEncoder().encode(message);
    const sigBytes = Buffer.from(signatureBase64, "base64"); // 64 bytes expected

    if (sigBytes.length !== 64) return false;

    return nacl.sign.detached.verify(
        messageBytes,
        new Uint8Array(sigBytes),
        pubkey.toBytes()
    );
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const {
            account,
            signature,
            signatureEncoding,
            timeStamp,
            symbol,
            amount,
            side,
            type = "market",
            tick_level,
            builder_code,
        } = body;

        if (!account || !signature || !symbol || !amount || !side) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (!timeStamp) {
            return NextResponse.json({ error: "Missing timestamp" }, { status: 400 });
        }

        // Solana address validation
        if (typeof account !== "string" || !isSolanaAddress(account)) {
            return NextResponse.json({ error: "Invalid Solana account address" }, { status: 400 });
        }

        if (signatureEncoding !== "base64" || typeof signature !== "string") {
            return NextResponse.json({ error: "Invalid signature encoding (expected base64)" }, { status: 400 });
        }

        const signatureMessage = [
            "Pacificast Order",
            `account:${account}`,
            `symbol:${symbol}`,
            `amount:${amount}`,
            `side:${side}`,
            `type:${type}`,
            `timestamp:${timeStamp}`,
            `tick:${tick_level ?? ""}`,
        ].join("\n");

        let signatureValid = false;
        try {
            signatureValid = verifySolanaSignature({
                account,
                message: signatureMessage,
                signatureBase64: signature,
            });
        } catch {
            signatureValid = false;
        }

        if (!signatureValid) {
            return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
        }

        const tradeSize = Number.parseFloat(amount);
        if (!Number.isFinite(tradeSize) || tradeSize <= 0) {
            return NextResponse.json({ error: "Invalid trade size" }, { status: 400 });
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
                leverage: body.leverage || 1,
                limitPrice: tick_level ? parseFloat(tick_level) : null,
                status: "pending",
                signedPayload: type === "limit" ? JSON.stringify(body) : null,
                filledAt: null,
            },
        });

        if (type === "market") {
            const pacificaResponse = await pacifica.placeMarketOrder(body);

            if (!pacificaResponse.success) {
                await prisma.order.update({ where: { id: order.id }, data: { status: "failed" } });
                return NextResponse.json({ error: "Failed to place order with Pacifica" }, { status: 500 });
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
                        leverage: body.leverage || 1,
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
