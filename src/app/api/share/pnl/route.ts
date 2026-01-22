// src/app/api/share/pnl/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pairSymbol, side, pnl, pnlPercent, entryPrice, exitPrice } = body;

    if (!pairSymbol || !side || pnl === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Format PnL message - just return it, createCast happens on client
    const isProfitable = pnl >= 0;
    const emoji = isProfitable ? '🚀' : '📉';
    const sign = isProfitable ? '+' : '';
    
    const message = `${emoji} Just closed a ${side.toUpperCase()} on ${pairSymbol}!

Entry: $${entryPrice?.toLocaleString() || 'N/A'}
Exit: $${exitPrice?.toLocaleString() || 'N/A'}
PnL: ${sign}$${Math.abs(pnl).toFixed(2)} (${sign}${pnlPercent?.toFixed(2)}%)

Trade on Pacificast 👇`;

    // Just return the message - client will create the cast
    return NextResponse.json({ 
      success: true,
      message: message
    });
    
  } catch (error) {
    console.error('Error sharing PnL:', error);
    return NextResponse.json(
      { error: 'Failed to share PnL' },
      { status: 500 }
    );
  }
}