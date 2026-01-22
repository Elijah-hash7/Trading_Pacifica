import { pacifica } from '@/lib/pacifica';
import { NextResponse } from 'next/server';


export async function GET() {
    try {
        const response = await pacifica.getTradingPairs();


        if (!response.success) {
            return NextResponse.json(
                { error: 'Failed to fetch trading pairs' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            pairs: response.data
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error Fetching pairs:', message);
        return NextResponse.json(
            {error: 'Internal server error', details: message},
            { status : 500 }
        )
    }


}