import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';


export async function DELETE(
    request: Request,
    { params }: { params: { id: string } | Promise<{ id: string }> }
) {
    try {
        // await params because App Router may provide it as a Promise
        const { id } = await params;

        const order = await prisma.order.findUnique({
            where: { id }
        });

        if (!order) {
            return NextResponse.json(
                { error: 'order not found' },
                { status: 404 }
            )
        }


        if (order.status !== 'pending') {
            return NextResponse.json(
                {error: 'Can only cancel pending orders'},
                {status: 400}
            )
        }


        await prisma.order.update({
            where : {id },
            data: {
                status : 'cancelled'
            }
        });


        return NextResponse.json({
            success: true,
            message: 'order cancelled successfully'
        });
    } catch (error: unknown) {
        console.log('Error cancelling order:', error);
        return NextResponse.json(
            {error: 'Internal Server error'},
            {status: 500}
        )
    }
} 
