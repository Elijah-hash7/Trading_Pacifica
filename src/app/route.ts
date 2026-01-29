import { NextResponse } from 'next/server';
import { renderFrameLandingHtml } from '@/lib/frameLanding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const html = renderFrameLandingHtml({ origin });

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
