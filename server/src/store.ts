import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Alliance,
  BugReport,
  CharacterInstance,
  CoinListing,
  Duel,
  Tombstone,
  Empire,
  ItemInstance,
  Listing,
  March,
  BurnRecord,
  MarketActivity,
  MountInstance,
  Poll,
  Tournament,
  User,
  WorldBoss,
  WorldMeta,
} from "../../shared/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const STATE_FILE = join(DATA_DIR, "state.json");

export interface RewardRecord {
  totalClaimed: number; // lamports paid out to this wallet, lifetime
  lastClaimAt: number; // ms timestamp accrual was last reset (claim or first seen)
  firstSeenAt?: number; // ms timestamp this wallet was first seen (accrual start)
  claimCount?: number; // number of successful claims (gates the 6h cooldown)
  // Diamond Hands: when the current hold-streak began, and the floor balance
  // maintained during it. Selling below the floor resets the streak.
  heldSince?: number;
  heldBalance?: number;
}

export interface GameState {
  world: WorldMeta;
  users: Record<string, User>;
  empires: Record<string, Empire>;
  marches: March[];
  tokens: Record<string, string>; // token -> userId
  rewards: Record<string, RewardRecord>; // wallet address -> reward record
  // hard daily cap: total SOL paid out across ALL holders is limited to the
  // pool per UTC day. `day` is the UTC day index; `paidLamports` resets each day.
  rewardPool: { day: number; paidLamports: number; vipPaidLamports?: number; publicPaidLamports?: number };
  // token-shop purchases keyed by the payment tx signature (idempotency — a
  // signature can only ever be redeemed once).
  shopPurchases: Record<string, { address: string; itemId: string; at: number }>;
  // shop payments submitted but not yet confirmed on-chain when the buy ran — a
  // background sweep retries these until they confirm, then delivers the item, so
  // a charged buyer is NEVER left without it.
  pendingShopPurchases: Record<string, { address: string; itemId: string; at: number }>;
  // player alliances keyed by alliance id
  alliances: Record<string, Alliance>;
  // the current server-wide world boss (null until first spawned)
  boss: WorldBoss | null;
  // token-weighted governance polls keyed by poll id
  polls: Record<string, Poll>;
  // player-submitted bug reports (newest last; capped)
  bugReports: BugReport[];
  // open + recently-resolved wagered-arena duels keyed by id
  duels: Record<string, Duel>;
  // recoverable tombstones from lost tombstone duels (beta), keyed by id
  tombstones: Record<string, Tombstone>;
  // the current rolling arena tournament (null until seeded)
  tournament: Tournament | null;
  // marketplace: item instances, listings, minted counts per type, used pay sigs
  itemInstances: Record<string, ItemInstance>;
  listings: Record<string, Listing>;
  mintCounts: Record<string, number>; // typeId -> how many minted (for serials/supply)
  marketSignatures: Record<string, { listingId: string; buyer: string; at: number }>;
  // coin exchange: sell in-game coins for the $RUMBLE token (P2P)
  coinListings: Record<string, CoinListing>;
  exchangeSignatures: Record<string, { listingId: string; buyer: string; at: number }>;
  // character cNFTs: owned instances + minted counts per type
  characterInstances: Record<string, CharacterInstance>;
  characterMintCounts: Record<string, number>;
  // $RUMBLE catalog-buy: price quote locked at reserve (per buyer wallet) + spent signatures
  characterReservations: Record<string, { typeId: string; treasuryBase: string; burnBase: string; until: number }>;
  characterBuySignatures: Record<string, { typeId: string; buyer: string; at: number }>;
  // mount/pet cNFTs (beta): owned instances + serial counts per type
  mountInstances: Record<string, MountInstance>;
  mountMintCounts: Record<string, number>;
  // marketplace activity feed (listed / bought / sold), newest first
  marketActivity: MarketActivity[];
  // treasury $RUMBLE burns (hourly job): recent records + lifetime total
  burns: BurnRecord[];
  totalBurned: number;
}

