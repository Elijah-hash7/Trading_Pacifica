import { NextResponse } from "next/server";
import { pacifica } from "@/lib/pacifica";

function isSolanaAddress(addr: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const account = searchParams.get("account");

    if (!account) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }

    if (!isSolanaAddress(account)) {
      return NextResponse.json({ error: "Invalid Solana account address" }, { status: 400 });
    }

    const accountResponse = await pacifica.getAccountState(account);
    const data =
      accountResponse?.data && typeof accountResponse.data === "object"
        ? accountResponse.data
        : accountResponse;

    return NextResponse.json({
      success: true,
      account,
      accountState: {
        balance: Number(data?.balance ?? 0),
        available_to_spend: Number(data?.available_to_spend ?? 0),
        account_equity: Number(data?.account_equity ?? 0),
        total_margin_used: Number(data?.total_margin_used ?? 0),
        total_pnl: Number(data?.total_pnl ?? data?.pnl ?? 0),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load Pacifica account state", details: message }, { status: 500 });
  }
}
