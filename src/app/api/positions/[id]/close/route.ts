import { pacifica } from "@/lib/pacifica";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { calculatePnL } from '@/lib/utils'
import { signOrderWithAgent } from "@/lib/pacificaAgent";

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

export async function POST(
    request: Request,
    { params }: { params: { id: string } | Promise<{ id: string }> }
) {
    try {
        // await params because App Router may provide it as a Promise
        const { id } = await params;
        const body = await request.json();


        // finds the trade in database
        const trade = await prisma.trade.findUnique({
            where : { id },
            include: { 
                user: true,
                order: true
            }
        });
        
        if (!trade) {
            return NextResponse.json(
                {error: 'Trade not found'},
                {status: 404}
            );
        }

        

        const account = typeof body?.account === "string" ? body.account : "";
        if (!account) {
            return NextResponse.json(
                { error: "Account is required to close a position" },
                { status: 400 }
            );
        }

        if (account !== trade.user.walletAddress) {
            return NextResponse.json(
                { error: "Account does not match trade owner" },
                { status: 403 }
            );
        }

        const closePayload = {
            account,
            symbol: trade.pairSymbol,
            amount: trade.order.size.toString(),
            side: trade.side === 'long' ? 'ask' : 'bid',
            type: "market",
            timestamp: Date.now(),
        };

        let signed: Awaited<ReturnType<typeof signOrderWithAgent>>;
        try {
            signed = await signOrderWithAgent(closePayload);
        } catch (e) {
            const message = e instanceof Error ? e.message : "Pacifica agent setup required";
            return NextResponse.json(
                { error: message, code: "AGENT_NOT_READY" },
                { status: 400 }
            );
        }

        let pacificaResponse: { success?: boolean; data?: { entry_price?: number } };
        try {
            pacificaResponse = await withTimeout(
                pacifica.placeMarketOrder(signed.signedPayload, {
                    headers: {
                        agent_wallet: signed.agentPublicKey,
                    },
                }),
                15000,
                'Pacifica close order'
            );
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to close with Pacifica';
            return NextResponse.json(
                { error: message },
                { status: 504 }
            );
        }

        if (!pacificaResponse.success) {
            return NextResponse.json(
                {error: 'failed to close position with Pacifica'},
                {status: 500}
            )
        }

        const exitPrice = pacificaResponse.data?.entry_price || 0;
        const pnl = calculatePnL(
            trade.entryPrice,
            exitPrice,
            trade.order.size,
            trade.side as 'long' | 'short',
            trade.leverage
        )


        const updatedTrade = await prisma.trade.update({
            where: { id },
            data: {
                exitPrice: exitPrice,
                pnl: pnl,
                status: 'closed',
                closedAt: new Date()
            }
        });

        return NextResponse.json({
            success: true,
            trade: updatedTrade,
            pnl: pnl
        });
        
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error closing position:', message)
        return NextResponse.json(
            {error: 'Internal Server error', details: message},
            {status: 500}
        )
    }

}
