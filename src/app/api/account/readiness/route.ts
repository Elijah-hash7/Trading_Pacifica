import { NextResponse } from "next/server";
import { pacifica } from "@/lib/pacifica";

function isSolanaAddress(addr: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const account = searchParams.get("account");
    const sizeParam = searchParams.get("size");
    const leverageParam = searchParams.get("leverage");

    if (!account) {
      return NextResponse.json(
        { error: "Wallet address required" },
        { status: 400 }
      );
    }

    if (!isSolanaAddress(account)) {
      return NextResponse.json(
        { error: "Invalid Solana account address" },
        { status: 400 }
      );
    }

    const size = sizeParam ? Number.parseFloat(sizeParam) : 0;
    const leverage = leverageParam ? Number.parseFloat(leverageParam) : 1;
    const safeLeverage = Number.isFinite(leverage) && leverage > 0 ? leverage : 1;
    const requiredMargin =
      Number.isFinite(size) && size > 0 ? size / safeLeverage : 0;

    const accountResponse = await pacifica.getAccountState(account);
    const accountData =
      accountResponse?.data && typeof accountResponse.data === "object"
        ? accountResponse.data
        : accountResponse;

    const balance = Number(accountData?.balance ?? 0);
    const availableToSpend = Number(accountData?.available_to_spend ?? 0);
    const accountEquity = Number(accountData?.account_equity ?? 0);
    const totalMarginUsed = Number(accountData?.total_margin_used ?? 0);
    const ready = availableToSpend >= requiredMargin;

    return NextResponse.json({
      success: true,
      account,
      source: "pacifica_account",
      ready,
      reason: ready ? "margin_available" : "insufficient_margin",
      availability: {
        available_to_spend: availableToSpend,
      },
      required: {
        margin: requiredMargin,
        size,
        leverage: safeLeverage,
      },
      accountState: {
        balance,
        available_to_spend: availableToSpend,
        account_equity: accountEquity,
        total_margin_used: totalMarginUsed,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Internal server error", details: message },
      { status: 500 }
    );
  }
}
