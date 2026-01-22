// src/app/api/users/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, username, walletAddress } = body;

    if (fid === undefined || fid === null || !username || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Normalize walletAddress: if an object was sent, try to extract a string field.
    const normalizeAddress = (val: unknown): string | null => {
      if (!val && val !== 0) return null;
      if (typeof val === 'string') return val;
      if (typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        const maybe = obj.address ?? obj.account ?? obj.wallet ?? undefined;
        if (typeof maybe === 'string') return maybe;
        try {
          const s = String(val);
          return s !== '[object Object]' ? s : null;
        } catch {
          return null;
        }
      }
      return null;
    };

    const normalizedWallet = normalizeAddress(walletAddress);
    if (!normalizedWallet) {
      return NextResponse.json({ error: 'Invalid walletAddress' }, { status: 400 });
    }

    // Upsert user (update if exists, create if not)
    const user = await prisma.user.upsert({
      where: { walletAddress: normalizedWallet },
      update: {
        fid: fid,
        username: username,
      },
      create: {
        fid: fid,
        username: username,
        walletAddress: normalizedWallet,
        totalVolume: 0,
        totalFees: 0,
      },
    });

    return NextResponse.json({ user });
    
  } catch (error) {
    console.error('Error syncing user:', error);
    return NextResponse.json(
      { error: 'Failed to sync user' },
      { status: 500 }
    );
  }
}
