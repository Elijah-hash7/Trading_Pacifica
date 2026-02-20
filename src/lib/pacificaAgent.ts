import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/db";
import { decryptPacificaAgentSecret, encryptPacificaAgentSecret } from "@/lib/pacificaAgentCrypto";

const AGENT_SETUP_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;
const AGENT_CREATE_CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000;

function isSolanaAddress(addr: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function assertSolanaAddress(addr: string, field: string) {
  if (!isSolanaAddress(addr)) {
    throw new Error(`Invalid Solana ${field} address`);
  }
}

export function buildAgentSaveMessage(opts: { account: string; timestamp: number }) {
  return ["Pacificast Agent Key Save", `account:${opts.account}`, `timestamp:${String(opts.timestamp)}`].join("\n");
}

export function buildAgentCreateMessage(opts: { account: string; agentPublicKey: string; timestamp: number }) {
  return [
    "Register agent wallet",
    `account:${opts.account}`,
    `agent:${opts.agentPublicKey}`,
    `timestamp:${String(opts.timestamp)}`,
  ].join("\n");
}

export function verifyMasterSignature(opts: { account: string; message: string; signature: string }) {
  const pubkey = new PublicKey(opts.account);
  const messageBytes = new TextEncoder().encode(opts.message);
  const sigBytes = bs58.decode(opts.signature);
  if (sigBytes.length !== 64) return false;
  return nacl.sign.detached.verify(messageBytes, new Uint8Array(sigBytes), pubkey.toBytes());
}

function normalizeSecretKeyBase58(agentPrivateKey: string, expectedPublicKey: string) {
  const decoded = bs58.decode(agentPrivateKey.trim());

  if (decoded.length === 64) {
    const keyPair = nacl.sign.keyPair.fromSecretKey(decoded);
    const derivedPublic = bs58.encode(keyPair.publicKey);
    if (derivedPublic !== expectedPublicKey) {
      throw new Error("agentPrivateKey does not match agentPublicKey");
    }
    return bs58.encode(decoded);
  }

  if (decoded.length === 32) {
    const keyPair = nacl.sign.keyPair.fromSeed(decoded);
    const derivedPublic = bs58.encode(keyPair.publicKey);
    if (derivedPublic !== expectedPublicKey) {
      throw new Error("agentPrivateKey does not match agentPublicKey");
    }
    return bs58.encode(keyPair.secretKey);
  }

  throw new Error("agentPrivateKey must decode to 32-byte seed or 64-byte secret key");
}

async function upsertPacificaAgentKeyMaterial(opts: {
  account: string;
  agentPublicKey: string;
  agentPrivateKey: string;
}) {
  assertSolanaAddress(opts.account, "account");
  assertSolanaAddress(opts.agentPublicKey, "agentPublicKey");
  const normalizedSecret = normalizeSecretKeyBase58(opts.agentPrivateKey, opts.agentPublicKey);
  const encrypted = encryptPacificaAgentSecret(normalizedSecret);

  await prisma.pacificaAgent.upsert({
    where: { masterAccount: opts.account },
    update: {
      agentPublicKey: opts.agentPublicKey,
      encryptedPrivateKey: encrypted.ciphertext,
      iv: encrypted.iv,
      tag: encrypted.tag,
    },
    create: {
      masterAccount: opts.account,
      agentPublicKey: opts.agentPublicKey,
      encryptedPrivateKey: encrypted.ciphertext,
      iv: encrypted.iv,
      tag: encrypted.tag,
    },
  });
}

export async function savePacificaAgentKey(opts: {
  account: string;
  agentPublicKey: string;
  agentPrivateKey: string;
  masterSignature: string;
  timestamp: number;
}) {
  assertSolanaAddress(opts.account, "account");
  assertSolanaAddress(opts.agentPublicKey, "agentPublicKey");

  if (typeof opts.timestamp !== "number" || !Number.isFinite(opts.timestamp)) {
    throw new Error("Valid timestamp is required");
  }
  if (!opts.masterSignature?.trim()) {
    throw new Error("Master wallet signature is required");
  }

  const ageMs = Math.abs(Date.now() - opts.timestamp);
  if (ageMs > AGENT_SETUP_SIGNATURE_MAX_AGE_MS) {
    throw new Error("Agent setup signature expired. Please sign again.");
  }

  const message = buildAgentSaveMessage({
    account: opts.account,
    timestamp: opts.timestamp,
  });
  const valid = verifyMasterSignature({
    account: opts.account,
    message,
    signature: opts.masterSignature,
  });
  if (!valid) {
    throw new Error("Master wallet signature verification failed");
  }

  await upsertPacificaAgentKeyMaterial({
    account: opts.account,
    agentPublicKey: opts.agentPublicKey,
    agentPrivateKey: opts.agentPrivateKey,
  });

  return { account: opts.account, agentPublicKey: opts.agentPublicKey };
}

type AgentCreateChallengePayload = {
  account: string;
  agentPublicKey: string;
  agentPrivateKey: string;
  timestamp: number;
};

export function createAgentCreateChallengeToken(payload: AgentCreateChallengePayload) {
  const encoded = encryptPacificaAgentSecret(JSON.stringify(payload));
  return Buffer.from(JSON.stringify(encoded)).toString("base64url");
}

export function parseAgentCreateChallengeToken(challenge: string): AgentCreateChallengePayload {
  if (!challenge?.trim()) {
    throw new Error("Missing agent create challenge");
  }

  let encrypted: { ciphertext: string; iv: string; tag: string };
  try {
    encrypted = JSON.parse(Buffer.from(challenge, "base64url").toString("utf8")) as {
      ciphertext: string;
      iv: string;
      tag: string;
    };
  } catch {
    throw new Error("Invalid agent create challenge");
  }

  const raw = decryptPacificaAgentSecret(encrypted);
  let payload: AgentCreateChallengePayload;
  try {
    payload = JSON.parse(raw) as AgentCreateChallengePayload;
  } catch {
    throw new Error("Invalid agent create challenge payload");
  }

  assertSolanaAddress(payload.account, "account");
  assertSolanaAddress(payload.agentPublicKey, "agentPublicKey");

  if (typeof payload.timestamp !== "number" || !Number.isFinite(payload.timestamp)) {
    throw new Error("Invalid agent create challenge timestamp");
  }

  const ageMs = Math.abs(Date.now() - payload.timestamp);
  if (ageMs > AGENT_CREATE_CHALLENGE_MAX_AGE_MS) {
    throw new Error("Agent create challenge expired. Please retry.");
  }

  normalizeSecretKeyBase58(payload.agentPrivateKey, payload.agentPublicKey);
  return payload;
}

export async function saveGeneratedPacificaAgentKey(opts: {
  account: string;
  agentPublicKey: string;
  agentPrivateKey: string;
}) {
  await upsertPacificaAgentKeyMaterial(opts);
  return { account: opts.account, agentPublicKey: opts.agentPublicKey };
}

export async function getSavedPacificaAgentPublicKey(account: string) {
  assertSolanaAddress(account, "account");
  try {
    const agent = await prisma.pacificaAgent.findUnique({
      where: { masterAccount: account },
      select: { agentPublicKey: true },
    });
    return agent?.agentPublicKey ?? null;
  } catch (error) {
    console.warn("[getSavedPacificaAgentPublicKey] Database error (table may not exist):", error);
    return null;
  }
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    const out: Record<string, unknown> = {};
    for (const [key, nested] of entries) {
      out[key] = sortKeysDeep(nested);
    }
    return out;
  }

  return value;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(sortKeysDeep(value));
}

