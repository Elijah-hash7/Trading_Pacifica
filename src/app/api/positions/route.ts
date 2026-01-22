import { pacifica } from "@/lib/pacifica";
import { NextResponse } from "next/server";


export async function GET(request: Request) {
    try {

        // Get Wallet address from query params
        const { searchParams } = new URL(request.url)
        const walletAddress = searchParams.get('account');


        if (!walletAddress) {
            return NextResponse.json(
                {error: 'Wallet address required'},
                {status: 400}
            )
        }

        const response = await pacifica.getPositions(walletAddress);

        return NextResponse.json ({
            success: true,
            positions: response.data || []
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error fetching Position', message)
        return NextResponse.json(
            {error: 'Internal server error', details: message},
            {status: 500}
        )
    }

    
}