// ─────────────────────────────────────────────────────────────────────────────
// Player marketplace. Scarce, limited-supply items are listed and traded between
// players. Payment is wallet-to-wallet (SOL or USDC) split between the seller and
// a treasury fee, in a single transaction the buyer signs. The server NEVER holds
// funds — it only verifies the payment on-chain, then transfers the item. A
// listed item is escrow-locked; a pending purchase reserves it briefly so it
// can't be double-sold. Each payment signature is single-use.
// ─────────────────────────────────────────────────────────────────────────────
import { PublicKey } from "@solana/web3.js";
import {
  MARKET_ITEMS,
  MARKET_FEE,
  USDC_MINT,
  RARITY_META,
  EQUIP_SLOTS,
  marketItem,
  itemEffectSummary,
} from "../../shared/gamedata.ts";
import type { Empire, ItemInstance, InventoryItem, Listing, ListingPublic, MarketCurrency } from "../../shared/types.ts";
import { state, scheduleSave } from "./store.ts";
import { recomputePower } from "./engine.ts";
import { sharedRpc, treasuryPubkey } from "./rewards.ts";
import { now, uid } from "./util.ts";

const RARITY_RANK: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

// Set the empire's banner to the highest-rarity equipped relic's colour.
function refreshEquipBanner(e: Empire): void {
  let best: { rank: number; banner: string } | null = null;
  for (const id of e.equipped ?? []) {
    const def = marketItem(state.itemInstances[id]?.typeId ?? "");
    if (!def) continue;
    const rank = RARITY_RANK[def.rarity] ?? 0;
    if (!best || rank > best.rank) best = { rank, banner: def.banner };
  }
  if (best) e.banner = best.banner;
}

function ensureMarketStats(e: Empire): NonNullable<Empire["marketStats"]> {
  if (!e.marketStats) e.marketStats = { bought: 0, sold: 0, earned: { SOL: 0, USDC: 0 }, spent: { SOL: 0, USDC: 0 } };
  return e.marketStats;
}

const RESERVE_MS = 3 * 60 * 1000; // a buyer reserves a listing for 3 minutes

// ── minting (items enter circulation via drops / admin) ──────────────────────
export function mintItem(empireId: string, typeId: string): ItemInstance | null {
  const def = marketItem(typeId);
  if (!def) return null;
  const minted = state.mintCounts[typeId] ?? 0;
  if (minted >= def.maxSupply) return null; // sold out forever
  const serial = minted + 1;
  state.mintCounts[typeId] = serial;
  const inst: ItemInstance = { id: uid("item_"), typeId, ownerId: empireId, serial, mintedAt: now() };
  state.itemInstances[inst.id] = inst;
  scheduleSave(0);
  return inst;
}

// pick a random item to drop, weighted toward commoner rarities, respecting supply
export function randomDropType(): string | null {
  const weight: Record<string, number> = { common: 60, rare: 28, epic: 10, legendary: 2 };
  const pool = MARKET_ITEMS.filter((m) => (state.mintCounts[m.id] ?? 0) < m.maxSupply);
  if (pool.length === 0) return null;
  const total = pool.reduce((s, m) => s + (weight[m.rarity] ?? 1), 0);
  let r = Math.random() * total;
  for (const m of pool) {
    r -= weight[m.rarity] ?? 1;
    if (r <= 0) return m.id;
  }
  return pool[0].id;
}

// ── inventory / listings views ───────────────────────────────────────────────
function isListed(instanceId: string): boolean {
  return Object.values(state.listings).some((l) => l.instanceId === instanceId && l.status === "active");
}

export function inventoryOf(empireId: string): InventoryItem[] {
  const equipped = state.empires[empireId]?.equipped ?? [];
  return Object.values(state.itemInstances)
    .filter((it) => it.ownerId === empireId)
    .sort((a, b) => a.serial - b.serial)
    .map((it) => {
      const def = marketItem(it.typeId);
      return {
        instanceId: it.id,
        typeId: it.typeId,
        name: def?.name ?? it.typeId,
        icon: def?.icon ?? "📦",
        rarity: def?.rarity ?? "common",
        serial: it.serial,
        listed: isListed(it.id),
        equipped: equipped.includes(it.id),
        effect: def ? itemEffectSummary(def) : "Collectible",
      };
    });
}

