// ─────────────────────────────────────────────────────────────────────────────
// Hub gathering. Choppable trees in the plaza give a TINY reward per chop (a few
// resources), on a short cooldown, up to a small daily RESOURCE cap. So players
// grind 100+ quick chops for a modest daily total — an engaging reason to hang
// around the hub without ever being a farm or compounding into power. The daily
// cap (not the per-chop amount) is what keeps it fair. Server-authoritative.
// ─────────────────────────────────────────────────────────────────────────────
import type { ResourceKind } from "../../shared/types.ts";
import { state, scheduleSave } from "./store.ts";
import { now } from "./util.ts";

export const HUB_GATHER_CD_MS = 1000; // 1s between chops — fast grind, daily cap does the limiting
export const HUB_GATHER_DAILY_MAX = 500; // total resources from chopping per rolling 24h
const DAY_MS = 24 * 60 * 60 * 1000;
const KINDS: ResourceKind[] = ["wood", "food", "stone", "gold"];

export interface HubGatherResult {
  ok: boolean;
  capped?: boolean;
  error?: string;
  resource?: ResourceKind;
  amount?: number;
  today?: number; // total gathered so far this rolling day
  max?: number; // the daily cap
}

export function hubGather(empireId: string): HubGatherResult {
  const e = state.empires[empireId];
  if (!e) return { ok: false, error: "No empire." };

  // short per-chop cooldown — clicking mid-swing is ignored silently
  if (now() < (e.lastHubGatherAt ?? 0) + HUB_GATHER_CD_MS) return { ok: false };

  // rolling 24h resource cap — the real limiter
  const g = e.hubGather && now() - e.hubGather.since < DAY_MS ? e.hubGather : { gathered: 0, since: now() };
  if (g.gathered >= HUB_GATHER_DAILY_MAX)
    return { ok: false, capped: true, error: "The plaza trees are bare for today — back tomorrow." };

  // tiny reward (3–5), never overshooting the daily cap
  const resource = KINDS[Math.floor(Math.random() * KINDS.length)];
  const amount = Math.min(3 + Math.floor(Math.random() * 3), HUB_GATHER_DAILY_MAX - g.gathered);
  e.resources[resource] = (e.resources[resource] ?? 0) + amount;

  e.lastHubGatherAt = now();
  e.hubGather = { gathered: g.gathered + amount, since: g.since };
  scheduleSave(0);
  return { ok: true, resource, amount, today: g.gathered + amount, max: HUB_GATHER_DAILY_MAX };
}
