// Daily Quests (beta). Daily-resetting objectives tracked as a delta off the
// empire's cumulative counters (raids won, arena duels won, total hero XP), so
// no per-action hooks are needed. Rewards are RESOURCES only (peg-safe — never
// coins). Gated by the `dailyQuests` beta flag.
import type { Empire } from "../../shared/types.ts";
import { DAILY_QUESTS } from "../../shared/gamedata.ts";
import { state, scheduleSave } from "./store.ts";
import { isLocked } from "./features.ts";
import { now } from "./util.ts";

function utcDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function totalXp(e: Empire): number {
  return Object.values(e.hero?.skills ?? {}).reduce((a, b) => a + (b as number), 0);
}

function metrics(e: Empire): Record<"raids" | "duels" | "xp", number> {
  return { raids: e.raidsWon ?? 0, duels: e.duelsWon ?? 0, xp: totalXp(e) };
}

// Reset baselines on a new UTC day so progress is "since midnight UTC".
function ensureToday(e: Empire) {
  const day = utcDay(now());
  if (!e.daily || e.daily.day !== day) {
    const m = metrics(e);
    e.daily = { day, baseline: { raids: m.raids, duels: m.duels, xp: m.xp }, claimed: [] };
  }
  return e.daily;
}

export function dailyState(empireId: string) {
  const locked = isLocked("dailyQuests");
  const e = state.empires[empireId];
  if (!e) return { locked, quests: [] };
  const d = ensureToday(e);
  const m = metrics(e);
  const quests = DAILY_QUESTS.map((q) => {
    const progress = Math.min(q.target, Math.max(0, m[q.metric] - d.baseline[q.metric]));
    return { id: q.id, label: q.label, icon: q.icon, target: q.target, progress, claimed: d.claimed.includes(q.id), rewardText: q.rewardText };
  });
  return { locked, quests };
}

export function claimDaily(empireId: string, questId: string): { ok: boolean; error?: string; reward?: string } {
  if (isLocked("dailyQuests")) return { ok: false, error: "Daily Quests are in beta — not live yet." };
  const e = state.empires[empireId];
  if (!e) return { ok: false, error: "No empire." };
  const d = ensureToday(e);
  const q = DAILY_QUESTS.find((x) => x.id === questId);
  if (!q) return { ok: false, error: "Unknown quest." };
  if (d.claimed.includes(q.id)) return { ok: false, error: "Already claimed." };
  const m = metrics(e);
  if (m[q.metric] - d.baseline[q.metric] < q.target) return { ok: false, error: "Not finished yet." };
  if (q.resources) {
    e.resources.wood += q.resources.wood ?? 0;
    e.resources.food += q.resources.food ?? 0;
    e.resources.gold += q.resources.gold ?? 0;
    e.resources.stone += q.resources.stone ?? 0;
  }
  d.claimed.push(q.id);
  scheduleSave(0);
  return { ok: true, reward: q.rewardText };
}
