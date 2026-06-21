// ─────────────────────────────────────────────────────────────────────────────
// Coin Exchange — the grind→token cash-out (Kintara's Gold↔$KINS loop). Players
// sell in-game COINS for the $RUMBLE token, P2P. The buyer pays the seller in
// $RUMBLE on-chain (95%) and BURNS the rest (5%, deflationary); the server
// verifies the payment, then credits the coins. No platform custody.
// ─────────────────────────────────────────────────────────────────────────────
import { PublicKey } from "@solana/web3.js";
import type { CoinListing, CoinListingPublic } from "../../shared/types.ts";
import { state, scheduleSave, pushActivity } from "./store.ts";
import { sharedRpc, tokenMint } from "./rewards.ts";
import { rumbleUsdPrice } from "./price.ts";
import { now, uid } from "./util.ts";

const RESERVE_MS = 3 * 60 * 1000;
export const EXCHANGE_BURN_PCT = 5; // % of the $RUMBLE price that's burned

export const exchangeLive = (): boolean => tokenMint().length > 0;

let cachedDec: number | null = null;
export async function rumbleDecimals(): Promise<number> {
  if (cachedDec != null) return cachedDec;
  const sup = await sharedRpc().getTokenSupply(new PublicKey(tokenMint()));
  cachedDec = sup.value.decimals;
  return cachedDec;
}

export interface ExResult {
  ok: boolean;
  error?: string;
  members?: string[];
}

export function listCoins(empireId: string, sellerWallet: string | undefined, rawCoins: number, rawUsd: number): ExResult {
  if (!sellerWallet || sellerWallet.includes("@") || sellerWallet.startsWith("did:"))
    return { ok: false, error: "Connect a Solana wallet to sell coins for $RUMBLE." };
  const e = state.empires[empireId];
  if (!e) return { ok: false, error: "No empire." };
  const coinAmount = Math.floor(Number(rawCoins) || 0);
  const usdPrice = Math.round((Number(rawUsd) || 0) * 100) / 100; // cent precision
  if (coinAmount <= 0) return { ok: false, error: "Enter a coin amount." };
  if (e.coins < coinAmount) return { ok: false, error: "You don't have that many coins." };
  if (!(usdPrice > 0)) return { ok: false, error: "Set a price in USD." };
  e.coins -= coinAmount; // escrow
  const id = uid("clist_");
  state.coinListings[id] = {
    id,
    sellerId: empireId,
    sellerName: e.name,
    sellerWallet,
    coinAmount,
    usdPrice,
    status: "active",
    createdAt: now(),
  };
  pushActivity("coin", "listed", `${e.name} listed ${coinAmount.toLocaleString()} coins for $${usdPrice.toFixed(2)}`);
  scheduleSave(0);
  return { ok: true, members: [empireId] };
}

export function delistCoins(empireId: string, listingId: string): ExResult {
  const l = state.coinListings[listingId];
  if (!l || l.status !== "active") return { ok: false, error: "Listing not found." };
  if (l.sellerId !== empireId) return { ok: false, error: "Not your listing." };
  if (l.reservedBy && (l.reservedUntil ?? 0) > now()) return { ok: false, error: "A buyer is paying — try again shortly." };
  const e = state.empires[empireId];
  if (e) e.coins += l.coinAmount; // refund
  delete state.coinListings[listingId];
  scheduleSave(0);
  return { ok: true, members: [empireId] };
}

// Convert a USD price to on-chain $RUMBLE base units at the live token price,
// split (100 - burnPct)% to the recipient / burnPct% burned. Defaults to the 5%
// market burn; callers (e.g. character sales) can pass a different split.
export function amountsFromUsd(usdPrice: number, rumbleUsd: number, dec: number, burnPct: number = EXCHANGE_BURN_PCT): { sellerBase: bigint; burnBase: bigint; rumbleAmount: number } {
  const rumbleAmount = usdPrice / rumbleUsd; // $RUMBLE tokens (fractional)
  const totalBase = BigInt(Math.round(rumbleAmount * 10 ** dec));
  const burnBase = (totalBase * BigInt(Math.round(burnPct))) / 100n;
  return { sellerBase: totalBase - burnBase, burnBase, rumbleAmount };
}

export async function reserveCoinListing(listingId: string, buyer: string): Promise<{
  ok: boolean;
  error?: string;
  payment?: { mint: string; seller: string; sellerBase: string; burnBase: string; decimals: number; rumbleAmount: number };
}> {
  const l = state.coinListings[listingId];
  if (!l || l.status !== "active") return { ok: false, error: "That listing is gone." };
  if (l.reservedBy && l.reservedBy !== buyer && (l.reservedUntil ?? 0) > now())
    return { ok: false, error: "Someone is buying this right now — try again in a moment." };
  const rumbleUsd = await rumbleUsdPrice();
  if (!rumbleUsd) return { ok: false, error: "$RUMBLE price unavailable — try again in a moment." };
  const dec = await rumbleDecimals();
  const { sellerBase, burnBase, rumbleAmount } = amountsFromUsd(l.usdPrice, rumbleUsd, dec);
  // lock the $RUMBLE amount for the reservation so the price can't move mid-buy
  l.reservedBy = buyer;
  l.reservedUntil = now() + RESERVE_MS;
  l.reservedSellerBase = sellerBase.toString();
  l.reservedBurnBase = burnBase.toString();
  scheduleSave();
  return {
    ok: true,
    payment: { mint: tokenMint(), seller: l.sellerWallet, sellerBase: sellerBase.toString(), burnBase: burnBase.toString(), decimals: dec, rumbleAmount },
  };
}

