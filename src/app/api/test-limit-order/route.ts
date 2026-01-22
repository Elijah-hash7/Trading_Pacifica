import { checkLimitOrders } from '@/lib/limitOrderMonitor';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🧪 Manual test: Checking limit orders...');
    
    await checkLimitOrders();
    
    return NextResponse.json({
      success: true,
      message: 'Limit order check completed. Check console logs.',
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Test error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}