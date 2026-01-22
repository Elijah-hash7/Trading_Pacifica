import { NextResponse } from 'next/server';

const RPC_URL = 'https://cloudflare-eth.com';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    const rpcRes = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
    });

    if (!rpcRes.ok) {
      const text = await rpcRes.text().catch(() => '');
      return NextResponse.json(
        { error: 'RPC error', details: `${rpcRes.status} ${rpcRes.statusText} ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const rpcJson: { result?: string; error?: unknown } = await rpcRes.json();
    if (!rpcJson?.result || typeof rpcJson.result !== 'string') {
      return NextResponse.json({ error: 'Invalid RPC response', details: rpcJson?.error }, { status: 502 });
    }

    const wei = BigInt(rpcJson.result);
    const eth = Number(wei) / 1e18;
    const weiPerFinney = BigInt('1000000000000000');
    const ethExact = (wei / weiPerFinney).toString();

    return NextResponse.json({ success: true, address, wei: rpcJson.result, eth, ethExact });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
