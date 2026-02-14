import { NextResponse } from "next/server";

function isSolanaAddress(addr: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const account = typeof body?.account === "string" ? body.account : "";

    if (!account) {
      return NextResponse.json({ error: "account is required" }, { status: 400 });
    }
    if (!isSolanaAddress(account)) {
      return NextResponse.json({ error: "Invalid Solana account address" }, { status: 400 });
    }

    const base = process.env.PACIFICA_DEPOSIT_EMBED_URL || "https://app.pacifica.fi";
    const url = `${base}${base.includes("?") ? "&" : "?"}account=${encodeURIComponent(account)}`;

    return NextResponse.json({
      success: true,
      method: "pacifica_embed",
      embedUrl: url,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to start deposit", details: message }, { status: 500 });
  }
}
