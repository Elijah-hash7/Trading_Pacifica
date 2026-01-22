import { pacifica } from "@/lib/pacifica";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { calculatePnL } from '@/lib/utils'

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

        

        const pacificaResponse = await pacifica.placeMarketOrder({
            ...body,
            symbol: trade.pairSymbol,
            amount: trade.order.size.toString(),
            side: trade.side === 'long' ? 'ask' : 'bid'
        });

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
