// ─────────────────────────────────────────────────────────────────────────────
// Player marketplace. Scarce, limited-supply items are listed and traded between
// players. Payment is wallet-to-wallet (SOL or USDC) split between the seller and
// a treasury fee, in a single transaction the buyer signs. The server NEVER holds
// funds — it only verifies the payment on-chain, then transfers the item. A
// listed item is escrow-locked; a pending purchase reserves it briefly so it
// can't be double-sold. Each payment signature is single-use.
// ─────────────────────────────────────────────────────────────────────────────
import {
  MARKET_ITEMS,
  MARKET_FEE,
  RARITY_META,
  EQUIP_SLOTS,
  FUSE_COUNT,
  FUSE_COINS,
  CRAFT_COST,
  RELIC_CAP,
  EQUIP_MIN_RANK,
  marketItem,
  itemEffectSummary,
  nextRarity,
  minRankNameForRarity,
  rankIndex,
  MOUNTS,
  mountType,
  characterType,
} from "../../shared/gamedata.ts";
import type { Empire, ItemInstance, InventoryItem, Listing, ListingPublic } from "../../shared/types.ts";
import { state, scheduleSave, pushActivity } from "./store.ts";
import { recomputePower } from "./engine.ts";
import { mintMount } from "./mounts.ts";
import { treasuryPubkey, tokenMint } from "./rewards.ts";
import { rumbleUsdPrice } from "./price.ts";
import { amountsFromUsd, rumbleDecimals, verifyRumblePayment, EXCHANGE_BURN_PCT } from "./exchange.ts";
import { now, uid } from "./util.ts";

const RARITY_RANK: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

// Pet/mount sales run through the SAME bazaar flow as relics (house listings,
// treasury as seller, paid in $RUMBLE). Wired but gated off until launch — the
// shop shows "Soon" and no pet listings are seeded. Flip FEATURE_PET_SALES=1.
const PET_SALES_LIVE = (process.env.FEATURE_PET_SALES || "").trim() === "1";

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

// number of relics an empire currently holds (counts toward the cap)
export function inventoryCount(empireId: string): number {
  let n = 0;
  for (const it of Object.values(state.itemInstances)) if (it.ownerId === empireId) n++;
  return n;
}

// ── minting (items enter circulation via drops / admin) ──────────────────────
export function mintItem(empireId: string, typeId: string): ItemInstance | null {
  const def = marketItem(typeId);
  if (!def) return null;
  if (empireId !== "house" && inventoryCount(empireId) >= RELIC_CAP) return null; // inventory full
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
  const e = state.empires[empireId];
  const equipped = e?.equipped ?? [];
  const myRank = rankIndex(e?.power ?? 0);
  return Object.values(state.itemInstances)
    .filter((it) => it.ownerId === empireId)
    .sort((a, b) => a.serial - b.serial)
    .map((it) => {
      const def = marketItem(it.typeId);
      const rarity = def?.rarity ?? "common";
      return {
        instanceId: it.id,
        typeId: it.typeId,
        name: def?.name ?? it.typeId,
        icon: def?.icon ?? "📦",
        rarity,
        serial: it.serial,
        listed: isListed(it.id),
        equipped: equipped.includes(it.id),
        effect: def ? itemEffectSummary(def) : "Collectible",
        canEquip: myRank >= (EQUIP_MIN_RANK[rarity] ?? 0),
        reqRank: minRankNameForRarity(rarity),
      };
    });
}

export function activeListings(): ListingPublic[] {
  return Object.values(state.listings)
    .filter((l) => l.status === "active")
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((l) => {
      const reserved = !!(l.reservedBy && (l.reservedUntil ?? 0) > now());
      if (l.kind === "mount") {
        const m = mountType(l.typeId);
        const mi = state.mountInstances[l.instanceId];
        return {
          id: l.id,
          typeId: l.typeId,
          name: m?.name ?? l.typeId,
          icon: m?.icon ?? "🐎",
          rarity: m?.rarity ?? "common",
          serial: mi?.serial ?? 0,
          price: l.price,
          sellerName: l.sellerName,
          effect: m?.trait.label ?? "Companion",
          kind: "mount",
          reserved,
        };
      }
      if (l.kind === "character") {
        const c = characterType(l.typeId);
        const ci = state.characterInstances[l.instanceId];
        return {
          id: l.id,
          typeId: l.typeId,
          name: c?.name ?? l.typeId,
          icon: c?.icon ?? "🎭",
          rarity: c?.rarity ?? "common",
          serial: ci?.serial ?? 0,
          price: l.price,
          sellerName: l.sellerName,
          effect: c?.desc ?? "Playable character",
          image: c?.image,
          kind: "character",
          reserved,
        };
      }
      const def = marketItem(l.typeId);
      const inst = state.itemInstances[l.instanceId];
      return {
        id: l.id,
        typeId: l.typeId,
        name: def?.name ?? l.typeId,
        icon: def?.icon ?? "📦",
        rarity: def?.rarity ?? "common",
        serial: inst?.serial ?? 0,
        price: l.price, // USD; client shows ≈ $RUMBLE at the live rate
        sellerName: l.sellerName,
        effect: def ? itemEffectSummary(def) : "Collectible",
        kind: "relic",
        reserved,
      };
    });
}