export function activeListings(): ListingPublic[] {
  return Object.values(state.listings)
    .filter((l) => l.status === "active")
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((l) => {
      const def = marketItem(l.typeId);
      const inst = state.itemInstances[l.instanceId];
      return {
        id: l.id,
        typeId: l.typeId,
        name: def?.name ?? l.typeId,
        icon: def?.icon ?? "📦",
        rarity: def?.rarity ?? "common",
        serial: inst?.serial ?? 0,
        price: l.price,
        currency: l.currency,
        sellerName: l.sellerName,
        effect: def ? itemEffectSummary(def) : "Collectible",
        reserved: !!(l.reservedBy && (l.reservedUntil ?? 0) > now()),
      };
    });
}

// Seed the Bazaar with starter "house" listings (proceeds go to the treasury) so
// it's never empty. Versioned so we can refresh the starter set; re-seeding clears
// the previous unsold house items/listings and frees their supply back.
const MARKET_SEED_VERSION = 2;
export function seedMarket(): void {
  if ((state.mintCounts.__seedV ?? 0) === MARKET_SEED_VERSION) return;
  // clear any previous house items + listings (free their supply)
  for (const inst of Object.values(state.itemInstances)) {
    if (inst.ownerId === "house") {
      state.mintCounts[inst.typeId] = Math.max(0, (state.mintCounts[inst.typeId] ?? 1) - 1);
      delete state.itemInstances[inst.id];
    }
  }
  for (const l of Object.values(state.listings)) if (l.sellerId === "house") delete state.listings[l.id];
  const treasury = treasuryPubkey();
  if (!treasury) return; // need the treasury wallet to receive payment (retry next boot)
  // listed in SOL (sellers can list in SOL or USDC; buyers pay the listing currency)
  const seeds: { typeId: string; price: number; currency: MarketCurrency }[] = [
    { typeId: "iron_chalice", price: 0.02, currency: "SOL" },
    { typeId: "bronze_medallion", price: 0.025, currency: "SOL" },
    { typeId: "oak_charm", price: 0.018, currency: "SOL" },
    { typeId: "wolf_totem", price: 0.08, currency: "SOL" },
    { typeId: "silver_fang", price: 0.07, currency: "SOL" },
    { typeId: "emerald_idol", price: 0.09, currency: "SOL" },
    { typeId: "runic_anvil", price: 0.075, currency: "SOL" },
    { typeId: "frost_aegis", price: 0.3, currency: "SOL" },
    { typeId: "storm_crown", price: 0.28, currency: "SOL" },
    { typeId: "obsidian_blade", price: 0.35, currency: "SOL" },
    { typeId: "titan_heart", price: 1.2, currency: "SOL" },
    { typeId: "eternal_crown", price: 1.5, currency: "SOL" },
  ];
  for (const s of seeds) {
    const inst = mintItem("house", s.typeId);
    if (!inst) continue;
    const id = uid("list_");
    state.listings[id] = {
      id,
      instanceId: inst.id,
      typeId: s.typeId,
      sellerId: "house",
      sellerName: "The Bazaar",
      sellerWallet: treasury,
      price: s.price,
      currency: s.currency,
      status: "active",
      createdAt: now(),
    };
  }
  state.mintCounts.__seedV = MARKET_SEED_VERSION;
  scheduleSave(0);
}

export function marketConfig() {
  return {
    ok: true,
    treasury: treasuryPubkey(),
    usdcMint: USDC_MINT,
    feePct: MARKET_FEE,
    rarities: RARITY_META,
    items: MARKET_ITEMS,
  };
}

// ── selling ──────────────────────────────────────────────────────────────────
export interface MarketResult {
  ok: boolean;
  error?: string;
  members?: string[];
}