export const state: GameState = {
  world: { width: 40, height: 40, seed: 1337, tick: 0 },
  users: {},
  empires: {},
  marches: [],
  tokens: {},
  rewards: {},
  rewardPool: { day: 0, paidLamports: 0 },
  shopPurchases: {},
  pendingShopPurchases: {},
  alliances: {},
  boss: null,
  polls: {},
  bugReports: [],
  duels: {},
  tombstones: {},
  tournament: null,
  itemInstances: {},
  listings: {},
  mintCounts: {},
  marketSignatures: {},
  coinListings: {},
  exchangeSignatures: {},
  characterInstances: {},
  characterMintCounts: {},
  characterReservations: {},
  characterBuySignatures: {},
  mountInstances: {},
  mountMintCounts: {},
  marketActivity: [],
  burns: [],
  totalBurned: 0,
};

export function loadState(): boolean {
  try {
    if (existsSync(STATE_FILE)) {
      const raw = readFileSync(STATE_FILE, "utf8");
      const parsed = JSON.parse(raw) as GameState;
      Object.assign(state, parsed);
      // ensure new fields exist after upgrades
      state.marches ??= [];
      state.tokens ??= {};
      state.rewards ??= {};
      state.rewardPool ??= { day: 0, paidLamports: 0 };
      state.shopPurchases ??= {};
      state.pendingShopPurchases ??= {};
      state.alliances ??= {};
      state.boss ??= null;
      state.polls ??= {};
      state.bugReports ??= [];
      state.duels ??= {};
      state.tombstones ??= {};
      state.tournament ??= null;
      state.itemInstances ??= {};
      state.listings ??= {};
      state.mintCounts ??= {};
      state.marketSignatures ??= {};
      state.coinListings ??= {};
      state.exchangeSignatures ??= {};
      state.characterInstances ??= {};
      state.characterMintCounts ??= {};
      state.characterReservations ??= {};
      state.characterBuySignatures ??= {};
      state.mountInstances ??= {};
      state.mountMintCounts ??= {};
      state.marketActivity ??= [];
      state.burns ??= [];
      state.totalBurned ??= 0;
      // Reward pool: a drifted daily-spent counter had wedged the pool at "used
      // up", blocking ALL claims. Clear it once, then re-anchor to today on each
      // boot (and on day rollover) so it can never get stuck again.
      {
        const today = Math.floor(Date.now() / 86_400_000);
        if (state.mintCounts.__poolFixV !== 1 || state.rewardPool.day !== today) {
          state.rewardPool = { day: today, paidLamports: 0 };
          state.mintCounts.__poolFixV = 1;
        }
      }
      // migrate: drop pre-USD coin listings (refund their escrowed coins)
      for (const [id, l] of Object.entries(state.coinListings)) {
        if (typeof (l as { usdPrice?: number }).usdPrice !== "number") {
          const e = state.empires[l.sellerId];
          if (e && l.status === "active") e.coins += l.coinAmount || 0;
          delete state.coinListings[id];
        }
      }
      return true;
    }
  } catch (err) {
    console.error("[store] failed to load state, starting fresh:", err);
  }
  return false;
}

let saveTimer: NodeJS.Timeout | null = null;

export function save(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  // atomic write: write to temp then rename
  const tmp = STATE_FILE + ".tmp";
  try {
    writeFileSync(tmp, JSON.stringify(state));
    renameSync(tmp, STATE_FILE);
  } catch (err) {
    console.error("[store] save failed:", err);
  }
}

// Debounced save so frequent mutations don't thrash the disk.
// A delay of 0 forces an immediate, durable flush (used right after auth).
export function scheduleSave(delay = 1500): void {
  if (delay <= 0) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    save();
    return;
  }
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    save();
  }, delay);
}

// Record a marketplace activity event (listed / bought / sold), newest first.
// `meta` carries the transaction details shown in the activity popup.
type ActivityMeta = Pick<MarketActivity, "refType" | "serial" | "priceUsd" | "fromWallet" | "toWallet" | "signature">;
export function pushActivity(category: MarketActivity["category"], kind: MarketActivity["kind"], text: string, listingId?: string, meta?: ActivityMeta): void {
  const ev: MarketActivity = {
    id: `act_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    at: Date.now(),
    category,
    kind,
    text,
    listingId,
    ...meta,
  };
  state.marketActivity.unshift(ev);
  if (state.marketActivity.length > 120) state.marketActivity.length = 120;
  scheduleSave();
}
