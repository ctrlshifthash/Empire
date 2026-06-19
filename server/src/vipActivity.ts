// Periodically nudges VIP empire stats so they look like active players.
// Runs every 4-8 hours with a random offset so the pattern isn't obvious.
import { recomputePower } from "./engine.ts";
import { state, scheduleSave } from "./store.ts";

const VIP_ADDRESSES = [
  "EZppbZe5RaXryEd47NdPRX1ytjCd7bpqnZMDQQXMBB2s",
  "57DXn1ZGgfPiT6HqENyokgT9qTyUvpzy4sFraMhAi16z",
  "H61rKATwp2W8AJpZQLarzXyt8Rpho3UzyRhRpkMgAhY",
];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nudge(empire: NonNullable<typeof state.empires[string]>): void {
  // Raids: win 1-3, occasionally lose 1
  empire.raidsWon  = (empire.raidsWon  ?? 0) + rand(1, 3);
  if (Math.random() < 0.25) empire.raidsLost = (empire.raidsLost ?? 0) + 1;

  // Army: small variance per unit type (±2-4%)
  for (const unit of ["villager", "spearman", "archer", "knight"] as const) {
    const current = empire.army[unit] ?? 0;
    const delta = rand(-Math.ceil(current * 0.02), Math.ceil(current * 0.04));
    empire.army[unit] = Math.max(1, current + delta) as typeof current;
  }

  // Resources: simulate gathering and spending
  empire.resources.wood  = Math.max(0, empire.resources.wood  + rand(-500,  2000));
  empire.resources.food  = Math.max(0, empire.resources.food  + rand(-800,  1500));
  empire.resources.gold  = Math.max(0, empire.resources.gold  + rand(-300,  1000));
  empire.resources.stone = Math.max(0, empire.resources.stone + rand(-200,   800));

  recomputePower(empire);
}

function tick(): void {
  let changed = false;
  for (const addr of VIP_ADDRESSES) {
    const user = Object.values(state.users).find((u) => u.externalId === addr);
    const empire = user ? state.empires[user.empireId] : undefined;
    if (!empire || empire.isBot) continue;
    nudge(empire);
    changed = true;
  }
  if (changed) scheduleSave(0);

  // Schedule next tick: random 4-8 hours
  const next = rand(4 * 60 * 60 * 1000, 8 * 60 * 60 * 1000);
  setTimeout(tick, next);
}

export function startVipActivity(): void {
  // First tick after a random 1-3 hour delay so it doesn't fire right on boot
  const initial = rand(1 * 60 * 60 * 1000, 3 * 60 * 60 * 1000);
  setTimeout(tick, initial);
}
