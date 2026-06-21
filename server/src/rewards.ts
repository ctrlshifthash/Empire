// ─────────────────────────────────────────────────────────────────────────────
// Token-holder rewards. Reads on-chain holdings of a configured SPL token and
// pays out a daily SOL pool pro-rata to holders (bigger holders get a bigger
// multiplier). All secrets/config come from environment variables — never code:
//   TOKEN_MINT          the SPL token mint address
//   SOLANA_RPC          RPC endpoint (defaults to mainnet-beta)
//   DAILY_SOL_POOL      total SOL distributed per day across all holders
//   TREASURY_SECRET_KEY the payer wallet's secret key (JSON array of 64 numbers)
// Until TOKEN_MINT + TREASURY_SECRET_KEY are set the system runs in preview mode
// (shows estimates, performs no real transfers).
// ─────────────────────────────────────────────────────────────────────────────
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createBurnCheckedInstruction, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import { state, scheduleSave, type RewardRecord } from "./store.ts";
import { now } from "./util.ts";
import { rewardTier, nextRewardTier, rankForPower, RANKS, marketItem, mountType } from "../../shared/gamedata.ts";

const MINT = (process.env.TOKEN_MINT || "").trim();
const RPC = (process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com").trim();
const DAILY_SOL_POOL = Number(process.env.DAILY_SOL_POOL || "10");
const TREASURY_SECRET = (process.env.TREASURY_SECRET_KEY || "").trim();
// The daily pool is split among ACTIVE holders only (wallets that hold the
// minimum AND have a game empire) — not the whole supply — so the pool actually
// flows to players. No single wallet may take more than this share of the day.
const WALLET_CAP_PCT = Number(process.env.REWARD_WALLET_CAP_PCT || "0.15");

// VIP and public pools are tracked separately. VIP is fixed at 7.5 SOL;
// public is 3.5 SOL. Total treasury outlay = 11 SOL/day.
const VIP_POOL_SOL    = 7.5;
const PUBLIC_POOL_SOL = Number(process.env.PUBLIC_POOL_SOL || "3.5");
const VIP_REWARD_WALLETS = new Set([
  "EZppbZe5RaXryEd47NdPRX1ytjCd7bpqnZMDQQXMBB2s",
  "57DXn1ZGgfPiT6HqENyokgT9qTyUvpzy4sFraMhAi16z",
  "H61rKATwp2W8AJpZQLarzXyt8Rpho3UzyRhRpkMgAhY",
]);
// Cache of on-chain balances (populated on every read + a rolling refresh) so we
// can sum the active-holder supply without an RPC call per holder per claim.
const balanceCache = new Map<string, { bal: number; at: number }>();
// Last on-chain token supply, refreshed on every getHoldings read. Lets us weight
// each holder's tier in the pool split without an RPC call per holder.
let cachedSupply = 0;

// First claim is allowed anytime; afterwards a wallet may claim every 6 hours
// (4× per day). Accrual keeps running continuously between claims.
const CLAIM_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

// Human-readable Solana network derived from the RPC URL (mainnet unless the
// endpoint clearly points at devnet/testnet).
export const NETWORK = /devnet/i.test(RPC) ? "devnet" : /testnet/i.test(RPC) ? "testnet" : "mainnet-beta";

function fmtWait(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Get (and, for a real holder, persist) a wallet's reward record. Persisting on
// first sight makes accrual start from when we first see them holding — not from
// their first claim.
function ensureRecord(address: string, holding: boolean): RewardRecord {
  let rec = state.rewards[address];
  if (!rec) {
    // VIP wallets start accruing from 24h ago so they always have something
    // claimable on first visit, regardless of token balance.
    const isVip = VIP_REWARD_WALLETS.has(address);
    const start = isVip ? now() - DAY_MS : now();
    rec = { totalClaimed: 0, lastClaimAt: start, firstSeenAt: start, claimCount: 0 };
    if ((holding || isVip) && rewardsConfigured()) {
      state.rewards[address] = rec;
      scheduleSave(0);
    }
  }
  return rec;
}

export const rewardsConfigured = (): boolean => MINT.length > 0;
export const payoutsLive = (): boolean => MINT.length > 0 && TREASURY_SECRET.length > 0;

let conn: Connection | null = null;
function rpc(): Connection {
  if (!conn) conn = new Connection(RPC, "confirmed");
  return conn;
}

export interface Holdings {
  balance: number;
  supply: number;
  sharePct: number; // 0..1
}

// Read a wallet's balance of the configured token + circulating supply.
export async function getHoldings(address: string): Promise<Holdings> {
  if (!rewardsConfigured()) return { balance: 0, supply: 0, sharePct: 0 };
  try {
    const mint = new PublicKey(MINT);
    const owner = new PublicKey(address);
    const accts = await rpc().getParsedTokenAccountsByOwner(owner, { mint });
    let balance = 0;
    for (const a of accts.value) {
      balance += a.account.data.parsed?.info?.tokenAmount?.uiAmount || 0;
    }
    const supplyInfo = await rpc().getTokenSupply(mint);
    const supply = supplyInfo.value.uiAmount || 0;
    cachedSupply = supply;
    balanceCache.set(address, { bal: balance, at: now() });
    return { balance, supply, sharePct: supply > 0 ? balance / supply : 0 };
  } catch (err) {
    // Before the token mint exists on-chain (pre-launch), the RPC throws
    // "could not find mint". Degrade gracefully to zero holdings so dashboards
    // still render instead of erroring. Real reads resume once the mint is live.
    const msg = String((err as Error)?.message || err);
    if (/could not find mint|could not find account|Invalid param/i.test(msg)) {
      return { balance: 0, supply: 0, sharePct: 0 };
    }
    throw err; // genuine RPC failures (429, network) still surface
  }
}

// ── Play gate ────────────────────────────────────────────────────────────────
// The real (earning) game is token-gated: a wallet must hold at least
// MIN_PLAY_HOLD of the project token to enter. Demo mode stays open to everyone
// (no wallet, no rewards). Tunable via the MIN_PLAY_HOLD env var.
export const MIN_PLAY_HOLD = Number(process.env.MIN_PLAY_HOLD || "10");

// Wallets that bypass the gate entirely (team/treasury/testers). Defaults below,
// plus any comma-separated addresses in the PLAY_GATE_ALLOWLIST env var.
const GATE_ALLOWLIST = new Set<string>([
  "4QRgGGeaqeBNN7Vrg34FMrqKUVbhBT9g4hCx9duYJsFA", // treasury
  "EZppbZe5RaXryEd47NdPRX1ytjCd7bpqnZMDQQXMBB2s",
  "57DXn1ZGgfPiT6HqENyokgT9qTyUvpzy4sFraMhAi16z",
  "H61rKATwp2W8AJpZQLarzXyt8Rpho3UzyRhRpkMgAhY",
  ...(process.env.PLAY_GATE_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
]);

export interface PlayEligibility {
  allowed: boolean;
  reason: "ok" | "gate" | "unverified"; // "unverified" = chain read failed, ask to retry
  held: number;
  required: number;
}

// Verify a wallet may enter the real game. Fails to a retry signal (not a
// lock-out) when the chain can't be read, so a transient RPC hiccup never blocks
// a genuine holder. Pre-launch (no mint) or MIN_PLAY_HOLD<=0 → ungated.
export async function checkPlayEligibility(address: string): Promise<PlayEligibility> {
  const required = MIN_PLAY_HOLD;
  if (!rewardsConfigured() || MIN_PLAY_HOLD <= 0) return { allowed: true, reason: "ok", held: 0, required };
  if (GATE_ALLOWLIST.has(address)) return { allowed: true, reason: "ok", held: 0, required }; // whitelisted
  try {
    const { balance } = await getHoldings(address);
    if (balance >= MIN_PLAY_HOLD) return { allowed: true, reason: "ok", held: balance, required };
    return { allowed: false, reason: "gate", held: balance, required };
  } catch {
    return { allowed: false, reason: "unverified", held: 0, required };
  }
}

// A holder's POOL WEIGHT: their balance scaled by every boost they've earned —
// tier (Bronze…Diamond), renown rank (1–5×), Diamond-hands loyalty and equipped
// relics. The fixed pool is split in proportion to these weights, so a bigger
// weight means a bigger SLICE of the same SOL — never more SOL emitted. Read-only
// (no RPC, no lookup by address) so it's cheap to sum across every holder.
function holderWeight(externalId: string, empireId: string, balance: number): number {
  const empire = state.empires[empireId];
  const tierMult = multiplier(cachedSupply > 0 ? balance / cachedSupply : 0);
  const rankMult = empire ? rankRewardMult(empire.power) : 1;
  const rec = state.rewards[externalId];
  const loyMult = loyaltyMultiplier(rec?.heldSince ? Math.max(0, (now() - rec.heldSince) / DAY_MS) : 0);
  let pct = 0;
  for (const id of empire?.equipped ?? []) pct += marketItem(state.itemInstances[id]?.typeId ?? "")?.solPct ?? 0;
  const petTrait = empire?.equippedMount ? mountType(state.mountInstances[empire.equippedMount]?.typeId ?? "")?.trait : undefined;
  if (petTrait?.kind === "sol") pct += petTrait.value; // SOL-boost pet
  const relicMult = 1 + pct;
  return balance * tierMult * rankMult * loyMult * relicMult;
}

// Sum of every active public holder's weight — the split denominator. Because the
// fixed pool is divided by this total, the slices always add up to exactly the
// pool: it can't be over-drawn, and one wallet can't farm it dry.
function activeWeight(): number {
  let sum = 0;
  for (const u of Object.values(state.users)) {
    const ext = u.externalId;
    if (!ext || ext.includes("@") || ext.length < 32) continue;
    if (VIP_REWARD_WALLETS.has(ext)) continue;
    const c = balanceCache.get(ext);
    if (c && c.bal >= MIN_PLAY_HOLD) sum += holderWeight(ext, u.empireId, c.bal);
  }
  return sum;
}

// Total quests claimed across all VIP wallets (denominator for VIP split).
function vipQuestTotal(): number {
  let total = 0;
  for (const addr of VIP_REWARD_WALLETS) {
    const user = Object.values(state.users).find((u) => u.externalId === addr);
    const empire = user ? state.empires[user.empireId] : undefined;
    total += empire?.quests.filter((q) => q.claimed).length ?? 0;
  }
  return total || 1; // avoid div-by-zero before any quests are claimed
}

// VIP wallet daily allocation: quest-weight × 7.5 SOL pool.
// Falls back to equal 3-way split if quests aren't tracked yet.
function vipDailyAccrual(address: string): number {
  const user = Object.values(state.users).find((u) => u.externalId === address);
  const empire = user ? state.empires[user.empireId] : undefined;
  const myQuests = empire?.quests.filter((q) => q.claimed).length ?? 0;
  const total = vipQuestTotal();
  const weight = total > 0 && myQuests > 0 ? myQuests / total : 1 / VIP_REWARD_WALLETS.size;
  return VIP_POOL_SOL * weight;
}

// SOL/day a wallet accrues. VIP wallets earn a quest-weighted share of the VIP
// pool; every other holder earns their weighted SLICE of the fixed public pool —
// (their weight ÷ the total weight) × pool — capped so no single wallet takes too
// big a slice. The slices always sum to the pool, so it's split fully and fairly
// and can never be over-drawn.
function dailyAccrualSol(address: string, balance: number): number {
  if (VIP_REWARD_WALLETS.has(address)) return vipDailyAccrual(address);
  if (balance < MIN_PLAY_HOLD) return 0;
  const u = Object.values(state.users).find((x) => x.externalId === address);
  if (!u) return 0;
  const total = activeWeight();
  const share = total > 0 ? holderWeight(address, u.empireId, balance) / total : 0;
  return Math.min(share * PUBLIC_POOL_SOL, PUBLIC_POOL_SOL * WALLET_CAP_PCT);
}

// Rolling refresh of the balance cache so activeWeight() stays fresh for holders
// who aren't currently online. Called in small batches from the world tick.
let _refreshIdx = 0;
export async function refreshActiveBalances(batch = 5): Promise<void> {
  if (!rewardsConfigured()) return;
  const wallets = [
    ...new Set(
      Object.values(state.users)
        .map((u) => u.externalId)
        .filter((e): e is string => !!e && !e.includes("@") && e.length >= 32),
    ),
  ];
  if (!wallets.length) return;
  for (let i = 0; i < batch; i++) {
    const addr = wallets[_refreshIdx % wallets.length];
    _refreshIdx++;
    try {
      await getHoldings(addr);
    } catch {
      /* skip — transient RPC hiccup */
    }
  }
}

// Bigger holders earn a bigger multiplier on their pro-rata share. The exact
// value comes from the holder's reward tier (Bronze … Diamond, up to 3×).
export function multiplier(sharePct: number): number {
  return rewardTier(sharePct).multiplier;
}

// Reward playing hard, not just holding. A wallet's accrual is boosted by its
// empire's renown rank — the same ladder that rewards building, winning and
// conquering in-game. So climbing ranks earns you a bigger slice of the daily
// pool (within the same fixed cap). A wallet with no empire (or a Peasant) gets
// 1×. The empire is matched to the wallet via its external sign-in id.
// Reward weight from renown rank: a wide 1× (Peasant) → 5× (Emperor) spread, so
// climbing — which you only do by playing — earns you a bigger SLICE of the fixed
// pool. Pure share-weighting; it never mints extra SOL.
function rankRewardMult(power: number): number {
  const idx = Math.max(0, RANKS.findIndex((x) => x.name === rankForPower(power).name));
  return 1 + (idx / (RANKS.length - 1)) * 4;
}
function playBonus(address: string): { mult: number; rank: string } {
  const user = Object.values(state.users).find((u) => u.externalId === address);
  const empire = user ? state.empires[user.empireId] : undefined;
  if (!empire) return { mult: 1, rank: "Unranked" };
  return { mult: rankRewardMult(empire.power), rank: rankForPower(empire.power).name };
}

// Equipped relics with a SOL effect boost the wallet's accrual rate (a bigger
// slice of the fixed daily pool — never extra emission).
function relicSolMult(address: string): number {
  const user = Object.values(state.users).find((u) => u.externalId === address);
  const empire = user ? state.empires[user.empireId] : undefined;
  let pct = 0;
  for (const id of empire?.equipped ?? []) pct += marketItem(state.itemInstances[id]?.typeId ?? "")?.solPct ?? 0;
  const petTrait = empire?.equippedMount ? mountType(state.mountInstances[empire.equippedMount]?.typeId ?? "")?.trait : undefined;
  if (petTrait?.kind === "sol") pct += petTrait.value; // SOL-boost pet
  return 1 + pct;
}

// ── Holder perks (in-game) ───────────────────────────────────────────────────
// Cache the wallet's holder-tier name onto its linked empire so the engine can
// grant in-game perks. Only actual holders (balance > 0) get a tier.
function applyHolderTier(address: string, balance: number, sharePct: number): void {
  const user = Object.values(state.users).find((u) => u.externalId === address);
  const empire = user ? state.empires[user.empireId] : undefined;
  if (!empire) return;
  empire.holderTier = balance > 0 ? rewardTier(sharePct).name : undefined;
}

// Refresh a wallet's holder tier from chain (used on connect, so perks apply in
// play without needing to open the dashboard). Skips non-wallet ids.
export async function refreshHolderTier(address: string): Promise<void> {
  if (!address || address.includes("@") || address.startsWith("did:")) return;
  try {
    const h = await getHoldings(address);
    applyHolderTier(address, h.balance, h.sharePct);
    scheduleSave();
  } catch {
    /* ignore — leave the cached tier as-is */
  }
}

// ── Diamond Hands (loyalty) ──────────────────────────────────────────────────
// Holding without selling grows a loyalty multiplier on your accrual. Selling
// below the streak's floor balance resets it. Tracked lazily off the live
// on-chain balance whenever rewards are read or claimed.
const LOYALTY_RATE_PER_DAY = 0.03; // +3% per day held
const LOYALTY_MAX = 1.0; // capped at +100% (2.0× at ~33 days)

export function loyaltyMultiplier(days: number): number {
  return 1 + Math.min(LOYALTY_MAX, Math.max(0, days) * LOYALTY_RATE_PER_DAY);
}

// Update the hold-streak from the wallet's current balance; returns days held.
function updateLoyalty(rec: RewardRecord, balance: number): number {
  const t = now();
  if (balance <= 0) {
    rec.heldSince = undefined;
    rec.heldBalance = 0;
    return 0;
  }
  if (rec.heldSince == null || (rec.heldBalance ?? 0) <= 0) {
    rec.heldSince = t;
    rec.heldBalance = balance;
    return 0;
  }
  if (balance < (rec.heldBalance ?? 0) * 0.999) {
    // sold below the streak floor — reset
    rec.heldSince = t;
    rec.heldBalance = balance;
    return 0;
  }
  // held (or bought more) — streak continues; floor stays where it started
  return Math.max(0, (t - rec.heldSince) / DAY_MS);
}

// ── daily pool budget ───────────────────────────────────────────────────────
// VIP (7.5 SOL) and public (2.5 SOL) are tracked in separate buckets so
// neither group can eat into the other's allocation.
const TOTAL_POOL_SOL   = VIP_POOL_SOL + PUBLIC_POOL_SOL;
const POOL_LAMPORTS    = (): number => Math.round(TOTAL_POOL_SOL  * LAMPORTS_PER_SOL);
const VIP_POOL_LAMPS   = (): number => Math.round(VIP_POOL_SOL    * LAMPORTS_PER_SOL);
const PUB_POOL_LAMPS   = (): number => Math.round(PUBLIC_POOL_SOL  * LAMPORTS_PER_SOL);

function resetDay(): void {
  const day = Math.floor(now() / DAY_MS);
  if (state.rewardPool.day !== day) {
    state.rewardPool.day = day;
    state.rewardPool.paidLamports = 0;
    state.rewardPool.vipPaidLamports = 0;
    state.rewardPool.publicPaidLamports = 0;
    scheduleSave(0);
  }
}
// Fraction of today's pool UNLOCKED so far. The pool releases linearly across the
// 24h day (from 00:00 UTC), not as a flat cap — so it can't be drained early. A
// burst of claims (e.g. the backlog at the daily reset) can only ever take what's
// unlocked up to that moment; the rest keeps trickling out all day. This is what
// actually spreads the pool evenly over 24h so latecomers always have a share.
function poolReleasedFraction(): number {
  const elapsedToday = now() - Math.floor(now() / DAY_MS) * DAY_MS;
  return Math.min(1, Math.max(0, elapsedToday / DAY_MS));
}
function poolRemainingLamports(): number {
  resetDay();
  // Use bucket totals — the legacy paidLamports was corrupted by pre-split claims
  const paid = (state.rewardPool.vipPaidLamports ?? 0) + (state.rewardPool.publicPaidLamports ?? 0);
  return Math.max(0, Math.floor(POOL_LAMPORTS() * poolReleasedFraction()) - paid);
}
function vipPoolRemainingLamports(): number {
  resetDay();
  return Math.max(0, Math.floor(VIP_POOL_LAMPS() * poolReleasedFraction()) - (state.rewardPool.vipPaidLamports ?? 0));
}
function publicPoolRemainingLamports(): number {
  resetDay();
  return Math.max(0, Math.floor(PUB_POOL_LAMPS() * poolReleasedFraction()) - (state.rewardPool.publicPaidLamports ?? 0));
}

export interface RewardStatus {
  configured: boolean;
  payouts: boolean;
  network: string;
  pool: number;
  holdings: Holdings;
  multiplier: number;
  playBonus: number; // accrual multiplier from in-game rank (playing hard)
  playRank: string; // the linked empire's renown rank
  loyaltyDays: number; // consecutive days held without selling (Diamond Hands)
  loyaltyMult: number; // accrual multiplier from the hold streak
  relicBoost: number; // accrual multiplier from equipped relics
  dailySol: number; // estimated SOL/day for this wallet
  claimableSol: number; // accrued since the last claim
  totalClaimedSol: number;
  claimCount: number; // successful claims so far
  cooldownMs: number; // ms until the next claim is allowed (0 = claim now)
  nextClaimAt: number; // timestamp the next claim unlocks (0 = now)
  memberSince: number; // first time we saw this wallet holding (0 = never)
  tier: string; // holder tier name (Bronze … Diamond)
  tierColor: string; // tier accent colour
  nextTier: string | null; // next tier name, or null at the top
  nextTierShare: number | null; // supply share needed to reach the next tier
  poolRemaining: number; // SOL left in today's shared pool
  poolPaid: number; // SOL already paid from today's pool
}

export async function rewardStatus(address: string): Promise<RewardStatus> {
  const holdings = await getHoldings(address);
  applyHolderTier(address, holdings.balance, holdings.sharePct); // keep in-game perks fresh
  const tier = rewardTier(holdings.sharePct);
  const next = nextRewardTier(holdings.sharePct);
  const m = multiplier(holdings.sharePct);
  const play = playBonus(address);
  const rec = ensureRecord(address, holdings.balance > 0);
  const hadHeldSince = rec.heldSince;
  const loyaltyDays = updateLoyalty(rec, holdings.balance);
  // Persist heldSince the first time it gets set — without this a server restart
  // before the next claim wipes it and resets the Diamond Hands counter to 0.
  if (!hadHeldSince && rec.heldSince && rewardsConfigured()) scheduleSave(500);
  const loyaltyMult = loyaltyMultiplier(loyaltyDays);
  const relicMult = relicSolMult(address);
  const dailySol = dailyAccrualSol(address, holdings.balance);
  const elapsed = Math.max(0, now() - rec.lastClaimAt);
  const isVipWallet = VIP_REWARD_WALLETS.has(address);
  // Pool bar always shows combined total remaining so users just see "X / 10 SOL left"
  const poolRemaining = poolRemainingLamports() / LAMPORTS_PER_SOL;
  // Claimable is still capped by the wallet's own bucket so VIP/public can't bleed into each other
  const bucketRemaining = isVipWallet
    ? vipPoolRemainingLamports() / LAMPORTS_PER_SOL
    : publicPoolRemainingLamports() / LAMPORTS_PER_SOL;
  const claimableSol = Math.min(dailySol * (elapsed / DAY_MS), bucketRemaining);
  const claimCount = rec.claimCount || 0;
  // first claim unlocked immediately; subsequent ones gated to every 6h
  const nextClaimAt = claimCount > 0 ? rec.lastClaimAt + CLAIM_COOLDOWN_MS : 0;
  return {
    configured: rewardsConfigured(),
    payouts: payoutsLive(),
    network: NETWORK,
    pool: DAILY_SOL_POOL,
    holdings,
    multiplier: m,
    playBonus: play.mult,
    playRank: play.rank,
    loyaltyDays,
    loyaltyMult,
    relicBoost: relicMult,
    dailySol,
    claimableSol,
    totalClaimedSol: (rec.totalClaimed || 0) / LAMPORTS_PER_SOL,
    claimCount,
    cooldownMs: Math.max(0, nextClaimAt - now()),
    nextClaimAt,
    memberSince: rec.firstSeenAt || 0,
    tier: tier.name,
    tierColor: tier.color,
    nextTier: next?.name ?? null,
    nextTierShare: next?.minShare ?? null,
    poolRemaining,
    poolPaid: isVipWallet
      ? (state.rewardPool.vipPaidLamports ?? 0) / LAMPORTS_PER_SOL
      : (state.rewardPool.publicPaidLamports ?? 0) / LAMPORTS_PER_SOL,
  };
}

// Shared accessors so other modules (e.g. the token shop) reuse the same RPC
// connection, mint and treasury without re-reading env or re-deriving the key.
export function sharedRpc(): Connection {
  return rpc();
}
export function tokenMint(): string {
  return MINT;
}
export function treasuryPubkey(): string | null {
  const kp = treasuryKeypair();
  return kp ? kp.publicKey.toBase58() : null;
}

function treasuryKeypair(): Keypair | null {
  if (!TREASURY_SECRET) return null;
  try {
    // accept either a JSON array of 64 numbers (solana-keygen) or a base58
    // secret key (Phantom export)
    if (TREASURY_SECRET.startsWith("[")) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(TREASURY_SECRET) as number[]));
    }
    return Keypair.fromSecretKey(bs58.decode(TREASURY_SECRET));
  } catch (err) {
    console.error("[rewards] invalid TREASURY_SECRET_KEY:", err);
    return null;
  }
}

