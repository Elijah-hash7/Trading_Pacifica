import { NextResponse } from "next/server";
import { pacifica } from "@/lib/pacifica";
import { signWithdrawWithAgent } from "@/lib/pacificaAgent";

function isSolanaAddress(addr: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function redactSignedPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload;
  const cloned = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  if (typeof cloned.signature === "string") {
    const value = cloned.signature;
    cloned.signature = `${value.slice(0, 12)}...${value.slice(-8)}`;
  }
  return cloned;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const walletAddress = typeof body?.walletAddress === "string" ? body.walletAddress : "";
    const amountRaw = typeof body?.amount === "string" ? body.amount : String(body?.amount ?? "");
    const amount = Number.parseFloat(amountRaw);

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required", code: "WALLET_REQUIRED" }, { status: 400 });
    }
    if (!isSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid Solana wallet address", code: "INVALID_WALLET" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid withdraw amount", code: "INVALID_AMOUNT" }, { status: 400 });
    }
    if (amount < 1) {
      return NextResponse.json({ error: "Minimum withdraw amount is $1", code: "MIN_WITHDRAW_AMOUNT" }, { status: 400 });
    }

    const accountResponse = await pacifica.getAccountState(walletAddress);
    const accountData =
      accountResponse?.data && typeof accountResponse.data === "object"
        ? accountResponse.data
        : accountResponse;
    const availableToSpend = Number(accountData?.available_to_spend ?? 0);
    const fee = 1;
    const required = amount + fee;
    if (!Number.isFinite(availableToSpend) || availableToSpend < required) {
      return NextResponse.json(
        {
          error: "Insufficient Pacifica balance for withdraw + fee",
          code: "INSUFFICIENT_BALANCE",
          details: { available_to_spend: availableToSpend, requested: amount, fee, required },
        },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const signed = await signWithdrawWithAgent({
      account: walletAddress,
      destination: walletAddress,
      amount: amount.toString(),
      timestamp,
    });

    console.info("[pacifica-withdraw request]", {
      endpoint: "/account/withdraw",
      headers: { agent_wallet: signed.agentPublicKey },
      payload: redactSignedPayload(signed.signedPayload),
    });

    const response = await pacifica.withdraw(signed.signedPayload, {
      headers: {
        agent_wallet: signed.agentPublicKey,
      },
    });

    if (!response?.success) {
      console.error("[pacifica-withdraw rejected]", {
        endpoint: "/account/withdraw",
        response,
      });
      const message = response?.error || response?.details || "Pacifica withdraw failed";
      const notAllowed = /permission|not allowed|forbidden|unauthorized|agent/i.test(String(message));
      return NextResponse.json(
        {
          error: message,
          code: notAllowed ? "WITHDRAW_NOT_ALLOWED_FOR_AGENT" : "WITHDRAW_FAILED",
          details: response?.details ?? null,
          action: notAllowed ? "OPEN_PACIFICA_UI_WITHDRAW" : undefined,
        },
        { status: notAllowed ? 403 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: "submitted",
      fee,
      data: response?.data ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to process withdraw", code: "WITHDRAW_INTERNAL_ERROR", details: message },
      { status: 500 }
    );
  }
}