// Seed the Bazaar with starter "house" listings (proceeds go to the treasury) so
// it's never empty. Versioned so we can refresh the starter set; re-seeding clears
// the previous unsold house items/listings and frees their supply back.
const MARKET_SEED_VERSION = 3;
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
  for (const inst of Object.values(state.mountInstances)) {
    if (inst.ownerId === "house") {
      state.mountMintCounts[inst.typeId] = Math.max(0, (state.mountMintCounts[inst.typeId] ?? 1) - 1);
      delete state.mountInstances[inst.id];
    }
  }
  const treasury = treasuryPubkey();
  if (!treasury) return; // need the treasury wallet to receive payment (retry next boot)
  // Priced in USDC (dollars), scaled to each relic's utility & scarcity — starter
  // anchors; players set the real price by supply & demand from here.
  const seeds: { typeId: string; price: number }[] = [
    { typeId: "iron_chalice", price: 2 },
    { typeId: "lucky_coin", price: 3 },
    { typeId: "oak_charm", price: 2 },
    { typeId: "wolf_totem", price: 8 },
    { typeId: "silver_fang", price: 7 },
    { typeId: "blood_ruby", price: 12 },
    { typeId: "merchants_seal", price: 10 },
    { typeId: "frost_aegis", price: 35 },
    { typeId: "storm_crown", price: 30 },
    { typeId: "warlords_pennant", price: 45 },
    { typeId: "obsidian_blade", price: 40 },
    { typeId: "harvest_crown", price: 38 },
    { typeId: "titan_heart", price: 150 },
    { typeId: "kings_ransom", price: 180 },
    { typeId: "eternal_crown", price: 200 },
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
      price: s.price, // USD
      status: "active",
      createdAt: now(),
    };
  }
  // pets/mounts — house-listed in $RUMBLE through the same flow, gated until
  // launch (set FEATURE_PET_SALES=1 and bump MARKET_SEED_VERSION to seed them).
  if (PET_SALES_LIVE) {
    for (const m of MOUNTS) {
      const inst = mintMount("house", m.id);
      if (!inst) continue;
      const id = uid("list_");
      state.listings[id] = { id, instanceId: inst.id, typeId: m.id, kind: "mount", sellerId: "house", sellerName: "The Bazaar", sellerWallet: treasury, price: m.priceUsd, status: "active", createdAt: now() };
    }
  }
  state.mintCounts.__seedV = MARKET_SEED_VERSION;
  scheduleSave(0);
}

