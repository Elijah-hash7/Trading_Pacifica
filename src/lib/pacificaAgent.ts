import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/db";
import { pacifica } from "@/lib/pacifica";
import { decryptPacificaAgentSecret, encryptPacificaAgentSecret } from "@/lib/pacificaAgentCrypto";

function isSolanaAddress(addr: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function verifyMasterSignature(opts: { account: string; message: string; signatureBase64: string }) {
  const pubkey = new PublicKey(opts.account);
  const messageBytes = new TextEncoder().encode(opts.message);
  const sigBytes = Buffer.from(opts.signatureBase64, "base64");
  if (sigBytes.length !== 64) return false;
  return nacl.sign.detached.verify(messageBytes, new Uint8Array(sigBytes), pubkey.toBytes());
}

export function buildAgentSetupMessage(opts: { account: string; timestamp: string }) {
  return [
    "Pacificast Agent Setup",
    `account:${opts.account}`,
    `timestamp:${opts.timestamp}`,
  ].join("\n");
}

export function buildOrderSignatureMessage(payload: {
  account: string;
  symbol: string;
  amount: string;
  side: string;
  type: string;
  timeStamp: string;
  tick_level?: string;
}) {
  return [
    "Pacificast Order",
    `account:${payload.account}`,
    `symbol:${payload.symbol}`,
    `amount:${payload.amount}`,
    `side:${payload.side}`,
    `type:${payload.type}`,
    `timestamp:${payload.timeStamp}`,
    `tick:${payload.tick_level ?? ""}`,
  ].join("\n");
}

export async function createOrRotatePacificaAgent(opts: {
  account: string;
  masterSignature: string;
  timestamp: string;
}) {
  if (!isSolanaAddress(opts.account)) {
    throw new Error("Invalid Solana account address");
  }

  const keyPair = nacl.sign.keyPair();
  const agentPublicKey = bs58.encode(keyPair.publicKey);
  const agentSecretKey = bs58.encode(keyPair.secretKey);
  const setupMessage = buildAgentSetupMessage({
    account: opts.account,
    timestamp: opts.timestamp,
  });

  const signatureValid = verifyMasterSignature({
    account: opts.account,
    message: setupMessage,
    signatureBase64: opts.masterSignature,
  });

  if (!signatureValid) {
    throw new Error("Master wallet signature verification failed");
  }

  const registerResponse = await pacifica.registerAgentWallet({
    account: opts.account,
    agent_wallet: agentPublicKey,
    timeStamp: opts.timestamp,
    signature: opts.masterSignature,
    signatureEncoding: "base64",
  });

  if (!registerResponse?.success) {
    const reason =
      registerResponse?.error || registerResponse?.details || "Pacifica agent wallet registration failed";
    throw new Error(reason);
  }

  const encrypted = encryptPacificaAgentSecret(agentSecretKey);

  await prisma.pacificaAgent.upsert({
    where: { masterAccount: opts.account },
    update: {
      agentPublicKey,
      encryptedPrivateKey: encrypted.ciphertext,
      iv: encrypted.iv,
      tag: encrypted.tag,
    },
    create: {
      masterAccount: opts.account,
      agentPublicKey,
      encryptedPrivateKey: encrypted.ciphertext,
      iv: encrypted.iv,
      tag: encrypted.tag,
    },
  });

  return { agentPublicKey };
}

export async function signOrderWithAgent(payload: {
  account: string;
  symbol: string;
  amount: string;
  side: string;
  type: string;
  timeStamp: string;
  tick_level?: string;
  leverage?: number;
}) {
  const agent = await prisma.pacificaAgent.findUnique({
    where: { masterAccount: payload.account },
  });

  if (!agent) {
    throw new Error("Pacifica agent not configured for this account. Link and set up agent in Settings.");
  }

  const secretKeyBase58 = decryptPacificaAgentSecret({
    ciphertext: agent.encryptedPrivateKey,
    iv: agent.iv,
    tag: agent.tag,
  });
  const secretKey = bs58.decode(secretKeyBase58);
  if (secretKey.length !== 64) {
    throw new Error("Invalid agent key material");
  }

  const signatureMessage = buildOrderSignatureMessage(payload);
  const messageBytes = new TextEncoder().encode(signatureMessage);
  const signatureBytes = nacl.sign.detached(messageBytes, secretKey);
  const signature = Buffer.from(signatureBytes).toString("base64");

  return {
    agentPublicKey: agent.agentPublicKey,
    signedPayload: {
      ...payload,
      signature,
      signatureEncoding: "base64",
    },
  };
}