type SignatureHeader = {
  timestamp: number;
  expiry_window: number;
  type: string;
};

export function buildPacificaSignatureHeader(opts: { timestamp: number; type: string; expiryWindowMs?: number }): SignatureHeader {
  return {
    timestamp: opts.timestamp,
    expiry_window: opts.expiryWindowMs ?? 30_000,
    type: opts.type,
  };
}

function signDeterministicPayload(opts: {
  payload: Record<string, unknown>;
  header: SignatureHeader;
  secretKey: Uint8Array;
}) {
  const payloadWithHeader = {
    ...opts.payload,
    signature_header: opts.header,
  };

  const signatureMaterial = canonicalJson(payloadWithHeader);
  const signatureBytes = nacl.sign.detached(new TextEncoder().encode(signatureMaterial), opts.secretKey);
  const signature = bs58.encode(signatureBytes);

  return {
    signature,
    payload: {
      ...payloadWithHeader,
      signature,
    },
  };
}

async function getAgentForAccount(account: string) {
  const agent = await prisma.pacificaAgent.findUnique({ where: { masterAccount: account } });
  if (!agent) {
    throw new Error("Pacifica agent not configured for this account. Save an API Agent key in Settings.");
  }

  const secretKeyBase58 = decryptPacificaAgentSecret({
    ciphertext: agent.encryptedPrivateKey,
    iv: agent.iv,
    tag: agent.tag,
  });
  const secretKey = bs58.decode(secretKeyBase58);
  if (secretKey.length !== 64) {
    throw new Error("Invalid stored Pacifica agent key material");
  }

  return {
    agentPublicKey: agent.agentPublicKey,
    secretKey,
  };
}

function getOrderSignatureType(orderType: string) {
  return orderType === "limit" ? "create_order" : "create_market_order";
}

export async function signOrderWithAgent(payload: {
  account: string;
  symbol: string;
  amount: string;
  side: string;
  type: string;
  timestamp: number;
  tick_level?: string;
  leverage?: number;
}) {
  const { agentPublicKey, secretKey } = await getAgentForAccount(payload.account);

  const signatureHeader = buildPacificaSignatureHeader({
    timestamp: payload.timestamp,
    type: getOrderSignatureType(payload.type),
  });

  const { signature, payload: signedPayload } = signDeterministicPayload({
    payload,
    header: signatureHeader,
    secretKey,
  });

  return {
    agentPublicKey,
    signature,
    signatureHeader,
    signedPayload,
  };
}

export async function signWithdrawWithAgent(payload: {
  account: string;
  amount: string;
  destination: string;
  timestamp: number;
}) {
  const { agentPublicKey, secretKey } = await getAgentForAccount(payload.account);

  const signatureHeader = buildPacificaSignatureHeader({
    timestamp: payload.timestamp,
    type: "withdraw",
  });

  const { signature, payload: signedPayload } = signDeterministicPayload({
    payload,
    header: signatureHeader,
    secretKey,
  });

  return {
    agentPublicKey,
    signature,
    signatureHeader,
    signedPayload,
  };
}
