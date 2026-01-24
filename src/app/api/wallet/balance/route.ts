import { NextResponse } from 'next/server';

const RPC_URLS = [
  'https://cloudflare-eth.com',
  'https://rpc.ankr.com/eth',
];

const fetchBalance = async (address: string) => {
  for (const rpcUrl of RPC_URLS) {
    try {
      const rpcRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        }),
        cache: 'no-store',
      });

      if (!rpcRes.ok) {
        continue;
      }

      const rpcJson: { result?: string; error?: unknown } = await rpcRes.json();
      if (!rpcJson?.result || typeof rpcJson.result !== 'string') {
        continue;
      }

      return { ok: true as const, result: rpcJson.result };
    } catch {
      continue;
    }
  }

  return { ok: false as const };
};

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

    const result = await fetchBalance(address);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'RPC unavailable', details: 'All RPC providers failed' },
        { status: 502 }
      );
    }

    const wei = BigInt(result.result);
    const eth = Number(wei) / 1e18;
    const weiPerFinney = BigInt('1000000000000000');
    const ethExact = (wei / weiPerFinney).toString();

    return NextResponse.json({ success: true, address, wei: result.result, eth, ethExact });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
