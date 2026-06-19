// Client side of the player marketplace. Browse listings, and buy by paying the
// seller 95% in $RUMBLE + burning 5% — USD-priced, settled at the live token
// rate (same model as the Coin Exchange). The server returns the exact $RUMBLE
// amounts; we build the tx, the wallet signs, and the server verifies on-chain
// before transferring the item.
import type { Transaction } from "@solana/web3.js";
import { SERVER_URL } from "./config";
import type { ListingPublic } from "@shared/types";
import { buildExchangeTx, type ExPayment } from "./exchange";

export async function fetchListings(): Promise<ListingPublic[]> {
  try {
    const r = await fetch(`${SERVER_URL}/api/market/listings`).then((x) => x.json());
    return r?.ok ? r.listings : [];
  } catch {
    return [];
  }
}

export async function reserve(listingId: string, address: string): Promise<{ ok: boolean; error?: string; payment?: ExPayment }> {
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

// Build the (unsigned) $RUMBLE payment tx — 95% to the seller, 5% burned.
export async function buildPaymentTx(p: ExPayment, buyer: string): Promise<Transaction> {
  return buildExchangeTx(p, buyer);
}
