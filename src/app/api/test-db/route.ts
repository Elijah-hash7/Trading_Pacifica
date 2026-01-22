// ⚠️ Node runtime required (Prisma / DB access)
export const runtime = "nodejs";


import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";


export async function GET() {
    try {

        console.log('Testing database connection')


        const userCount = await prisma.user.count();
        console.log(`Found ${userCount} user in database`)


        const users = await prisma.user.findMany();
        const orderCount = await prisma.order.count();

        const tradeCount = await prisma.trade.count();


        return NextResponse.json({
            success: true,
            database: 'connected',
            stats: {
                userNo: userCount,
                user: users,
                trades: tradeCount,
                orders: orderCount,
                connection: "Connected to Supabase"
            }
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            success: false,
            error: message
        }, { status: 500 }

        )
    }

}