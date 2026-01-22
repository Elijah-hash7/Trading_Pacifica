import { pacifica } from "@/lib/pacifica";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        console.log('Testing Pacifica API...');

        console.log('Fetching trading pairs');
        const pairs = await pacifica.getTradingPairs();

        console.log('Fetching Btc price...');
        const btcPrice = await pacifica.getPrice('BTC');


        return NextResponse.json({
            success: true,
            message: "Pacifica API is working!",
            data: {
                pairs,
                btcPrice
            }
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const details = (error as { response?: { data?: unknown } } | null)?.response?.data ?? 'No additional details';
        console.error('Pacifica API error:', message);
        return NextResponse.json({
            success: false,
            error: message,
            details: details
        }, { status: 500});
    }
    
}