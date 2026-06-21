// ─────────────────────────────────────────────────────────────────────────────
// Hub gathering. Choppable trees/nodes in the social plaza give a SMALL resource
// reward on a per-player cooldown, with a rolling daily cap — a light reason to
// hang around the hub, deliberately kept modest so it's never a farm and doesn't
// undercut the marketplace or the $RUMBLE resource crates. Server-authoritative.
// ─────────────────────────────────────────────────────────────────────────────
import type { ResourceKind } from "../../shared/types.ts";
import { state, scheduleSave } from "./store.ts";
import { now, uid } from "./util.ts";

export const HUB_GATHER_CD_MS = 30 * 60 * 1000; // one gather every 30 minutes
export const HUB_GATHER_DAILY_CAP = 4; // hard daily limit (rolling 24h) so it can't compound
const DAY_MS = 24 * 60 * 60 * 1000;
const KINDS: ResourceKind[] = ["wood", "food", "stone", "gold"];

export interface HubGatherResult {
  ok: boolean;
  error?: string;
  resource?: ResourceKind;
  amount?: number;
}

export function hubGather(empireId: string): HubGatherResult {
  const e = state.empires[empireId];
  if (!e) return { ok: false, error: "No empire." };

  // per-player cooldown
  if (now() < (e.lastHubGatherAt ?? 0) + HUB_GATHER_CD_MS)
    return { ok: false, error: "Catch your breath — that spot isn't ready yet." };

  // rolling 24h daily cap
  const g = e.hubGather && now() - e.hubGather.since < DAY_MS ? e.hubGather : { count: 0, since: now() };
  if (g.count >= HUB_GATHER_DAILY_CAP)
    return { ok: false, error: "You've gathered plenty in the plaza today — back tomorrow." };

  // tiny random reward (80–140 of one resource)
  const resource = KINDS[Math.floor(Math.random() * KINDS.length)];
  const amount = 80 + Math.floor(Math.random() * 61);
  e.resources[resource] = (e.resources[resource] ?? 0) + amount;

  e.lastHubGatherAt = now();
  e.hubGather = { count: g.count + 1, since: g.since };
  e.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `🪓 Gathered ${amount} ${resource} in the plaza.` });
  if (e.log.length > 60) e.log.length = 60;
  scheduleSave(0);
  return { ok: true, resource, amount };
}
