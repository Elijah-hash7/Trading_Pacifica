import { NextResponse } from "next/server";
import { pacifica } from "@/lib/pacifica";
import axios from "axios";
import { getSavedPacificaAgentPublicKey } from "@/lib/pacificaAgent";

function isSolanaAddress(addr: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const account = searchParams.get("account");

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

    const [agentResponse, savedAgentPublicKey] = await Promise.all([
      pacifica.getAgentWallets(account),
      getSavedPacificaAgentPublicKey(account),
    ]);
    const pacificaAgentsRaw = agentResponse?.data ?? agentResponse ?? [];
    const pacificaAgents = Array.isArray(pacificaAgentsRaw)
      ? pacificaAgentsRaw.filter((v): v is string => typeof v === "string")
      : [];
    const pacificaAgentPublicKey = pacificaAgents[0] ?? null;
    const isAgentReady = Boolean(savedAgentPublicKey && pacificaAgents.includes(savedAgentPublicKey));

    return NextResponse.json({
      pacificaAgents,
      pacificaAgentPublicKey,
      savedAgentPublicKey,
      isAgentReady,
      readyReason: isAgentReady
        ? "agent_key_verified_and_saved"
        : savedAgentPublicKey
          ? "saved_key_not_found_on_pacifica"
          : "agent_key_not_saved",
    });

  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const details = error.response?.data?.details ?? error.response?.data?.error ?? error.message;

      console.error("[pacifica-agent-get upstream]", { status, details });

      if (status === 404) {
        const { searchParams } = new URL(request.url);
        const account = searchParams.get("account");
        const savedAgentPublicKey =
          account && isSolanaAddress(account) ? await getSavedPacificaAgentPublicKey(account) : null;
        return NextResponse.json({
          pacificaAgents: [],
          pacificaAgentPublicKey: null,
          savedAgentPublicKey,
          isAgentReady: false,
          readyReason: savedAgentPublicKey ? "saved_key_not_visible_on_pacifica" : "agent_key_not_saved",
        });
      }

      if (typeof status === "number" && status >= 400 && status < 600) {
        return NextResponse.json(
          { error: "Failed to get agent wallets", details }, 
          { status }
        );
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("[pacifica-agent-get internal]", message);
    return NextResponse.json(
      { error: "Failed to get agent wallets", details: message }, 
      { status: 500 }
    );
  }
}
