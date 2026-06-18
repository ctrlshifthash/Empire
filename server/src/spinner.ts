// Spinner Wheel (beta). A free spin every 12h that awards resources or a relic —
// never coins. Paid spins that burn $RUMBLE come with the unlock. Gated by the
// `spinner` beta flag.
import { SPIN_SEGMENTS, SPIN_COOLDOWN_MS } from "../../shared/gamedata.ts";
import { state, scheduleSave } from "./store.ts";
import { isLocked } from "./features.ts";
import { mintItem, randomDropType } from "./market.ts";
import { now, uid } from "./util.ts";

export interface SpinResult {
  ok: boolean;
  error?: string;
  index?: number; // winning segment index (drives the wheel animation)
  reward?: string;
}

export function freeSpin(empireId: string): SpinResult {
  if (isLocked("spinner")) return { ok: false, error: "The Spinner is in beta — not live yet." };
  const e = state.empires[empireId];
  if (!e) return { ok: false, error: "No empire." };
  if (now() < (e.lastSpinAt ?? 0) + SPIN_COOLDOWN_MS) return { ok: false, error: "Your free spin isn't ready yet." };

  // weighted pick
  const total = SPIN_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
  let r = Math.random() * total;
  let idx = 0;
  for (let i = 0; i < SPIN_SEGMENTS.length; i++) {
    r -= SPIN_SEGMENTS[i].weight;
    if (r <= 0) {
      idx = i;
      break;
    }
  }
  const seg = SPIN_SEGMENTS[idx];
  let reward = seg.label;
  if (seg.resources) {
    e.resources.wood += seg.resources.wood ?? 0;
    e.resources.food += seg.resources.food ?? 0;
    e.resources.gold += seg.resources.gold ?? 0;
    e.resources.stone += seg.resources.stone ?? 0;
  }
  if (seg.relic) {
    const t = randomDropType();
    if (t) {
      mintItem(empireId, t);
      reward = "a relic!";
    } else {
      e.resources.gold += 5000; // sold out — consolation
      reward = "5,000 Gold";
    }
  }
  e.lastSpinAt = now();
  e.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `🎡 Spun the wheel: ${reward}` });
  if (e.log.length > 60) e.log.length = 60;
  scheduleSave(0);
  return { ok: true, index: idx, reward };
}
