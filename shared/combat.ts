// ─────────────────────────────────────────────────────────────────────────────
// Empires Eternal — Deterministic battle resolution (shared)
// A Travian-inspired power-ratio model: the stronger side wins and the loser
// takes heavy proportional casualties while the winner loses a share scaled by
// how close the fight was. Defenders gain a home / wall advantage.
// ─────────────────────────────────────────────────────────────────────────────
import { GEAR_BONUS, UNITS } from "./gamedata";
import type { Resources, UnitType } from "./types";

export type Army = Partial<Record<UnitType, number>>;
export type Gear = Partial<Record<UnitType, number>>; // weapon/armour level per unit type

const gearMult = (gear: Gear | undefined, u: UnitType) => 1 + (gear?.[u] ?? 0) * GEAR_BONUS;

export interface BattleResult {
  attackerWins: boolean;
  attackPower: number;
  defendPower: number;
  attackerLosses: Army;
  defenderLosses: Army;
  attackerSurvivors: Army;
  defenderSurvivors: Army;
  loot: Resources;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function offensivePower(army: Army, gear?: Gear): number {
  let p = 0;
  for (const [u, n] of Object.entries(army)) {
    if (!n) continue;
    const def = UNITS[u as UnitType];
    if (!def) continue; // ignore unknown unit keys (defensive)
    p += n * (def.attack + def.hp * 0.05) * gearMult(gear, u as UnitType);
  }
  return p;
}

function defensivePower(army: Army, wallMultiplier: number, garrisonBonus: number, gear?: Gear): number {
  let p = 0;
  for (const [u, n] of Object.entries(army)) {
    if (!n) continue;
    const def = UNITS[u as UnitType];
    if (!def) continue;
    p += n * (def.defense + def.hp * 0.05) * gearMult(gear, u as UnitType);
  }
  return p * wallMultiplier + garrisonBonus;
}

function applyLosses(army: Army, frac: number): { losses: Army; survivors: Army } {
  const losses: Army = {};
  const survivors: Army = {};
  for (const [u, n] of Object.entries(army)) {
    if (!n) continue;
    const lost = clamp(Math.round(n * frac), 0, n);
    losses[u as UnitType] = lost;
    survivors[u as UnitType] = n - lost;
  }
  return { losses, survivors };
}

function carryCapacity(army: Army): number {
  let c = 0;
  for (const [u, n] of Object.entries(army)) {
    if (!n) continue;
    const def = UNITS[u as UnitType];
    if (!def) continue;
    c += n * def.carry;
  }
  return c;
}

export interface DefenderContext {
  army: Army;
  // multiplier from walls, e.g. 1 + level*0.12
  wallMultiplier: number;
  // flat defensive bonus from a developed base
  garrisonBonus: number;
  // resources available to plunder
  resources: Resources;
  // defender's armour levels per unit type
  gear?: Gear;
}

export function resolveBattle(attacker: Army, defender: DefenderContext, attackerGear?: Gear): BattleResult {
  const attackPower = offensivePower(attacker, attackerGear);
  const defendPower = defensivePower(
    defender.army,
    defender.wallMultiplier,
    defender.garrisonBonus,
    defender.gear,
  );

  const attackerWins = attackPower > defendPower;

  let attackerLossFrac: number;
  let defenderLossFrac: number;

  if (attackerWins) {
    const x = defendPower <= 0 ? 0 : clamp(defendPower / attackPower, 0, 1);
    attackerLossFrac = clamp(Math.pow(x, 1.5), 0, 0.9);
    defenderLossFrac = clamp(0.65 + 0.35 * (1 - x), 0.7, 1);
  } else {
    const x = attackPower <= 0 ? 0 : clamp(attackPower / defendPower, 0, 1);
    defenderLossFrac = clamp(Math.pow(x, 1.5) * 0.8, 0, 0.85);
    attackerLossFrac = clamp(0.7 + 0.3 * (1 - x), 0.75, 1);
  }

  const att = applyLosses(attacker, attackerLossFrac);
  const def = applyLosses(defender.army, defenderLossFrac);

  // Loot — only the winning attacker plunders.
  const loot: Resources = { wood: 0, food: 0, gold: 0, stone: 0 };
  if (attackerWins) {
    const capacity = carryCapacity(att.survivors);
    const plunderShare = 0.5; // up to half of what the defender is holding
    const available =
      defender.resources.wood +
      defender.resources.food +
      defender.resources.gold +
      defender.resources.stone;
    const wanted = Math.min(capacity, available * plunderShare);
    if (available > 0 && wanted > 0) {
      // proportional plunder across all resources, bounded by carry capacity
      const ratio = Math.min(plunderShare, wanted / available);
      loot.wood = Math.floor(defender.resources.wood * ratio);
      loot.food = Math.floor(defender.resources.food * ratio);
      loot.gold = Math.floor(defender.resources.gold * ratio);
      loot.stone = Math.floor(defender.resources.stone * ratio);
    }
  }

  return {
    attackerWins,
    attackPower: Math.round(attackPower),
    defendPower: Math.round(defendPower),
    attackerLosses: att.losses,
    defenderLosses: def.losses,
    attackerSurvivors: att.survivors,
    defenderSurvivors: def.survivors,
    loot,
  };
}

export function armySize(army: Army): number {
  let n = 0;
  for (const v of Object.values(army)) n += v || 0;
  return n;
}
