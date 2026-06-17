// Client side of the coin exchange — sell in-game coins for the $RUMBLE token.
// Buyers pay the seller in $RUMBLE (95%) and burn the fee (5%); the server
// verifies on-chain, then credits the coins.
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  createBurnCheckedInstruction,
} from "@solana/spl-token";
import { SOLANA_RPC } from "./web3";
import { SERVER_URL } from "./config";
import type { CoinListingPublic } from "@shared/types";

export interface ExPayment {
  mint: string;
  seller: string;
  sellerBase: string;
  burnBase: string;
  decimals: number;
}

export async function fetchCoinListings(): Promise<CoinListingPublic[]> {
  try {
    const r = await fetch(`${SERVER_URL}/api/exchange/listings`).then((x) => x.json());
    return r?.ok ? r.listings : [];
  } catch {
    return [];
  }
}

export async function reserveCoin(listingId: string, address: string): Promise<{ ok: boolean; error?: string; payment?: ExPayment }> {
  try {
    return await fetch(`${SERVER_URL}/api/exchange/${listingId}/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    }).then((x) => x.json());
  } catch {
    return { ok: false, error: "Network error." };
  }
}

export async function postBuyCoins(listingId: string, address: string, signature: string): Promise<{ ok: boolean; error?: string }> {
  try {
    return await fetch(`${SERVER_URL}/api/exchange/${listingId}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, signature }),
    }).then((x) => x.json());
  } catch {
    return { ok: false, error: "Network error." };
  }
}

export async function buildExchangeTx(p: ExPayment, buyer: string): Promise<Uint8Array> {
  const conn = new Connection(SOLANA_RPC, "confirmed");
  const mint = new PublicKey(p.mint);
  const buyerPk = new PublicKey(buyer);
  const sellerPk = new PublicKey(p.seller);
  const buyerAta = getAssociatedTokenAddressSync(mint, buyerPk);
  const sellerAta = getAssociatedTokenAddressSync(mint, sellerPk);

  const tx = new Transaction();
  tx.add(createAssociatedTokenAccountIdempotentInstruction(buyerPk, sellerAta, sellerPk, mint));
  if (BigInt(p.sellerBase) > 0n) tx.add(createTransferCheckedInstruction(buyerAta, mint, sellerAta, buyerPk, BigInt(p.sellerBase), p.decimals));
  if (BigInt(p.burnBase) > 0n) tx.add(createBurnCheckedInstruction(buyerAta, mint, buyerPk, BigInt(p.burnBase), p.decimals));
  tx.feePayer = buyerPk;
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
}