export function listItem(
  empireId: string,
  sellerWallet: string | undefined,
  instanceId: string,
  price: number,
  currency: MarketCurrency,
): MarketResult {
  if (!sellerWallet || sellerWallet.includes("@") || sellerWallet.startsWith("did:"))
    return { ok: false, error: "Connect a Solana wallet to sell items." };
  const inst = state.itemInstances[instanceId];
  if (!inst || inst.ownerId !== empireId) return { ok: false, error: "You don't own that item." };
  if (isListed(instanceId)) return { ok: false, error: "That item is already listed." };
  if (!(price > 0)) return { ok: false, error: "Set a price." };
  if (currency !== "SOL" && currency !== "USDC") return { ok: false, error: "Pick SOL or USDC." };
  const seller = state.empires[empireId];
  const listing: Listing = {
    id: uid("list_"),
    instanceId,
    typeId: inst.typeId,
    sellerId: empireId,
    sellerName: seller?.name ?? "Seller",
    sellerWallet,
    price,
    currency,
    status: "active",
    createdAt: now(),
  };
  state.listings[listing.id] = listing;
  // a listed item can't stay equipped
  if (seller?.equipped?.includes(instanceId)) {
    seller.equipped = seller.equipped.filter((x) => x !== instanceId);
    recomputePower(seller);
  }
  scheduleSave(0);
  return { ok: true, members: [empireId] };
}

export function delistItem(empireId: string, instanceId: string): MarketResult {
  const l = Object.values(state.listings).find((x) => x.instanceId === instanceId && x.status === "active");
  if (!l) return { ok: false, error: "Listing not found." };
  if (l.sellerId !== empireId) return { ok: false, error: "Not your listing." };
  if (l.reservedBy && (l.reservedUntil ?? 0) > now()) return { ok: false, error: "A buyer is paying right now — try again shortly." };
  delete state.listings[l.id];
  scheduleSave(0);
  return { ok: true, members: [empireId] };
}

export function equipItem(empireId: string, instanceId: string): MarketResult {
  const e = state.empires[empireId];
  const inst = state.itemInstances[instanceId];
  if (!e || !inst || inst.ownerId !== empireId) return { ok: false, error: "You don't own that item." };
  if (isListed(instanceId)) return { ok: false, error: "Delist it before equipping." };
  e.equipped = e.equipped ?? [];
  const i = e.equipped.indexOf(instanceId);
  if (i >= 0) {
    e.equipped.splice(i, 1); // toggle off
  } else {
    if (e.equipped.length >= EQUIP_SLOTS) return { ok: false, error: `You can equip at most ${EQUIP_SLOTS} relics.` };
    e.equipped.push(instanceId);
  }
  refreshEquipBanner(e);
  recomputePower(e); // equipped power bonus may have changed
  scheduleSave(0);
  return { ok: true, members: [empireId] };
}

// ── buying (wallet-to-wallet, verified on-chain) ─────────────────────────────
function payAmounts(price: number, currency: MarketCurrency): { decimals: number; sellerBase: bigint; feeBase: bigint } {
  const decimals = currency === "SOL" ? 9 : 6;
  const total = BigInt(Math.round(price * 10 ** decimals));
  const feeBase = (total * BigInt(Math.round(MARKET_FEE * 1000))) / 1000n;
  return { decimals, sellerBase: total - feeBase, feeBase };
}

export function reserveListing(listingId: string, buyer: string): {
  ok: boolean;
  error?: string;
  payment?: {
    currency: MarketCurrency;
    seller: string;
    treasury: string;
    sellerBase: string;
    feeBase: string;
    decimals: number;
    usdcMint?: string;
  };
} {
  const l = state.listings[listingId];
  if (!l || l.status !== "active") return { ok: false, error: "That listing is gone." };
  if (l.reservedBy && l.reservedBy !== buyer && (l.reservedUntil ?? 0) > now())
    return { ok: false, error: "Someone is buying this right now — try again in a moment." };
  const treasury = treasuryPubkey();
  if (!treasury) return { ok: false, error: "Marketplace not configured." };
  l.reservedBy = buyer;
  l.reservedUntil = now() + RESERVE_MS;
  scheduleSave();
  const { decimals, sellerBase, feeBase } = payAmounts(l.price, l.currency);
  return {
    ok: true,
    payment: {
      currency: l.currency,
      seller: l.sellerWallet,
      treasury,
      sellerBase: sellerBase.toString(),
      feeBase: feeBase.toString(),
      decimals,
      usdcMint: l.currency === "USDC" ? USDC_MINT : undefined,
    },
  };
}

