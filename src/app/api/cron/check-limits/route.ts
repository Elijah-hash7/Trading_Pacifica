import { checkLimitOrders } from "@/lib/limitOrderMonitor";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    try {

        const authHeader = request.headers.get('authorization');

        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await checkLimitOrders();

        return NextResponse.json({
            success: true,
            message: 'Limit orders checked successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.log('Cron job error:', message);
        return NextResponse.json(
            {error: 'Cron job failed', details: message},
            {status: 500}   
        )
    }
    
}