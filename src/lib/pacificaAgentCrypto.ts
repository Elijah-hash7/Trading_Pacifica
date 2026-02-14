import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function getSecret() {
  const secret = process.env.PACIFICA_AGENT_KEY_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error("PACIFICA_AGENT_KEY_SECRET is required and must be at least 16 characters.");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptPacificaAgentSecret(plainText: string) {
  const iv = randomBytes(12);
  const key = getSecret();
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptPacificaAgentSecret(opts: { ciphertext: string; iv: string; tag: string }) {
  const key = getSecret();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(opts.iv, "base64"));
  decipher.setAuthTag(Buffer.from(opts.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(opts.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