export function marketConfig() {
  return {
    ok: true,
    treasury: treasuryPubkey(),
    mint: tokenMint(), // relics settle in $RUMBLE now
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
  usdPrice: number,
): MarketResult {
  if (!sellerWallet || sellerWallet.includes("@") || sellerWallet.startsWith("did:"))
    return { ok: false, error: "Connect a Solana wallet to sell items." };
  const inst = state.itemInstances[instanceId];
  if (!inst || inst.ownerId !== empireId) return { ok: false, error: "You don't own that item." };
  if (isListed(instanceId)) return { ok: false, error: "That item is already listed." };
  const price = Math.round((Number(usdPrice) || 0) * 100) / 100; // USD, cent precision
  if (!(price > 0)) return { ok: false, error: "Set a price in USD." };
  const seller = state.empires[empireId];
  const listing: Listing = {
    id: uid("list_"),
    instanceId,
    typeId: inst.typeId,
    sellerId: empireId,
    sellerName: seller?.name ?? "Seller",
    sellerWallet,
    price,
    status: "active",
    createdAt: now(),
  };
  state.listings[listing.id] = listing;
  pushActivity("relic", "listed", `${seller?.name ?? "A ruler"} listed ${marketItem(inst.typeId)?.name ?? "a relic"} #${inst.serial} for $${price.toFixed(2)} in $RUMBLE`, listing.id, { refType: inst.typeId, serial: inst.serial, priceUsd: price, fromWallet: sellerWallet });
  // a listed item can't stay equipped
  if (seller?.equipped?.includes(instanceId)) {
    seller.equipped = seller.equipped.filter((x) => x !== instanceId);
    recomputePower(seller);
  }
  scheduleSave(0);
  return { ok: true, members: [empireId] };
}

// List one of your characters for resale. Same $RUMBLE flow as relics (95% to
// you, 5% burned). The character is unequipped while listed; ownership transfers
// to the buyer on a confirmed payment. Works even before on-chain minting — the
// in-game owner moves now, the cNFT asset id follows once minting is live.
export function listCharacter(
  empireId: string,
  sellerWallet: string | undefined,
  instanceId: string,
  usdPrice: number,
): MarketResult {
  if (!sellerWallet || sellerWallet.includes("@") || sellerWallet.startsWith("did:"))
    return { ok: false, error: "Connect a Solana wallet to sell characters." };
  const inst = state.characterInstances[instanceId];
  if (!inst || inst.ownerId !== empireId) return { ok: false, error: "You don't own that character." };
  if (isListed(instanceId)) return { ok: false, error: "That character is already listed." };
  const price = Math.round((Number(usdPrice) || 0) * 100) / 100; // USD, cent precision
  if (!(price > 0)) return { ok: false, error: "Set a price in USD." };
  const seller = state.empires[empireId];
  const def = characterType(inst.typeId);
  const listing: Listing = {
    id: uid("list_"),
    instanceId,
    typeId: inst.typeId,
    kind: "character",
    sellerId: empireId,
    sellerName: seller?.name ?? "Seller",
    sellerWallet,
    price,
    status: "active",
    createdAt: now(),
  };
  state.listings[listing.id] = listing;
  pushActivity("character", "listed", `${seller?.name ?? "A ruler"} listed ${def?.name ?? "a character"} #${inst.serial} for $${price.toFixed(2)} in $RUMBLE`, listing.id, { refType: inst.typeId, serial: inst.serial, priceUsd: price, fromWallet: sellerWallet });
  // a listed character can't stay equipped as your avatar
  if (seller?.equippedCharacter === instanceId) { seller.equippedCharacter = undefined; recomputePower(seller); }
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
    const rarity = marketItem(inst.typeId)?.rarity ?? "common";
    if (rankIndex(e.power) < (EQUIP_MIN_RANK[rarity] ?? 0))
      return { ok: false, error: `Reach ${minRankNameForRarity(rarity)} rank to equip ${rarity} relics.` };
    e.equipped.push(instanceId);
  }
  refreshEquipBanner(e);
  recomputePower(e); // equipped power bonus may have changed
  scheduleSave(0);
  return { ok: true, members: [empireId] };
}

