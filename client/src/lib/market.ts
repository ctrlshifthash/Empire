// Client side of the player marketplace. Browse listings, and buy by paying the
// seller (+ treasury fee) wallet-to-wallet in SOL or USDC. The server returns the
// exact amounts/recipients to pay; we build the transaction, Privy signs it, and
// the server verifies it on-chain before transferring the item.
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { SOLANA_RPC } from "./web3";
import { SERVER_URL } from "./config";
import type { ListingPublic } from "@shared/types";

export interface MarketConfig {
  treasury: string | null;
  usdcMint: string;
  feePct: number;
  items: { id: string; name: string; icon: string; rarity: string; maxSupply: number; desc: string }[];
}

export interface PaymentParams {
  currency: "SOL" | "USDC";
  seller: string;
  treasury: string;
  sellerBase: string;
  feeBase: string;
  decimals: number;
  usdcMint?: string;
}

export async function fetchMarketConfig(): Promise<MarketConfig | null> {
  try {
    const r = await fetch(`${SERVER_URL}/api/market/config`).then((x) => x.json());
    return r?.ok ? r : null;
  } catch {
    return null;
  }
}

export async function fetchListings(): Promise<ListingPublic[]> {
  try {
    const r = await fetch(`${SERVER_URL}/api/market/listings`).then((x) => x.json());
    return r?.ok ? r.listings : [];
  } catch {
    return [];
  }
}

export async function reserve(listingId: string, address: string): Promise<{ ok: boolean; error?: string; payment?: PaymentParams }> {
  try {
    return await fetch(`${SERVER_URL}/api/market/${listingId}/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    }).then((x) => x.json());
  } catch {
    return { ok: false, error: "Network error." };
  }
}

export async function postBuy(listingId: string, address: string, signature: string): Promise<{ ok: boolean; error?: string }> {
  try {
    return await fetch(`${SERVER_URL}/api/market/${listingId}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, signature }),
    }).then((x) => x.json());
  } catch {
    return { ok: false, error: "Network error." };
  }
}

// Build the (unsigned) payment transaction for Privy to sign + send.
export async function buildPaymentTx(p: PaymentParams, buyer: string): Promise<Uint8Array> {
  const conn = new Connection(SOLANA_RPC, "confirmed");
  const buyerPk = new PublicKey(buyer);
  const sellerPk = new PublicKey(p.seller);
  const treasuryPk = new PublicKey(p.treasury);
  const tx = new Transaction();

  if (p.currency === "SOL") {
    tx.add(SystemProgram.transfer({ fromPubkey: buyerPk, toPubkey: sellerPk, lamports: Number(p.sellerBase) }));
    tx.add(SystemProgram.transfer({ fromPubkey: buyerPk, toPubkey: treasuryPk, lamports: Number(p.feeBase) }));
  } else {
    const mint = new PublicKey(p.usdcMint as string);
    const buyerAta = getAssociatedTokenAddressSync(mint, buyerPk);
    const sellerAta = getAssociatedTokenAddressSync(mint, sellerPk);
    const treasuryAta = getAssociatedTokenAddressSync(mint, treasuryPk);
    tx.add(createAssociatedTokenAccountIdempotentInstruction(buyerPk, sellerAta, sellerPk, mint));
    tx.add(createAssociatedTokenAccountIdempotentInstruction(buyerPk, treasuryAta, treasuryPk, mint));
    tx.add(createTransferCheckedInstruction(buyerAta, mint, sellerAta, buyerPk, BigInt(p.sellerBase), p.decimals));
    tx.add(createTransferCheckedInstruction(buyerAta, mint, treasuryAta, buyerPk, BigInt(p.feeBase), p.decimals));
  }

  tx.feePayer = buyerPk;
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
}
