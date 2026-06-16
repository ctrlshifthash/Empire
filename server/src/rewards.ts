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
import bs58 from "bs58";
import { state, scheduleSave, type RewardRecord } from "./store.ts";
import { now } from "./util.ts";
import { rewardTier, nextRewardTier } from "../../shared/gamedata.ts";

const MINT = (process.env.TOKEN_MINT || "").trim();
const RPC = (process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com").trim();
const DAILY_SOL_POOL = Number(process.env.DAILY_SOL_POOL || "1");
const TREASURY_SECRET = (process.env.TREASURY_SECRET_KEY || "").trim();

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
    rec = { totalClaimed: 0, lastClaimAt: now(), firstSeenAt: now(), claimCount: 0 };
    if (holding && rewardsConfigured()) {
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
  const mint = new PublicKey(MINT);
  const owner = new PublicKey(address);
  const accts = await rpc().getParsedTokenAccountsByOwner(owner, { mint });
  let balance = 0;
  for (const a of accts.value) {
    balance += a.account.data.parsed?.info?.tokenAmount?.uiAmount || 0;
  }
  const supplyInfo = await rpc().getTokenSupply(mint);
  const supply = supplyInfo.value.uiAmount || 0;
  return { balance, supply, sharePct: supply > 0 ? balance / supply : 0 };
}

// Bigger holders earn a bigger multiplier on their pro-rata share. The exact
// value comes from the holder's reward tier (Bronze … Diamond, up to 3×).
export function multiplier(sharePct: number): number {
  return rewardTier(sharePct).multiplier;
}

// ── daily pool budget ───────────────────────────────────────────────────────
// Hard cap: the treasury pays out at most DAILY_SOL_POOL across ALL holders per
// UTC day. The per-wallet multiplier only sets how fast you accrue (your claim
// priority) — the total emitted is still bounded by the pool.
const POOL_LAMPORTS = (): number => Math.round(DAILY_SOL_POOL * LAMPORTS_PER_SOL);
function poolRemainingLamports(): number {
  const day = Math.floor(now() / DAY_MS);
  if (state.rewardPool.day !== day) {
    state.rewardPool.day = day;
    state.rewardPool.paidLamports = 0;
  }
  return Math.max(0, POOL_LAMPORTS() - state.rewardPool.paidLamports);
}

export interface RewardStatus {
  configured: boolean;
  payouts: boolean;
  network: string;
  pool: number;
  holdings: Holdings;
  multiplier: number;
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
  const tier = rewardTier(holdings.sharePct);
  const next = nextRewardTier(holdings.sharePct);
  const m = multiplier(holdings.sharePct);
  const dailySol = holdings.sharePct * DAILY_SOL_POOL * m;
  const rec = ensureRecord(address, holdings.balance > 0);
  const elapsed = Math.max(0, now() - rec.lastClaimAt);
  const poolRemaining = poolRemainingLamports() / LAMPORTS_PER_SOL;
  // you can only ever claim what's left in today's shared pool
  const claimableSol = Math.min(dailySol * (elapsed / DAY_MS), poolRemaining);
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
    poolPaid: state.rewardPool.paidLamports / LAMPORTS_PER_SOL,
  };
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
  if (holdings.balance <= 0) return { ok: false, error: "You don't hold any tokens." };

  const rec = ensureRecord(address, true);
  const claimCount = rec.claimCount || 0;
  // first claim is free anytime; after that, one claim every 6 hours
  if (claimCount > 0) {
    const wait = rec.lastClaimAt + CLAIM_COOLDOWN_MS - now();
    if (wait > 0) return { ok: false, error: `Next claim available in ${fmtWait(wait)}.` };
  }

  const m = multiplier(holdings.sharePct);
  const dailySol = holdings.sharePct * DAILY_SOL_POOL * m;
  const elapsed = Math.max(0, now() - rec.lastClaimAt);
  const claimSol = dailySol * (elapsed / DAY_MS);
  if (claimSol < 0.000001) return { ok: false, error: "Nothing to claim yet — let it accrue." };
  if (!payoutsLive()) return { ok: false, error: "Payouts aren't live yet (treasury not configured)." };

  // hard daily cap: never pay more than what's left in today's shared pool
  const remaining = poolRemainingLamports();
  if (remaining <= 0) return { ok: false, error: "Today's reward pool is used up — come back tomorrow." };
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
    scheduleSave(0);
    return { ok: true, signature, claimedSol: lamports / LAMPORTS_PER_SOL };
  } catch (err) {
    console.error("[rewards] payout failed:", err);
    return { ok: false, error: "Payout transaction failed." };
  }
}
