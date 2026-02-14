import { NextResponse } from "next/server";
import { createOrRotatePacificaAgent } from "@/lib/pacificaAgent";

function isSolanaAddress(addr: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const account = typeof body?.account === "string" ? body.account : "";
    const masterSignature = typeof body?.signature === "string" ? body.signature : "";
    const timeStamp =
      typeof body?.timeStamp === "string" && body.timeStamp.length > 0
        ? body.timeStamp
        : new Date().toISOString();

    if (!account || !masterSignature) {
      return NextResponse.json({ error: "account and signature are required" }, { status: 400 });
    }

    if (!isSolanaAddress(account)) {
      return NextResponse.json({ error: "Invalid Solana account address" }, { status: 400 });
    }

    if (typeof body?.signatureEncoding !== "string" || body.signatureEncoding !== "base64") {
      return NextResponse.json({ error: "signatureEncoding must be base64" }, { status: 400 });
    }

    const out = await createOrRotatePacificaAgent({
      account,
      masterSignature,
      timestamp: timeStamp,
    });

    return NextResponse.json({
      success: true,
      account,
      agentWallet: out.agentPublicKey,
      message: "Pacifica agent wallet is ready.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to set up agent wallet", details: message }, { status: 500 });
  }
}
