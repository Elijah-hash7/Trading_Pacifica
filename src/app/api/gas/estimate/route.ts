import { NextResponse } from "next/server";

const RPC_URL = "https://cloudflare-eth.com";
const MAINNET_TOKENS: Record<string, { address: string; decimals: number }> = {
  USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  DAI: { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
  WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
  WBTC: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
  LINK: { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18 },
  UNI: { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18 },
  AAVE: { address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DdAE9", decimals: 18 },
};

const formatWei = (wei: bigint) => {
  const base = 10n ** 18n;
  const whole = wei / base;
  const fraction = (wei % base).toString().padStart(18, "0").slice(0, 6);
  return `${whole}.${fraction}`;
};

const parseUnits = (value: string, decimals: number) => {
  const [whole, fraction = ""] = value.split(".");
  const cleanWhole = whole.replace(/\D/g, "") || "0";
  const cleanFraction = fraction.replace(/\D/g, "");
  const fractionPadded = (cleanFraction + "0".repeat(decimals)).slice(0, decimals);
  return (
    BigInt(cleanWhole) * 10n ** BigInt(decimals) +
    BigInt(fractionPadded || "0")
  );
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenSymbol = searchParams.get("token") ?? "ETH";
    const to = searchParams.get("to") ?? "";
    const amount = searchParams.get("amount") ?? "0";
    const from = searchParams.get("from") ?? "0x0000000000000000000000000000000000000000";
    const tokenAddress = searchParams.get("tokenAddress") ?? "";
    const tokenDecimals = searchParams.get("tokenDecimals");

    if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
      return NextResponse.json({ error: "Invalid recipient" }, { status: 400 });
    }

    const token = tokenSymbol.toUpperCase();
    const numericAmount = Number.parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    let gasLimit = token === "ETH" ? 21000n : 65000n;
    if (token !== "ETH") {
      const tokenMeta = MAINNET_TOKENS[token];
      const address = tokenAddress || tokenMeta?.address;
      if (address) {
        const decimals =
          tokenDecimals != null && tokenDecimals !== ""
            ? Number.parseInt(tokenDecimals, 10)
            : tokenMeta?.decimals ?? 18;
        const units = parseUnits(amount, Number.isFinite(decimals) ? decimals : 18);
        const data = `0xa9059cbb${to.replace(/^0x/, "").padStart(64, "0")}${units.toString(16).padStart(64, "0")}`;

        const estimateRes = await fetch(RPC_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_estimateGas",
            params: [
              {
                from,
                to: address,
                data,
                value: "0x0",
              },
              "latest",
            ],
          }),
        });
        const estimateJson: { result?: string } = await estimateRes.json();
        if (estimateJson?.result) {
          gasLimit = BigInt(estimateJson.result);
        }
      }
    }

    const gasPriceRes = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "eth_gasPrice",
        params: [],
      }),
    });
    const gasJson: { result?: string } = await gasPriceRes.json();
    if (!gasJson?.result) {
      return NextResponse.json({ error: "Gas price unavailable" }, { status: 502 });
    }

    const gasPrice = BigInt(gasJson.result);
    const feeWei = gasLimit * gasPrice;
    const feeLabel = `~${formatWei(feeWei)} ETH`;

    return NextResponse.json({ feeLabel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", details: message },
      { status: 500 }
    );
  }
}