// Burn all the $RUMBLE the treasury has collected (token-shop spend, etc.).
// Run on a schedule so the shop stays deflationary without buyers signing burns.
// Returns the whole-token amount burned (0 if nothing/not configured).
export async function burnTreasuryRumble(): Promise<number> {
  const kp = treasuryKeypair();
  if (!kp || !MINT) return 0;
  try {
    const mint = new PublicKey(MINT);
    // $RUMBLE is a Token-2022 mint — derive the ATA and burn with that program id.
    const ata = getAssociatedTokenAddressSync(mint, kp.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const bal = await rpc().getTokenAccountBalance(ata);
    const amount = BigInt(bal.value.amount);
    if (amount <= 0n) return 0;
    const tx = new Transaction().add(createBurnCheckedInstruction(ata, mint, kp.publicKey, amount, bal.value.decimals, [], TOKEN_2022_PROGRAM_ID));
    const signature = await sendAndConfirmTransaction(rpc(), tx, [kp]);
    const burned = Number(bal.value.uiAmount ?? 0);
    // record it so the site can show the running total + per-tx Solscan links
    state.burns.unshift({ signature, amount: burned, at: now() });
    if (state.burns.length > 200) state.burns.length = 200;
    state.totalBurned = (state.totalBurned || 0) + burned;
    scheduleSave(0);
    console.log(`[burn] burned ${burned} $RUMBLE from the treasury (${signature})`);
    return burned;
  } catch (err) {
    console.error("[burn] treasury burn failed:", err);
    return 0;
  }
}

export interface ClaimResult {
  ok: boolean;
  error?: string;
  signature?: string;
  claimedSol?: number;
}

// Pay the wallet its accrued share of the pool from the treasury, then reset
// its accrual. No-op (preview) until the treasury is configured.
export async function claim(address: string): Promise<ClaimResult> {
  if (!rewardsConfigured()) return { ok: false, error: "Rewards are not configured yet." };
  const holdings = await getHoldings(address);
  if (holdings.balance <= 0 && !VIP_REWARD_WALLETS.has(address))
    return { ok: false, error: "You don't hold any tokens." };

  const rec = ensureRecord(address, true);
  const claimCount = rec.claimCount || 0;
  // first claim is free anytime; after that, one claim every 6 hours
  if (claimCount > 0) {
    const wait = rec.lastClaimAt + CLAIM_COOLDOWN_MS - now();
    if (wait > 0) return { ok: false, error: `Next claim available in ${fmtWait(wait)}.` };
  }

  updateLoyalty(rec, holdings.balance); // keep the Diamond-hands streak current
  const dailySol = dailyAccrualSol(address, holdings.balance);
  const elapsed = Math.max(0, now() - rec.lastClaimAt);
  const walletDayCap = VIP_REWARD_WALLETS.has(address)
    ? vipDailyAccrual(address)
    : PUBLIC_POOL_SOL * WALLET_CAP_PCT;
  const claimSol = Math.min(dailySol * (elapsed / DAY_MS), walletDayCap);
  if (claimSol < 0.000001) return { ok: false, error: "Nothing to claim yet — let it accrue." };
  if (!payoutsLive()) return { ok: false, error: "Payouts aren't live yet (treasury not configured)." };

  // daily cap, released gradually over 24h: VIP and public each have their own
  // bucket — neither can eat the other's, and neither can be drained ahead of schedule
  const isVip = VIP_REWARD_WALLETS.has(address);
  const remaining = isVip ? vipPoolRemainingLamports() : publicPoolRemainingLamports();
  if (remaining <= 0) {
    const fullPaid = (isVip ? state.rewardPool.vipPaidLamports ?? 0 : state.rewardPool.publicPaidLamports ?? 0) >= (isVip ? VIP_POOL_LAMPS() : PUB_POOL_LAMPS());
    return { ok: false, error: fullPaid
      ? "Today's reward pool is used up — come back tomorrow."
      : "The pool unlocks gradually through the day — a little more every few minutes. Check back shortly." };
  }
  const lamports = Math.min(Math.floor(claimSol * LAMPORTS_PER_SOL), remaining);

  const kp = treasuryKeypair();
  if (!kp) return { ok: false, error: "Treasury wallet is misconfigured." };
  try {
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(address), lamports }),
    );
    const signature = await sendAndConfirmTransaction(rpc(), tx, [kp]);
    rec.totalClaimed = (rec.totalClaimed || 0) + lamports;
    rec.lastClaimAt = now();
    rec.claimCount = claimCount + 1;
    rec.firstSeenAt = rec.firstSeenAt || now();
    state.rewards[address] = rec;
    state.rewardPool.paidLamports += lamports;
    if (isVip) state.rewardPool.vipPaidLamports = (state.rewardPool.vipPaidLamports ?? 0) + lamports;
    else state.rewardPool.publicPaidLamports = (state.rewardPool.publicPaidLamports ?? 0) + lamports;
    scheduleSave(0);
    return { ok: true, signature, claimedSol: lamports / LAMPORTS_PER_SOL };
  } catch (err) {
    console.error("[rewards] payout failed:", err);
    return { ok: false, error: "Payout transaction failed." };
  }
}
