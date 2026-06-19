// ─────────────────────────────────────────────────────────────────────────────
// Token shop. Players pay for in-game items with a real on-chain transfer of the
// project's SPL token to the treasury. The client signs & sends the transfer;
// this module VERIFIES the payment on-chain (correct mint, amount, recipient,
// signer) before granting the item — and never trusts the client's claim. Each
// payment signature can be redeemed exactly once.
// ─────────────────────────────────────────────────────────────────────────────
import { PublicKey } from "@solana/web3.js";
import { SHOP_ITEMS, shopItem, type ShopItem } from "../../shared/gamedata.ts";
import { sharedRpc, tokenMint, treasuryPubkey } from "./rewards.ts";
import { applyShopItem } from "./engine.ts";
import { state, scheduleSave } from "./store.ts";
import { now } from "./util.ts";

export const shopLive = (): boolean => tokenMint().length > 0 && !!treasuryPubkey();

// The mint's on-chain decimals, fetched once and cached (pump.fun tokens are 6,
// but read it so prices convert correctly for any mint).
let cachedDecimals: number | null = null;
async function decimals(): Promise<number> {
  if (cachedDecimals != null) return cachedDecimals;
  const sup = await sharedRpc().getTokenSupply(new PublicKey(tokenMint()));
  cachedDecimals = sup.value.decimals;
  return cachedDecimals;
}

export async function shopConfig() {
  const live = shopLive();
  return {
    ok: true,
    configured: live,
    mint: tokenMint(),
    treasury: treasuryPubkey(),
    decimals: live ? await decimals().catch(() => 6) : 6,
    items: SHOP_ITEMS,
  };
}

// Confirm `signature` moved at least `requiredRaw` base units of the mint INTO
// the treasury's token account, signed by `buyer`. (The treasury burns what it
// collects on a schedule.) Retries patiently because the client may post before
// our RPC node has seen the tx.
async function verifyTransfer(signature: string, buyer: string, treasury: string, requiredRaw: bigint): Promise<boolean> {
  const mint = tokenMint();
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const tx = await sharedRpc().getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
      if (tx && !tx.meta?.err) {
        const keys = tx.transaction.message.accountKeys;
        if (!keys.some((k) => k.signer && k.pubkey.toBase58() === buyer)) return false;
        const bal = (arr: typeof tx.meta.preTokenBalances): bigint => {
          const e = (arr ?? []).find((b) => b.owner === treasury && b.mint === mint);
          return e ? BigInt(e.uiTokenAmount.amount) : 0n;
        };
        const gained = bal(tx.meta?.postTokenBalances) - bal(tx.meta?.preTokenBalances);
        return gained >= requiredRaw;
      }
    } catch {
      /* transient RPC hiccup — retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

export interface BuyResult {
  ok: boolean;
  error?: string;
  item?: string;
  empireId?: string;
}

export async function buyShopItem(address: string, signature: string, itemId: string): Promise<BuyResult> {
  const item: ShopItem | undefined = shopItem(itemId);
  if (!item) return { ok: false, error: "Unknown item." };
  if (!tokenMint()) return { ok: false, error: "Shop isn't configured yet." };

  // idempotency: a payment signature can only buy once
  if (state.shopPurchases[signature]) return { ok: false, error: "This payment was already redeemed." };

  // match the paying wallet to an empire (same external id used for rewards)
  const user = Object.values(state.users).find((u) => u.externalId === address);
  if (!user || !state.empires[user.empireId])
    return { ok: false, error: "No empire is linked to this wallet — open the game signed in with it first." };
  const empire = state.empires[user.empireId];

  const treasury = treasuryPubkey();
  if (!treasury) return { ok: false, error: "Shop treasury isn't configured." };
  const dec = await decimals();
  const requiredRaw = BigInt(Math.round(item.price)) * 10n ** BigInt(dec);
  const paid = await verifyTransfer(signature, address, treasury, requiredRaw);
  if (!paid)
    return { ok: false, error: "Payment not confirmed yet — if you were charged, wait a few seconds and retry." };

  const res = applyShopItem(empire, item);
  if (!res.ok) return { ok: false, error: res.error };

  state.shopPurchases[signature] = { address, itemId, at: now() };
  scheduleSave(0);
  return { ok: true, item: item.id, empireId: user.empireId };
}