// ── buying ($RUMBLE, USD-priced, verified on-chain) ──────────────────────────
// The buyer pays the seller 95% in $RUMBLE at the live rate and BURNS 5%
// (deflationary). The $RUMBLE amount is locked at reserve so the price can't move
// mid-buy; the server verifies on-chain, then transfers the item. No custody.
export async function reserveListing(listingId: string, buyer: string): Promise<{
  ok: boolean;
  error?: string;
  payment?: { mint: string; seller: string; sellerBase: string; burnBase: string; decimals: number; rumbleAmount: number };
}> {
  const l = state.listings[listingId];
  if (!l || l.status !== "active") return { ok: false, error: "That listing is gone." };
  if (l.reservedBy && l.reservedBy !== buyer && (l.reservedUntil ?? 0) > now())
    return { ok: false, error: "Someone is buying this right now — try again in a moment." };
  const buyerUser = Object.values(state.users).find((u) => u.externalId === buyer);
  // can't reserve your own listing — otherwise clicking Buy then cancelling leaves
  // your own item stuck "reserved" until the lock expires
  if (buyerUser && l.sellerId === buyerUser.empireId)
    return { ok: false, error: "You can't buy your own listing." };
  // make sure the buyer has room before they pay (relic inventory cap only —
  // characters/pets don't use relic slots)
  if (buyerUser && (l.kind === undefined || l.kind === "relic") && inventoryCount(buyerUser.empireId) >= RELIC_CAP)
    return { ok: false, error: `Your inventory is full (${RELIC_CAP}) — sell or forge a relic to make room first.` };
  const rumbleUsd = await rumbleUsdPrice();
  if (!rumbleUsd) return { ok: false, error: "$RUMBLE price unavailable — try again in a moment." };
  const dec = await rumbleDecimals();
  const { sellerBase, burnBase, rumbleAmount } = amountsFromUsd(l.price, rumbleUsd, dec);
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

export async function buyListing(listingId: string, buyer: string, signature: string): Promise<MarketResult & { buyerEmpireId?: string }> {
  const l = state.listings[listingId];
  if (!l || l.status !== "active") return { ok: false, error: "That listing is gone." };
  if (state.marketSignatures[signature]) return { ok: false, error: "This payment was already used." };
  const buyerUser = Object.values(state.users).find((u) => u.externalId === buyer);
  const buyerEmpire = buyerUser ? state.empires[buyerUser.empireId] : undefined;
  if (!buyerEmpire) return { ok: false, error: "Open the game signed in with this wallet to receive the item." };
  if (l.sellerId === buyerEmpire.id) return { ok: false, error: "You can't buy your own listing." };
  // verify against the $RUMBLE amount locked at reserve time (price-stable)
  if (l.reservedBy !== buyer || !l.reservedSellerBase || !l.reservedBurnBase)
    return { ok: false, error: "Your price quote expired — reopen and buy again." };

  const sellerBase = BigInt(l.reservedSellerBase);
  const burnBase = BigInt(l.reservedBurnBase);
  const paid = await verifyRumblePayment(signature, buyer, l.sellerWallet, sellerBase, burnBase);
  if (!paid) return { ok: false, error: "Payment not confirmed — if you were charged, wait a few seconds and retry." };

  // transfer the item to the buyer — a relic, or a pet/mount house listing
  const sellerEmpire = state.empires[l.sellerId];
  let dispName: string;
  let serial = 0;
  if (l.kind === "mount") {
    const mi = state.mountInstances[l.instanceId];
    if (mi) {
      mi.ownerId = buyerEmpire.id;
      serial = mi.serial;
    }
    dispName = mountType(l.typeId)?.name ?? "a pet";
    // auto-relist the next one so the bazaar keeps stock until the supply cap
    const next = PET_SALES_LIVE ? mintMount("house", l.typeId) : null;
    if (next) {
      const nid = uid("list_");
      state.listings[nid] = { id: nid, instanceId: next.id, typeId: l.typeId, kind: "mount", sellerId: "house", sellerName: l.sellerName, sellerWallet: l.sellerWallet, price: l.price, status: "active", createdAt: now() };
    }
  } else if (l.kind === "character") {
    const ci = state.characterInstances[l.instanceId];
    if (ci) {
      ci.ownerId = buyerEmpire.id;
      serial = ci.serial;
    }
    // clear it from the seller's avatar slot (it's already unequipped at list time,
    // but be safe in case it was equipped some other way)
    if (sellerEmpire && sellerEmpire.equippedCharacter === l.instanceId) { sellerEmpire.equippedCharacter = undefined; recomputePower(sellerEmpire); }
    dispName = characterType(l.typeId)?.name ?? "a character";
  } else {
    const inst = state.itemInstances[l.instanceId];
    if (inst) {
      inst.ownerId = buyerEmpire.id;
      serial = inst.serial;
    }
    dispName = marketItem(l.typeId)?.name ?? "a relic";
  }
  l.status = "sold";
  delete state.listings[listingId];
  state.marketSignatures[signature] = { listingId, buyer, at: now() };

  // trading record — USD value (tracked under the USDC/dollar bucket)
  const bs = ensureMarketStats(buyerEmpire);
  bs.bought += 1;
  bs.spent.USDC += l.price;
  if (sellerEmpire) {
    const ss = ensureMarketStats(sellerEmpire);
    ss.sold += 1;
    ss.earned.USDC += l.price * (1 - MARKET_FEE);
  }

  pushActivity(l.kind === "character" ? "character" : "relic", "bought", `${buyerEmpire.name} bought ${dispName} #${serial} for $${l.price.toFixed(2)} in $RUMBLE`, l.id, { refType: l.typeId, serial, priceUsd: l.price, fromWallet: l.sellerWallet, toWallet: buyer, signature });
  buyerEmpire.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `Bought ${dispName} #${serial} for $${l.price.toFixed(2)} in $RUMBLE.` });
  if (buyerEmpire.log.length > 60) buyerEmpire.log.length = 60;
  if (sellerEmpire) {
    sellerEmpire.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `Sold ${dispName} #${serial} for $${l.price.toFixed(2)} in $RUMBLE.` });
    if (sellerEmpire.log.length > 60) sellerEmpire.log.length = 60;
  }
  scheduleSave(0);
  return { ok: true, buyerEmpireId: buyerEmpire.id, members: [buyerEmpire.id, l.sellerId] };
}

