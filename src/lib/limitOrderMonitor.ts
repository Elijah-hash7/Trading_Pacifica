import { prisma } from "@/lib/db";
import { pacifica } from "./pacifica";


export async function checkLimitOrders() {
    console.log('Checking limit orders....')

    try {
        const pendingOrders = await prisma.order.findMany({
            where: {
                status: 'pending',
                type: 'limit'
            },
            include: {
                user: true // Get user info
            }
        });

        console.log(`Found ${pendingOrders.length} pending limit orders`)

        for (const order of pendingOrders) {
            await CheckAndExecuteOrder(order);
        }

        console.log('Limit order check complete')
    } catch (error) {
        console.log('Error Checking limit order', error)
    }
}

type PendingLimitOrder = {
    id: string;
    userId: string;
    pairId: string;
    pairSymbol: string;
    side: string;
    size: number;
    leverage: number;
    limitPrice: number | null;
    signedPayload: string | null;
};

type PriceRow = { symbol: string; mark: string };

export async function CheckAndExecuteOrder(order: PendingLimitOrder) {

    try {

        if (!order.signedPayload) {
            console.error(`Order ${order.id} missing signedPayload!`)
            return;
        }


        // Get the price for the pair
        const priceData = await pacifica.getPrice(order.pairSymbol);

        const list: PriceRow[] = Array.isArray(priceData?.data) ? (priceData.data as PriceRow[]) : [];
        const symbolData = list.find((item) => item.symbol === order.pairSymbol);

        if (!symbolData) {
            console.log(`No price data for ${order.pairSymbol}`);
            return;
        }

        const currentPrice = parseFloat(symbolData.mark);
        const limitPrice = order.limitPrice;
        if (typeof limitPrice !== 'number') {
            console.log(`Order ${order.id} missing limitPrice`);
            return;
        }


        console.log(`${order.pairSymbol}: Current=$${currentPrice}, ` + ` Limit=$${limitPrice}, Side=$${order.side}`);

        const shouldExecute = checkIfPriceHit(currentPrice, limitPrice, order.side);

        if (shouldExecute) {
            console.log(`Limit HIt! Executing order ${order.id}`);
            await ExecuteOrder(order, currentPrice)
        } else {
            console.log(`Waiting...(${order.side} ${order.pairSymbol} @ $${limitPrice})`);
        }
    } catch (error) {
        console.error(`Error checking order ${order.id}:`, error);

    }

}


function checkIfPriceHit(currentPrice: number, limitPrice: number, side: string): boolean {
    if (side === 'long') {
        return currentPrice <= limitPrice;
    } else {
        return currentPrice >= limitPrice;
    }
}

export async function ExecuteOrder(order: PendingLimitOrder, executionPrice: number) {

    try {
        console.log(`Executing order ${order.id} with stored signature`);

        if (!order.signedPayload) {
            console.error(`Order ${order.id} missing signedPayload!`);
            return;
        }

        const signedPayload = JSON.parse(order.signedPayload);

        console.log(`Calling Pacifica API.... `)

        const pacificaResponse = await pacifica.placeMarketOrder(signedPayload);

        if (!pacificaResponse.success) {
            console.error(`Pacifica  rejected order ${order.id}:`, pacificaResponse)
            return;
        }

        console.log(`Order executed with Pacifica!`);

        const fee = order.size * 0.0004;

        await prisma.order.update({
            where: { id: order.id },
            data: {
                status: 'filled',
                filledAt: new Date(),
                pacificaOrderId: pacificaResponse.data?.order_id || null
            }
        });

        console.log(`Order ${order.id} market as Filled`)

        await prisma.trade.create({
            data: {
                orderId: order.id,
                userId: order.userId,
                pairId: order.pairId,
                pairSymbol: order.pairSymbol,
                side: order.side,
                size: order.size,
                leverage: order.leverage,
                entryPrice: executionPrice,
                fee: fee,
                status: 'open'
            }
        });

        console.log(`Trade Created! Position is now Open`);


        await prisma.user.update({
            where: { id: order.userId },
            data: {
                totalVolume: { increment: order.size },
                totalFees: { increment: fee }
            }
        });

        console.log(`User stats updated`)

        console.log(`[TODO] send notifications: "Your limit order executed at $${executionPrice}"`);
    } catch (error) {
        console.error(`Error executing order ${order.id}:`, error)

        await prisma.order.update({
            where: {id: order.id},
            data: {
                status: 'failed'
            }
        }).catch((e: unknown) => console.error('Failed to mark order as failed:', e))
    }
}
