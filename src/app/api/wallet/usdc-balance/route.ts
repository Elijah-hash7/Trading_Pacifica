import { NextResponse } from "next/server";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const RPC_URLS = [process.env.NEXT_PUBLIC_SOL_RPC_URL, "https://api.mainnet-beta.solana.com"].filter(
  (url, index, list): url is string => typeof url === "string" && url.length > 0 && list.indexOf(url) === index
);

function isSolanaAddress(addr: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const account = searchParams.get("account") ?? "";

    if (!account) {
      return NextResponse.json({ error: "account is required", code: "ACCOUNT_REQUIRED" }, { status: 400 });
    }
    if (!isSolanaAddress(account)) {
      return NextResponse.json({ error: "Invalid Solana account address", code: "INVALID_ACCOUNT" }, { status: 400 });
    }

    for (const rpcUrl of RPC_URLS) {
      try {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTokenAccountsByOwner",
            params: [account, { mint: USDC_MINT }, { encoding: "jsonParsed" }],
          }),
          cache: "no-store",
        });
        if (!response.ok) continue;

        const body = await response.json().catch(() => ({}));
        const accounts = Array.isArray(body?.result?.value) ? body.result.value : [];
        let total = 0;
        for (const acc of accounts) {
          const tokenAmount = acc?.account?.data?.parsed?.info?.tokenAmount;
          const uiAmount = tokenAmount?.uiAmount;
          if (typeof uiAmount === "number") {
            total += uiAmount;
            continue;
          }
          const uiAmountString = tokenAmount?.uiAmountString;
          if (typeof uiAmountString === "string") {
            const parsed = Number.parseFloat(uiAmountString);
            if (Number.isFinite(parsed)) total += parsed;
          }
        }

        return NextResponse.json({ success: true, account, usdcBalance: total });
      } catch {
        continue;
      }
    }

    return NextResponse.json(
      { error: "Unable to query wallet USDC balance from configured RPCs", code: "RPC_UNAVAILABLE" },
      { status: 502 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to fetch USDC balance", details: message }, { status: 500 });
  }
}
