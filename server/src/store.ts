import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Empire, March, User, WorldMeta } from "../../shared/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const STATE_FILE = join(DATA_DIR, "state.json");

export interface RewardRecord {
  totalClaimed: number; // lamports paid out to this wallet, lifetime
  lastClaimAt: number; // ms timestamp accrual was last reset (claim or first seen)
  firstSeenAt?: number; // ms timestamp this wallet was first seen (accrual start)
  claimCount?: number; // number of successful claims (gates the 6h cooldown)
}

export interface GameState {
  world: WorldMeta;
  users: Record<string, User>;
  empires: Record<string, Empire>;
  marches: March[];
  tokens: Record<string, string>; // token -> userId
  rewards: Record<string, RewardRecord>; // wallet address -> reward record
}

export const state: GameState = {
  world: { width: 40, height: 40, seed: 1337, tick: 0 },
  users: {},
  empires: {},
  marches: [],
  tokens: {},
  rewards: {},
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
