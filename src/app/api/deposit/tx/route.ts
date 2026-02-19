import { NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOL_RPC_URL || "https://api.mainnet-beta.solana.com";
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1VwRkjWvj4vyPvU2K1bqGf3w8J");
const USDC_DECIMALS = 6;

function isSolanaAddress(addr: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function toTokenAmount(amount: string) {
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 10 ** USDC_DECIMALS);
}

function buildTransferCheckedInstruction(opts: {
  sourceAta: PublicKey;
  destinationAta: PublicKey;
  owner: PublicKey;
  amount: number;
}) {
  // SPL Token instruction layout: [12, amount(u64 le), decimals(u8)]
  const data = Buffer.alloc(10);
  data.writeUInt8(12, 0);
  data.writeBigUInt64LE(BigInt(opts.amount), 1);
  data.writeUInt8(USDC_DECIMALS, 9);

  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: opts.sourceAta, isSigner: false, isWritable: true },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: opts.destinationAta, isSigner: false, isWritable: true },
      { pubkey: opts.owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}

function deriveAta(owner: PublicKey, mint: PublicKey) {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const walletAddress = typeof body?.walletAddress === "string" ? body.walletAddress : "";
    const amountRaw = typeof body?.amount === "string" ? body.amount : String(body?.amount ?? "");
    const amountBaseUnits = toTokenAmount(amountRaw);

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required", code: "WALLET_REQUIRED" }, { status: 400 });
    }
    if (!isSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid Solana wallet address", code: "INVALID_WALLET" }, { status: 400 });
    }
    if (!amountBaseUnits) {
      return NextResponse.json({ error: "Invalid deposit amount", code: "INVALID_AMOUNT" }, { status: 400 });
    }

    const depositVault = process.env.PACIFICA_DEPOSIT_USDC_VAULT;
    if (!depositVault || !isSolanaAddress(depositVault)) {
      return NextResponse.json(
        {
          error:
            "Server missing PACIFICA_DEPOSIT_USDC_VAULT. Set a valid Solana USDC destination account owner.",
          code: "DEPOSIT_VAULT_NOT_CONFIGURED",
        },
        { status: 500 }
      );
    }

    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    const owner = new PublicKey(walletAddress);
    const vaultOwner = new PublicKey(depositVault);
    const sourceAta = deriveAta(owner, USDC_MINT);
    const destinationAta = deriveAta(vaultOwner, USDC_MINT);

    const [sourceInfo, ownerBalance] = await Promise.all([
      connection.getTokenAccountBalance(sourceAta).catch(() => null),
      connection.getBalance(owner),
    ]);
    const userUsdc = Number.parseFloat(sourceInfo?.value?.uiAmountString ?? "0");
    const requestedUi = amountBaseUnits / 10 ** USDC_DECIMALS;

    if (userUsdc < requestedUi) {
      return NextResponse.json(
        { error: "Insufficient USDC balance for deposit", code: "INSUFFICIENT_USDC", details: { userUsdc, requestedUi } },
        { status: 400 }
      );
    }

    // very small floor to catch zero-SOL wallets before send
    if (ownerBalance < 5000) {
      return NextResponse.json(
        { error: "Insufficient SOL for network fees", code: "INSUFFICIENT_SOL_FEES" },
        { status: 400 }
      );
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction();
    tx.feePayer = owner;
    tx.recentBlockhash = blockhash;

    // If destination ATA does not exist yet, create it so user transfer succeeds.
    const destinationExists = await connection.getAccountInfo(destinationAta);
    if (!destinationExists) {
      tx.add(
        new TransactionInstruction({
          programId: ASSOCIATED_TOKEN_PROGRAM_ID,
          keys: [
            { pubkey: owner, isSigner: true, isWritable: true },
            { pubkey: destinationAta, isSigner: false, isWritable: true },
            { pubkey: vaultOwner, isSigner: false, isWritable: false },
            { pubkey: USDC_MINT, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          ],
          data: Buffer.alloc(0),
        })
      );
    }

    tx.add(
      buildTransferCheckedInstruction({
        sourceAta,
        destinationAta,
        owner,
        amount: amountBaseUnits,
      })
    );

    return NextResponse.json({
      success: true,
      txBase64: tx.serialize({ requireAllSignatures: false }).toString("base64"),
      lastValidBlockHeight,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to build deposit transaction", code: "DEPOSIT_TX_BUILD_FAILED", details: message },
      { status: 500 }
    );
  }
}
