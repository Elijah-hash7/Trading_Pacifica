import { NextResponse } from "next/server";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3/simple/price";
const CACHE_TTL_MS = 60_000;
const rateCache = new Map<string, { rateLabel: string; expiresAt: number }>();

const TOKEN_IDS: Record<string, string> = {
  ETH: "ethereum",
  WETH: "weth",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  BTC: "bitcoin",
  WBTC: "wrapped-bitcoin",
  SOL: "solana",
  XRP: "ripple",
  DOGE: "dogecoin",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  ARB: "arbitrum",
  ADA: "cardano",
  AVAX: "avalanche-2",
  LTC: "litecoin",
  BNB: "binancecoin",
  SUI: "sui",
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from")?.toUpperCase() ?? "";
    const to = searchParams.get("to")?.toUpperCase() ?? "";

    const fromId = TOKEN_IDS[from];
    const toId = TOKEN_IDS[to];
    if (!fromId || !toId) {
      return NextResponse.json(
        { error: "Unsupported token pair" },
        { status: 400 }
      );
    }

    const cacheKey = `${fromId}->${toId}`;
    const cached = rateCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(
        { rateLabel: cached.rateLabel },
        { headers: { "cache-control": "public, max-age=60" } }
      );
    }

    const ids = `${fromId},${toId}`;
    const res = await fetch(`${COINGECKO_BASE}?ids=${ids}&vs_currencies=usd`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Rate unavailable" },
        { status: 502 }
      );
    }

    const json = await res.json();
    const fromPrice = json?.[fromId]?.usd;
    const toPrice = json?.[toId]?.usd;
    if (!fromPrice || !toPrice) {
      return NextResponse.json(
        { error: "Rate unavailable" },
        { status: 502 }
      );
    }

    const rate = (Number(toPrice) / Number(fromPrice)).toFixed(6);
    const rateLabel = `1 ${from} = ${rate} ${to}`;
    rateCache.set(cacheKey, { rateLabel, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(
      { rateLabel },
      { headers: { "cache-control": "public, max-age=60" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", details: message },
      { status: 500 }
    );
  }
}