async function verifyPayment(
  signature: string,
  buyer: string,
  seller: string,
  treasury: string,
  currency: MarketCurrency,
  sellerBase: bigint,
  feeBase: bigint,
): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const tx = await sharedRpc().getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
      if (tx && !tx.meta?.err) {
        const keys = tx.transaction.message.accountKeys;
        if (!keys.some((k) => k.signer && k.pubkey.toBase58() === buyer)) return false;
        if (currency === "SOL") {
          const idx = (addr: string) => keys.findIndex((k) => k.pubkey.toBase58() === addr);
          const delta = (addr: string): bigint => {
            const i = idx(addr);
            if (i < 0) return 0n;
            return BigInt(tx.meta!.postBalances[i]) - BigInt(tx.meta!.preBalances[i]);
          };
          return delta(seller) >= sellerBase && delta(treasury) >= feeBase;
        } else {
          const pre = tx.meta?.preTokenBalances ?? [];
          const post = tx.meta?.postTokenBalances ?? [];
          const bal = (arr: typeof pre, owner: string): bigint => {
            const e = arr.find((b) => b.owner === owner && b.mint === USDC_MINT);
            return e ? BigInt(e.uiTokenAmount.amount) : 0n;
          };
          const gained = (owner: string) => bal(post, owner) - bal(pre, owner);
          return gained(seller) >= sellerBase && gained(treasury) >= feeBase;
        }
      }
    } catch {
      /* transient — retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

export async function buyListing(listingId: string, buyer: string, signature: string): Promise<MarketResult & { buyerEmpireId?: string }> {
  const l = state.listings[listingId];
  if (!l || l.status !== "active") return { ok: false, error: "That listing is gone." };
  if (state.marketSignatures[signature]) return { ok: false, error: "This payment was already used." };
  const buyerUser = Object.values(state.users).find((u) => u.externalId === buyer);
  const buyerEmpire = buyerUser ? state.empires[buyerUser.empireId] : undefined;
  if (!buyerEmpire) return { ok: false, error: "Open the game signed in with this wallet to receive the item." };
  if (l.sellerId === buyerEmpire.id) return { ok: false, error: "You can't buy your own listing." };

  const treasury = treasuryPubkey();
  if (!treasury) return { ok: false, error: "Marketplace not configured." };
  const { sellerBase, feeBase } = payAmounts(l.price, l.currency);
  const paid = await verifyPayment(signature, buyer, l.sellerWallet, treasury, l.currency, sellerBase, feeBase);
  if (!paid) return { ok: false, error: "Payment not confirmed — if you were charged, wait a few seconds and retry." };

  // transfer the item to the buyer
  const inst = state.itemInstances[l.instanceId];
  if (inst) inst.ownerId = buyerEmpire.id;
  const sellerEmpire = state.empires[l.sellerId];
  l.status = "sold";
  delete state.listings[listingId];
  state.marketSignatures[signature] = { listingId, buyer, at: now() };

  // trading record: buyer spent the price; seller earned it minus the fee
  const bs = ensureMarketStats(buyerEmpire);
  bs.bought += 1;
  bs.spent[l.currency] += l.price;
  if (sellerEmpire) {
    const ss = ensureMarketStats(sellerEmpire);
    ss.sold += 1;
    ss.earned[l.currency] += l.price * (1 - MARKET_FEE);
  }

  const def = marketItem(l.typeId);
  buyerEmpire.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `Bought ${def?.name ?? "an item"} #${inst?.serial ?? "?"} for ${l.price} ${l.currency}.` });
  if (buyerEmpire.log.length > 60) buyerEmpire.log.length = 60;
  if (sellerEmpire) {
    sellerEmpire.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `Sold ${def?.name ?? "an item"} #${inst?.serial ?? "?"} for ${l.price} ${l.currency}.` });
    if (sellerEmpire.log.length > 60) sellerEmpire.log.length = 60;
  }
  scheduleSave(0);
  return { ok: true, buyerEmpireId: buyerEmpire.id, members: [buyerEmpire.id, l.sellerId] };
}

// clear stale reservations (called from the world tick)
export function expireReservations(): void {
  for (const l of Object.values(state.listings)) {
    if (l.reservedBy && (l.reservedUntil ?? 0) <= now()) {
      l.reservedBy = undefined;
      l.reservedUntil = undefined;
    }
  }
}
