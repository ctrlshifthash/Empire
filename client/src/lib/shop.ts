// Client side of the token shop. Fetches the catalog/config from the server,
// builds the SPL-token payment transaction (player ATA -> treasury ATA), and
// posts the resulting signature back for the server to verify & grant. The
// actual signing happens in the component via Privy's useSignAndSendTransaction.
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { SOLANA_RPC } from "./web3";
import { SERVER_URL } from "./config";

export type ShopCategory = "pack" | "boost" | "army" | "trait" | "cosmetic";

export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  icon: string;
  category: ShopCategory;
  price: number; // whole tokens
}

export interface ShopConfig {
  configured: boolean;
  mint: string;
  treasury: string | null;
  decimals: number;
  items: ShopItem[];
}

export async function fetchShopConfig(): Promise<ShopConfig | null> {
  try {
    const r = await fetch(`${SERVER_URL}/api/shop/config`).then((x) => x.json());
    return r?.ok ? (r as ShopConfig) : null;
  } catch {
    return null;
  }
}

// Build the (unsigned) payment transaction, serialized for Privy to sign+send.
// Includes an idempotent create of the treasury's token account so the first
// purchase still works if the treasury has never held the token.
export async function buildPaymentTx(cfg: ShopConfig, buyer: string, priceTokens: number): Promise<Uint8Array> {
  const conn = new Connection(SOLANA_RPC, "confirmed");
  const mint = new PublicKey(cfg.mint);
  const buyerPk = new PublicKey(buyer);
  const treasuryPk = new PublicKey(cfg.treasury as string);
  const buyerAta = getAssociatedTokenAddressSync(mint, buyerPk);
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasuryPk);
  const amount = BigInt(Math.round(priceTokens)) * 10n ** BigInt(cfg.decimals);

  const tx = new Transaction();
  tx.add(createAssociatedTokenAccountIdempotentInstruction(buyerPk, treasuryAta, treasuryPk, mint));
  tx.add(createTransferCheckedInstruction(buyerAta, mint, treasuryAta, buyerPk, amount, cfg.decimals));
  tx.feePayer = buyerPk;
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
}

export interface BuyResponse {
  ok: boolean;
  error?: string;
  item?: string;
}

export async function postPurchase(address: string, signature: string, itemId: string): Promise<BuyResponse> {
  try {
    return await fetch(`${SERVER_URL}/api/shop/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, signature, itemId }),
    }).then((x) => x.json());
  } catch {
    return { ok: false, error: "Network error." };
  }
}
