import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";


export async function GET() {
  try {
    // Step 1: Get all users sorted by totalVolume (highest first)
    // This gives us the top traders
    const users = await prisma.user.findMany({
      orderBy: {
        totalVolume: 'desc' // Sort from highest to lowest volume
      },
    }) as Array<{
      id: string;
      username: string;
      walletAddress: string;
      fid: number;
      totalVolume: number;
      totalFees: number;
    }>;

    // Step 2: Calculate total fee pool
    // Sum up all the totalFees from all users
    const totalFeesCollected = users.reduce((sum: number, user) => {
      return sum + user.totalFees;
    }, 0);

    // Fee pool is 50% of total fees collected
    // The other 50% goes to the platform/operations
    const feePool = totalFeesCollected * 0.5;

    // Step 3: Calculate rewards for top 3 traders
    // Top 3 get: 50%, 30%, 20% of the fee pool
    const rewardPercentages = [0.5, 0.3, 0.2]; 
    
    const tradeCounts = await prisma.trade.groupBy({
      by: ['userId'] as const,
      _count: {
        _all: true
      }
    });
    const tradeCountByUserId = new Map(
      tradeCounts.map((row) => [row.userId, row._count._all])
    );

    // Step 4: Build leaderboard with trade counts and rewards
    const leaderboard = users.map((user, index: number) => {
      const tradeCount = tradeCountByUserId.get(user.id) || 0;
      let potentialReward = 0;
      if (index < 3 && feePool > 0) {
        potentialReward = feePool * rewardPercentages[index];
      }

      return {
        rank: index + 1, 
        username: user.username,
        walletAddress: user.walletAddress,
        fid: user.fid,
        totalVolume: user.totalVolume,
        totalFees: user.totalFees,
        tradeCount: tradeCount,
        potentialReward: potentialReward
      };
    });

    // Step 5: Return the leaderboard data
    return NextResponse.json({
      success: true,
      leaderboard: leaderboard,
      feePool: {
        totalFeesCollected: totalFeesCollected,
        feePool: feePool, 
        rewardDistribution: {
          first: feePool > 0 ? feePool * 0.5 : 0,  
          second: feePool > 0 ? feePool * 0.3 : 0, 
          third: feePool > 0 ? feePool * 0.2 : 0   
        }
      }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error fetching leaderboard:', message);
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}
