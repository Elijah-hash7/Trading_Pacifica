import { pacifica } from "@/lib/pacifica";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";


// Ensure this runs on Node runtime (tweetnacl is fine there)
export const runtime = "nodejs";

function isValidSolAddress(addr: string) {
    try {
        new PublicKey(addr);
        return true;
    } catch {
        return false;
    }
}

function base64ToBytes(b64: string) {
    // Node-safe decode
    return new Uint8Array(Buffer.from(b64, "base64"));
}

export async function POST(request: Request) {
    try {

        const body = await request.json();

        const {
            account,
            signature,
            timeStamp,
            symbol,
            amount,
            side,
            type = 'market',
            tick_level
        } = body;



        if (!account || !signature || !symbol || !amount || !side) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (!timeStamp) {
            return NextResponse.json({ error: "Missing timestamp" }, { status: 400 });
        }

        if (typeof account !== "string" || !isValidSolAddress(account)) {
            return NextResponse.json({ error: "Invalid Solana account address" }, { status: 400 });
        }

        if (typeof signature !== "string" || signature.length < 20) {
            return NextResponse.json({ error: "Invalid signature format" }, { status: 400 });
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
            const msgBytes = new TextEncoder().encode(signatureMessage);
            const sigBytes = base64ToBytes(signature);
            const pubKeyBytes = bs58.decode(account);

            // tweetnacl expects 64-byte signatures
            if (sigBytes.length !== 64) {
                signatureValid = false;
            } else {
                signatureValid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
            }
        } catch {
            signatureValid = false;
        }

        if (!signatureValid) {
            return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
        }

        const tradeSize = Number.parseFloat(amount);
        if (!Number.isFinite(tradeSize) || tradeSize <= 0) {
            return NextResponse.json(
                { error: "Invalid trade size" },
                { status: 400 }
            );
        }

        // find or user create user in database
        let user = await prisma.user.findUnique({
            where: { walletAddress: account }
        })

        // if user doesnt exist create a new one
        if (!user) {
            user = await prisma.user.create({
                data: {
                    fid: 0,
                    username: account.slice(0, 8),
                    walletAddress: account,
                    totalVolume: 0,
                    totalFees: 0
                }
            });
        }



        // calculate Fee
        const fee = tradeSize * 0.0004

        // create order to track it
        const order = await prisma.order.create({
            data: {
                userId: user.id,
                pairId: symbol.toLowerCase(),
                pairSymbol: symbol,
                type: type,
                side: side === 'bid' ? 'long' : 'short',
                size: tradeSize,
                leverage: body.leverage || 1,
                limitPrice: body.tick_level ? parseFloat(body.tick_level) : null,
                status: 'pending',
                signedPayload: type === 'limit' ? JSON.stringify(body) : null,
                filledAt: null
            }
        });

        if (type === 'market') {

            const pacificaResponse = await pacifica.placeMarketOrder(body);

            if (!pacificaResponse.success) {
                await prisma.order.update({
                    where: { id: order.id },
                    data: { status: 'failed' }
                });
                return NextResponse.json(
                    { error: 'Failed to place order with Pacifica' },
                    { status: 500 }
                )
            }

            // Run all writes together so order/trade/user stay in sync.
            await prisma.$transaction([
                prisma.order.update({
                    where: { id: order.id },
                    data: {
                        // Mark as filled only after Pacifica confirms execution.
                        status: 'filled',
                        filledAt: new Date(),
                        pacificaOrderId: pacificaResponse.data?.order_id || null
                    }
                }),
                prisma.trade.create({
                    data: {
                        orderId: order.id,
                        userId: user.id,
                        pairId: symbol.toLowerCase(),
                        pairSymbol: symbol,
                        side: side === 'bid' ? 'long' : 'short',
                        size: tradeSize,
                        leverage: body.leverage || 1,
                        entryPrice: pacificaResponse.data?.entry_price || 0,
                        fee: fee,
                        status: 'open'
                    }
                }),
                prisma.user.update({
                    where: { id: user.id },
                    data: {
                        totalVolume: { increment: tradeSize },
                        totalFees: { increment: fee }
                    }
                })
            ]);
        }

        return NextResponse.json({
            success: true,
            order: order,
            message: order.type === 'limit'
                ? 'Limit order Placed! Will execute automatically when price hits.'
                : 'Market order executed!'
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: 'Internal server error', details: message },
            { status: 500 }
        )
    }
}
