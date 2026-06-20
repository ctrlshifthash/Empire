// Client-side mirrors of the server's derived values (display only).
// Formulas here MUST match server/src/engine.ts to avoid confusing the player.
import {
  AGES,
  BUILDINGS,
  RESOURCE_KINDS,
  TC_TRICKLE_PER_LEVEL,
  UNITS,
  MAX_POPULATION,
  populationProvided,
  productionPerMinute,
} from "@shared/gamedata";
import type { Building, Empire, ResourceKind } from "@shared/types";

export const isActive = (b: Building) => b.completesAt == null && b.level >= 1;

export function townCenterLevel(e: Empire): number {
  const tc = e.buildings.find((b) => b.type === "town_center");
  return tc ? tc.level : 1;
}

export function warehouseCapacity(e: Empire): number {
  return 2500 + (townCenterLevel(e) - 1) * 2000 + AGES[e.age].order * 2500;
}

export function populationCap(e: Empire): number {
  let cap = 0;
  for (const b of e.buildings) if (isActive(b)) cap += populationProvided(b.type, b.level);
  return Math.min(cap, MAX_POPULATION); // mirror the server's hard ceiling
}

export function usedPopulation(e: Empire): number {
  let used = 0;
  for (const u of Object.keys(e.army) as (keyof typeof e.army)[]) {
    used += e.army[u] * UNITS[u].population;
  }
  for (const o of e.trainQueue) used += UNITS[o.unit].population * o.quantity;
  return used;
}

export function productionPerMin(e: Empire): Record<ResourceKind, number> {
  const out: Record<ResourceKind, number> = { wood: 0, food: 0, gold: 0, stone: 0 };
  for (const b of e.buildings) {
    if (!isActive(b)) continue;
    const def = BUILDINGS[b.type];
    if (def.produces) out[def.produces.kind] += productionPerMinute(b.type, b.level);
  }
  // town-centre trickle (must match server produce())
  const tc = e.buildings.find((b) => b.type === "town_center" && isActive(b));
  if (tc) for (const k of RESOURCE_KINDS) out[k] += TC_TRICKLE_PER_LEVEL[k] * tc.level;
  return out;
}

export function armyTotal(e: Empire): number {
  return e.army.villager + e.army.spearman + e.army.archer + e.army.knight;
}

export function wallDefensePct(e: Empire): number {
  let bonus = 0;
  for (const b of e.buildings) {
    if (isActive(b)) bonus += (BUILDINGS[b.type].defenseBonus ?? 0) * b.level;
  }
  return Math.round(bonus * 100);
}
