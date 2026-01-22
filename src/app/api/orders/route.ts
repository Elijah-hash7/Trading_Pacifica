import { pacifica } from "@/lib/pacifica";
import { NextResponse } from "next/server";

export async function GET (request: Request) {

    try {

        const { searchParams } = new URL (request.url)
        const walletAddress = searchParams.get('account');

        if (!walletAddress) {
            return NextResponse.json(
                {error: 'wallet address required'},
                {status: 400}
            )
        }

        const response = await pacifica.getOpenOrders(walletAddress);


        return NextResponse.json({
            success: true,
            orders: response.data
        });



    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            {error: 'Internal Server error', details: message},
            {status: 500}
        )
    }
    
}