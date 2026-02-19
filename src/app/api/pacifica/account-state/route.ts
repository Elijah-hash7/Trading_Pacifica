import { NextResponse } from "next/server";
import { pacifica } from "@/lib/pacifica";
import axios from "axios";

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
      accountState: {
        balance: Number(data?.balance ?? 0),
        pending_balance: Number(data?.pending_balance ?? 0),
        available_to_spend: Number(data?.available_to_spend ?? 0),
        account_equity: Number(data?.account_equity ?? 0),
        total_margin_used: Number(data?.total_margin_used ?? 0),
        total_pnl: Number(data?.total_pnl ?? data?.pnl ?? 0),
      },
    });
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const details =
        (error.response?.data as { error?: unknown; details?: unknown } | undefined)?.details ??
        (error.response?.data as { error?: unknown } | undefined)?.error ??
        error.message;
      console.error("[pacifica-account-state upstream]", {
        status,
        details,
      });
      if (status === 404) {
        return NextResponse.json(
          {
            error: "Pacifica account not found",
            action: "CREATE_PACIFICA_ACCOUNT",
            details: "No Pacifica account found for this wallet.",
          },
          { status: 404 }
        );
      }
      if (typeof details === "string" && /not initialized|not found|no account/i.test(details)) {
        return NextResponse.json(
          {
            error: "Pacifica account not initialized",
            action: "CREATE_PACIFICA_ACCOUNT",
            details: "No Pacifica account found for this wallet.",
          },
          { status: 404 }
        );
      }
      if (typeof status === "number" && status >= 400 && status < 600) {
        return NextResponse.json({ error: "Pacifica account state request failed", details }, { status });
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[pacifica-account-state internal]", message);
    return NextResponse.json({ error: "Failed to load Pacifica account state", details: message }, { status: 500 });
  }
}
