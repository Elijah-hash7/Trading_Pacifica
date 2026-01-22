import { ImageResponse } from 'next/og';
import React from 'react';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pair = searchParams.get('pair') || 'UNKNOWN';
    const side = (searchParams.get('side') || '').toUpperCase();
    const pnlPercentRaw = searchParams.get('pnlPercent');

    const pnlPercent = pnlPercentRaw ? Number(pnlPercentRaw) : 0;
    const isProfit = Number.isFinite(pnlPercent) ? pnlPercent >= 0 : true;
    const sign = isProfit ? '+' : '';

    const headline = isProfit ? 'WE ARE SO BACK' : 'PAIN.';
    const sub = isProfit ? 'Green candle energy' : 'Risk management next time';

    return new ImageResponse(
      React.createElement(
        'div',
        {
          style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 64,
            background: isProfit
              ? 'linear-gradient(135deg, #052e1a 0%, #0b1220 60%, #0b1220 100%)'
              : 'linear-gradient(135deg, #2a0a0a 0%, #0b1220 60%, #0b1220 100%)',
            color: '#fff',
            fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial',
          },
        },
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('div', { style: { fontSize: 28, opacity: 0.9 } }, 'Pacificast'),
          React.createElement(
            'div',
            {
              style: {
                fontSize: 20,
                padding: '10px 14px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
              },
            },
            side ? `${side}` : 'TRADE'
          )
        ),
        React.createElement(
          'div',
          null,
          React.createElement('div', { style: { fontSize: 64, fontWeight: 800, letterSpacing: -2 } }, headline),
          React.createElement('div', { style: { fontSize: 24, opacity: 0.85, marginTop: 10 } }, sub),
          React.createElement(
            'div',
            {
              style: {
                marginTop: 36,
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                flexWrap: 'wrap',
              },
            },
            React.createElement(
              'div',
              {
                style: {
                  fontSize: 26,
                  padding: '12px 16px',
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                },
              },
              `Pair: ${pair}`
            ),
            React.createElement(
              'div',
              {
                style: {
                  fontSize: 30,
                  fontWeight: 800,
                  padding: '12px 16px',
                  borderRadius: 14,
                  background: isProfit ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
                  border: isProfit ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(239,68,68,0.35)',
                },
              },
              `${sign}${Number.isFinite(pnlPercent) ? pnlPercent.toFixed(2) : '0.00'}%`
            )
          )
        ),
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', opacity: 0.8, fontSize: 20 } },
          React.createElement('div', null, 'Trade on Pacificast'),
          React.createElement('div', null, 'Powered by Farcaster')
        )
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch {
    return new Response('Failed to generate image', { status: 500 });
  }
}