// ── Forge (crafting sink: burns relics/resources to make something greater) ──
function randomTypeOfRarity(rarity: string): string | null {
  const pool = MARKET_ITEMS.filter((m) => m.rarity === rarity && (state.mintCounts[m.id] ?? 0) < m.maxSupply);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;
}

// Fuse FUSE_COUNT spare relics of one rarity into a random relic one rarity up.
// The inputs are burned for good (deflationary), so lower relics stay in demand.
export function fuseRelics(empireId: string, rarity: string): MarketResult {
  const e = state.empires[empireId];
  if (!e) return { ok: false, error: "No empire." };
  const next = nextRarity(rarity as never);
  if (!next) return { ok: false, error: "Legendaries can't be forged further." };
  const cost = FUSE_COINS[rarity] ?? 0;
  const owned = Object.values(state.itemInstances).filter(
    (it) =>
      it.ownerId === empireId &&
      marketItem(it.typeId)?.rarity === rarity &&
      !isListed(it.id) &&
      !(e.equipped ?? []).includes(it.id),
  );
  if (owned.length < FUSE_COUNT) return { ok: false, error: `Need ${FUSE_COUNT} spare ${rarity} relics (not listed or equipped).` };
  if (e.coins < cost) return { ok: false, error: `Forging ${rarity} costs ${cost.toLocaleString()} coins.` };
  const outType = randomTypeOfRarity(next);
  if (!outType) return { ok: false, error: `No ${next} relics remain to forge — they're all minted out.` };

  e.coins -= cost;
  for (let i = 0; i < FUSE_COUNT; i++) delete state.itemInstances[owned[i].id]; // burn the inputs
  const inst = mintItem(empireId, outType);
  const def = inst ? marketItem(inst.typeId) : undefined;
  e.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `🔨 Forged ${FUSE_COUNT} ${rarity} relics into ${def?.name ?? next} #${inst?.serial ?? "?"}!` });
  if (e.log.length > 60) e.log.length = 60;
  recomputePower(e);
  scheduleSave(0);
  return { ok: true, members: [empireId] };
}

// Craft a fresh common relic from raw materials (a resource sink → a relic path
// for everyone, not just winners).
export function craftRelic(empireId: string): MarketResult {
  const e = state.empires[empireId];
  if (!e) return { ok: false, error: "No empire." };
  if (inventoryCount(empireId) >= RELIC_CAP) return { ok: false, error: `Inventory full (${RELIC_CAP}) — sell, forge or burn a relic first.` };
  const c = CRAFT_COST;
  if (e.coins < c.coins || e.resources.wood < c.wood || e.resources.food < c.food || e.resources.gold < c.gold || e.resources.stone < c.stone)
    return { ok: false, error: "Not enough materials & coins to craft a relic." };
  const outType = randomTypeOfRarity("common");
  if (!outType) return { ok: false, error: "No common relics left to craft." };

  e.coins -= c.coins;
  e.resources.wood -= c.wood;
  e.resources.food -= c.food;
  e.resources.gold -= c.gold;
  e.resources.stone -= c.stone;
  const inst = mintItem(empireId, outType);
  const def = inst ? marketItem(inst.typeId) : undefined;
  e.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `🔨 Crafted ${def?.name ?? "a relic"} #${inst?.serial ?? "?"} from raw materials!` });
  if (e.log.length > 60) e.log.length = 60;
  recomputePower(e);
  scheduleSave(0);
  return { ok: true, members: [empireId] };
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
