import { NextResponse } from "next/server";
import axios from "axios";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { pacifica } from "@/lib/pacifica";
import {
  buildAgentCreateMessage,
  createAgentCreateChallengeToken,
  parseAgentCreateChallengeToken,
  saveGeneratedPacificaAgentKey,
  verifyMasterSignature,
} from "@/lib/pacificaAgent";

export async function POST(request: Request) {
  function isSolanaAddress(addr: string) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
  }

  try {
    if (!process.env.PACIFICA_AGENT_KEY_SECRET || process.env.PACIFICA_AGENT_KEY_SECRET.trim().length < 16) {
      return NextResponse.json(
        { error: "Server missing PACIFICA_AGENT_KEY_SECRET (min 16 chars)." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const account = typeof body?.account === "string" ? body.account : "";
    const signature = typeof body?.signature === "string" ? body.signature : "";
    const challenge = typeof body?.challenge === "string" ? body.challenge : "";

    if (!account) {
      return NextResponse.json({ error: "account is required" }, { status: 400 });
    }
    if (!isSolanaAddress(account)) {
      return NextResponse.json({ error: "Invalid Solana account address" }, { status: 400 });
    }

    // Phase 1: init challenge and signing message.
    if (!signature && !challenge) {
      const keypair = nacl.sign.keyPair();
      const agentPublicKey = bs58.encode(keypair.publicKey);
      const agentPrivateKey = bs58.encode(keypair.secretKey);
      const timestamp = Date.now();
      const message = buildAgentCreateMessage({
        account,
        agentPublicKey,
        timestamp,
      });
      const outChallenge = createAgentCreateChallengeToken({
        account,
        agentPublicKey,
        agentPrivateKey,
        timestamp,
      });

      return NextResponse.json({
        success: true,
        phase: "sign",
        account,
        agentPublicKey,
        timestamp,
        message,
        challenge: outChallenge,
      });
    }

    // Phase 2: verify signature, register agent on Pacifica, then persist encrypted key.
    if (!signature || !challenge) {
      return NextResponse.json(
        { error: "Both signature and challenge are required for agent creation completion." },
        { status: 400 }
      );
    }

    const payload = parseAgentCreateChallengeToken(challenge);
    if (payload.account !== account) {
      return NextResponse.json({ error: "Challenge account does not match request account." }, { status: 400 });
    }

    const message = buildAgentCreateMessage({
      account: payload.account,
      agentPublicKey: payload.agentPublicKey,
      timestamp: payload.timestamp,
    });
    const valid = verifyMasterSignature({
      account: payload.account,
      message,
      signature,
    });
    if (!valid) {
      return NextResponse.json({ error: "Master wallet signature verification failed" }, { status: 401 });
    }

    const messageBase58 = bs58.encode(new TextEncoder().encode(message));
    const registerResponse = await pacifica.registerAgentWallet({
      account: payload.account,
      agent_wallet: payload.agentPublicKey,
      signature,
      message: messageBase58,
      timestamp: payload.timestamp,
    });

    if (!registerResponse?.success) {
      const details =
        registerResponse?.error || registerResponse?.details || "Pacifica agent wallet registration failed";
      return NextResponse.json({ error: "Failed to register agent wallet on Pacifica", details }, { status: 400 });
    }

    const saved = await saveGeneratedPacificaAgentKey({
      account: payload.account,
      agentPublicKey: payload.agentPublicKey,
      agentPrivateKey: payload.agentPrivateKey,
    });

    return NextResponse.json({
      success: true,
      phase: "completed",
      account: saved.account,
      agentPublicKey: saved.agentPublicKey,
      message: "Agent wallet created, registered, and saved.",
    });
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 404) {
        return NextResponse.json(
          {
            error: "Pacifica account not found",
            action: "CREATE_PACIFICA_ACCOUNT",
            details: "You need to deposit USDC at app.pacifica.fi first before creating an agent wallet.",
          },
          { status: 404 }
        );
      }
      const details = error.response?.data?.details ?? error.response?.data?.error ?? error.message;
      if (typeof status === "number" && status >= 400 && status < 600) {
        return NextResponse.json({ error: "Failed to create Pacifica agent", details }, { status });
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to create Pacifica agent", details: message }, { status: 500 });
  }
}
