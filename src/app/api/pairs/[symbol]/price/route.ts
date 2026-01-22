import { pacifica } from "@/lib/pacifica";
import { NextResponse } from "next/server";

export async function GET(
    request: Request,
    { params }: { params: { symbol: string } | Promise<{ symbol: string }> }
) {
    try {
        const { symbol } = await params;

        const response = await pacifica.getPrice(symbol);

        if (!response.success) {
            return NextResponse.json(
                {error: response.error || 'Failed to fetch price'},
                {status: 503}
            )
        }

        type PriceRow = { symbol: string; mark: string; mid?: string; oracle?: string; volume_24h?: string; funding?: string; timestamp?: number };
        const list: PriceRow[] = Array.isArray(response.data) ? (response.data as PriceRow[]) : [];
        const priceData = list.find((item) => item.symbol === symbol);

        if (!priceData) {
            return NextResponse.json(
                {error: `Symbol ${symbol} not found`},
                {status: 404}
            );
        }

        return NextResponse.json({
            success: true,
            symbol: priceData.symbol,
            price: priceData.mark,
            mid: priceData.mid,
            oracle: priceData.oracle,
            volume24h: priceData.volume_24h,
            fundingRate: priceData.funding,
            timeStamp: priceData.timestamp   
        });
    } catch (error: unknown){
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error fetching price:', message);
        return NextResponse.json(
            {error: 'Internal Server Error', details: message},
            {status: 500}
        )
    }
    
}