export async function verifyRumblePayment(signature: string, buyer: string, seller: string, sellerBase: bigint, burnBase: bigint): Promise<boolean> {
  const mint = tokenMint();
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const tx = await sharedRpc().getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
      if (tx && !tx.meta?.err) {
        const keys = tx.transaction.message.accountKeys;
        if (!keys.some((k) => k.signer && k.pubkey.toBase58() === buyer)) return false;
        // seller received the $RUMBLE
        const bal = (arr: typeof tx.meta.preTokenBalances): bigint => {
          const e = (arr ?? []).find((b) => b.owner === seller && b.mint === mint);
          return e ? BigInt(e.uiTokenAmount.amount) : 0n;
        };
        const gained = bal(tx.meta?.postTokenBalances) - bal(tx.meta?.preTokenBalances);
        // buyer burned the fee
        let burned = 0n;
        for (const ix of tx.transaction.message.instructions as Array<{ parsed?: { type?: string; info?: Record<string, unknown> } }>) {
          const p = ix.parsed;
          if (!p || (p.type !== "burnChecked" && p.type !== "burn")) continue;
          if (p.info?.authority !== buyer) continue;
          if (p.type === "burnChecked" && p.info?.mint !== mint) continue;
          const amt = (p.info?.tokenAmount as { amount?: string } | undefined)?.amount ?? (p.info?.amount as string | undefined);
          if (amt) burned += BigInt(amt);
        }
        return gained >= sellerBase && burned >= burnBase;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

export async function buyCoins(listingId: string, buyer: string, signature: string): Promise<ExResult & { buyerEmpireId?: string }> {
  const l = state.coinListings[listingId];
  if (!l || l.status !== "active") return { ok: false, error: "That listing is gone." };
  if (state.exchangeSignatures[signature]) return { ok: false, error: "This payment was already used." };
  const buyerUser = Object.values(state.users).find((u) => u.externalId === buyer);
  const buyerEmpire = buyerUser ? state.empires[buyerUser.empireId] : undefined;
  if (!buyerEmpire) return { ok: false, error: "Open the game signed in with this wallet to receive the coins." };
  if (l.sellerId === buyerEmpire.id) return { ok: false, error: "You can't buy your own listing." };
  // verify against the $RUMBLE amount locked at reserve time (price-stable)
  if (l.reservedBy !== buyer || !l.reservedSellerBase || !l.reservedBurnBase)
    return { ok: false, error: "Your price quote expired — reopen and buy again." };

  const sellerBase = BigInt(l.reservedSellerBase);
  const burnBase = BigInt(l.reservedBurnBase);
  const paid = await verifyRumblePayment(signature, buyer, l.sellerWallet, sellerBase, burnBase);
  if (!paid) return { ok: false, error: "Payment not confirmed — if you were charged, wait a few seconds and retry." };

  buyerEmpire.coins += l.coinAmount; // deliver the coins
  l.status = "sold";
  delete state.coinListings[listingId];
  state.exchangeSignatures[signature] = { listingId, buyer, at: now() };
  pushActivity("coin", "bought", `${buyerEmpire.name} bought ${l.coinAmount.toLocaleString()} coins for $${l.usdPrice.toFixed(2)}`);
  buyerEmpire.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `Bought ${l.coinAmount.toLocaleString()} coins for $${l.usdPrice.toFixed(2)} in $RUMBLE.` });
  if (buyerEmpire.log.length > 60) buyerEmpire.log.length = 60;
  const sellerEmpire = state.empires[l.sellerId];
  if (sellerEmpire) {
    sellerEmpire.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `Sold ${l.coinAmount.toLocaleString()} coins for $${l.usdPrice.toFixed(2)} in $RUMBLE.` });
    if (sellerEmpire.log.length > 60) sellerEmpire.log.length = 60;
  }
  scheduleSave(0);
  return { ok: true, buyerEmpireId: buyerEmpire.id, members: [buyerEmpire.id, l.sellerId] };
}

export function activeCoinListings(): CoinListingPublic[] {
  return Object.values(state.coinListings)
    .filter((l) => l.status === "active")
    .sort((a, b) => a.usdPrice / a.coinAmount - b.usdPrice / b.coinAmount) // cheapest per coin first
    .map((l) => ({
      id: l.id,
      sellerName: l.sellerName,
      coinAmount: l.coinAmount,
      usdPrice: l.usdPrice,
      reserved: !!(l.reservedBy && (l.reservedUntil ?? 0) > now()),
    }));
}

export function expireCoinReservations(): void {
  for (const l of Object.values(state.coinListings)) {
    if (l.reservedBy && (l.reservedUntil ?? 0) <= now()) {
      l.reservedBy = undefined;
      l.reservedUntil = undefined;
      l.reservedSellerBase = undefined;
      l.reservedBurnBase = undefined;
    }
  }
}
