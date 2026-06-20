// ─────────────────────────────────────────────────────────────────────────────
// Realm Rumble — Core simulation engine
// Pure-ish functions that mutate the shared `state`. The realtime/api layers
// call these in response to player actions; tick() advances the whole world.
// ─────────────────────────────────────────────────────────────────────────────
import {
  AGES,
  BUILDINGS,
  MAX_GEAR,
  MAX_ARMOUR,
  MAX_HERO_GEAR,
  raidBlock,
  ACHIEVEMENTS,
  achievementsUnlocked,
  RESOURCE_KINDS,
  TC_TRICKLE_PER_LEVEL,
  TRAITS,
  UNITS,
  UNIT_TYPES,
  QUESTS,
  traitBonuses,
  buildSecondsFor,
  gearCost,
  heroGearCost,
  nextAge,
  nextLevelCost,
  populationProvided,
  MAX_POPULATION,
  productionPerMinute,
  rankForPower,
  rushCost,
  ageAtLeast,
  holderPerksForTier,
  marketItem,
  mountType,
  rankIndex,
  type ShopItem,
} from "../../shared/gamedata.ts";
import { armySize, resolveBattle, type Army } from "../../shared/combat.ts";
import type {
  Building,
  BuildingType,
  Empire,
  GameSnapshot,
  LogEntry,
  March,
  Resources,
  ResourceKind,
  UnitType,
} from "../../shared/types.ts";
import { scheduleSave, state } from "./store.ts";
import { isOnline } from "./presence.ts";
import { areAllies, alliancePublic } from "./alliances.ts";
import { bossPublic } from "./boss.ts";
import { openDuelsPublic, tournamentPublic, myTombstones } from "./arena.ts";
import { inventoryOf, mintItem, randomDropType } from "./market.ts";
import { maybeDropMount } from "./mounts.ts";
import { ownedCharacters } from "./characters.ts";
import { LOCAL_WORLD, type SkillId, type ToolId } from "../../shared/types.ts";
import {
  MAX_TIER,
  SKILLS,
  TIER_NAMES,
  TOOLS,
  constructionXp,
  gatherXp,
  gatherYield,
  levelForXp,
  raidXp,
  resourceSkill,
  resourceTool,
  slayXp,
  toolUpgradeCost,
} from "../../shared/progression.ts";
import {
  BASE_H,
  BASE_W,
  distance,
  ensureHero,
  ensureWorldPositions,
  publicView,
  worldFreeTile,
} from "./world.ts";
import { clamp, now, uid } from "./util.ts";

const RESOURCE_KEYS: ResourceKind[] = ["wood", "food", "gold", "stone"];

// ── small helpers ───────────────────────────────────────────────────────────

export function canAfford(res: Resources, cost: Partial<Resources>): boolean {
  return RESOURCE_KEYS.every((k) => (res[k] ?? 0) >= (cost[k] ?? 0));
}

function pay(res: Resources, cost: Partial<Resources>): void {
  for (const k of RESOURCE_KEYS) res[k] -= cost[k] ?? 0;
}

function grant(res: Resources, gain: Partial<Resources>, cap: number): void {
  for (const k of RESOURCE_KEYS) res[k] = clamp(res[k] + (gain[k] ?? 0), 0, cap);
}

function log(e: Empire, kind: LogEntry["kind"], text: string): void {
  e.log.unshift({ id: uid("log_"), at: now(), kind, text });
  if (e.log.length > 60) e.log.length = 60;
}

// Roll for a marketplace relic drop (used by quests, rank-ups, etc.).
function dropItem(e: Empire, chance: number): void {
  if (Math.random() >= chance) return;
  const typeId = randomDropType();
  if (!typeId) return;
  const inst = mintItem(e.id, typeId);
  if (inst) {
    const def = marketItem(typeId);
    log(e, "system", `🎁 A relic dropped: ${def?.name ?? "an item"} — find it in your inventory / market.`);
  }
}

// Summed passive effects of an empire's equipped marketplace relics.
function equippedEffect(e: Empire): { powerBonus: number; gatherPct: number; speedPct: number } {
  const out = { powerBonus: 0, gatherPct: 0, speedPct: 0 };
  for (const id of e.equipped ?? []) {
    const def = marketItem(state.itemInstances[id]?.typeId ?? "");
    if (!def) continue;
    out.powerBonus += def.powerBonus ?? 0;
    out.gatherPct += def.gatherPct ?? 0;
    out.speedPct += def.speedPct ?? 0;
  }
  // equipped pet/mount trait (gather & speed; SOL-boost pets apply in rewards.ts)
  const pet = e.equippedMount ? mountType(state.mountInstances[e.equippedMount]?.typeId ?? "")?.trait : undefined;
  if (pet?.kind === "gather") out.gatherPct += pet.value;
  else if (pet?.kind === "speed") out.speedPct += pet.value;
  return out;
}

// Harvest & speed multipliers from holder tier perks + equipped relics. Non-
// holders with no relics → 1× (no change). Speed is floored so it can't go ≤0.
const holderGatherMult = (e: Empire): number =>
  1 + holderPerksForTier(e.holderTier).gatherPct + equippedEffect(e).gatherPct;
const holderSpeedMult = (e: Empire): number =>
  Math.max(0.2, 1 - holderPerksForTier(e.holderTier).speedPct - equippedEffect(e).speedPct);

function awardXp(e: Empire, skill: SkillId, amount: number): void {
  if (amount <= 0) return;
  ensureHero(e);
  const before = levelForXp(e.hero.skills[skill] ?? 0);
  e.hero.skills[skill] = (e.hero.skills[skill] ?? 0) + amount;
  const after = levelForXp(e.hero.skills[skill]);
  if (after > before) {
    log(e, "system", `${SKILLS[skill].name} level up! You are now level ${after}.`);
  }
}

const isActive = (b: Building) => b.completesAt == null && b.level >= 1;

export function townCenter(e: Empire): Building | undefined {
  return e.buildings.find((b) => b.type === "town_center");
}

export function warehouseCapacity(e: Empire): number {
  const tc = townCenter(e);
  const tcLevel = tc ? tc.level : 1;
  return 2500 + (tcLevel - 1) * 2000 + AGES[e.age].order * 2500;
}

export function populationCap(e: Empire): number {
  let cap = 0;
  for (const b of e.buildings) {
    if (!isActive(b)) continue;
    cap += populationProvided(b.type, b.level);
  }
  return Math.min(cap, MAX_POPULATION); // hard ceiling — extra houses give no more capacity past this
}

export function usedPopulation(e: Empire): number {
  let used = 0;
  for (const u of Object.keys(e.army) as UnitType[]) used += e.army[u] * UNITS[u].population;
  for (const o of e.trainQueue) used += UNITS[o.unit].population * o.quantity;
  return used;
}

// Trim an empire's standing army down to the population ceiling, scaling every
// unit type proportionally so the army mix is preserved. Used as a one-time
// migration when the cap is introduced (and a safety clamp on load). Returns
// true if it actually cut anything.
export function clampArmyToCap(e: Empire): boolean {
  let armyPop = 0;
  for (const u of Object.keys(e.army) as UnitType[]) armyPop += e.army[u] * UNITS[u].population;
  if (armyPop <= MAX_POPULATION) return false;
  const scale = MAX_POPULATION / armyPop;
  for (const u of Object.keys(e.army) as UnitType[]) e.army[u] = Math.floor(e.army[u] * scale);
  e.trainQueue = []; // drop in-progress training that would push back over the cap
  recomputePower(e);
  return true;
}

function wallMultiplier(e: Empire): number {
  let bonus = 0;
  for (const b of e.buildings) {
    if (isActive(b)) bonus += (BUILDINGS[b.type].defenseBonus ?? 0) * b.level;
  }
  return 1 + bonus;
}

function garrisonBonus(e: Empire): number {
  let g = AGES[e.age].order * 12;
  for (const b of e.buildings) if (isActive(b)) g += 3;
  return g;
}

function freeBaseCell(e: Empire): { x: number; y: number } | null {
  const occupied = new Set(e.buildings.map((b) => `${b.x},${b.y}`));
  for (let y = 0; y < BASE_H; y++) {
    for (let x = 0; x < BASE_W; x++) {
      if (!occupied.has(`${x},${y}`)) return { x, y };
    }
  }
  return null;
}

function travelSeconds(a: Empire, b: Empire): number {
  const d = distance(a.tileX, a.tileY, b.tileX, b.tileY);
  return clamp(6 + d * 2, 6, 40); // short marches so the battle lands soon after you invade
}

// ── passive production ──────────────────────────────────────────────────────

export function produce(e: Empire, at = now()): void {
  const elapsed = at - e.lastTick;
  if (elapsed <= 0) return;
  const minutes = elapsed / 60000;
  const cap = warehouseCapacity(e);
  const gain: Partial<Resources> = {};
  for (const b of e.buildings) {
    if (!isActive(b)) continue;
    const def = BUILDINGS[b.type];
    if (!def.produces) continue;
    const amt = productionPerMinute(b.type, b.level) * minutes;
    gain[def.produces.kind] = (gain[def.produces.kind] ?? 0) + amt;
  }
  // the town centre always trickles a little of everything (anti soft-lock)
  const tc = e.buildings.find((b) => b.type === "town_center" && isActive(b));
  if (tc) {
    for (const k of RESOURCE_KINDS) gain[k] = (gain[k] ?? 0) + TC_TRICKLE_PER_LEVEL[k] * tc.level * minutes;
  }
  grant(e.resources, gain, cap);
  // Resources are kept as floats so that sub-1/tick production still
  // accumulates across the frequent (2s) ticks. Everything that shows or
  // spends resources (display, quests, cost checks) floors at read time.
  e.lastTick = at;
}

// ── job completion ──────────────────────────────────────────────────────────

function finishBuildJobs(e: Empire, at: number): void {
  for (const b of e.buildings) {
    if (b.completesAt != null && b.completesAt <= at) {
      if (b.job === "build") {
        b.level = 1;
        log(e, "build", `${BUILDINGS[b.type].name} construction complete.`);
      } else if (b.job === "upgrade") {
        b.level += 1;
        log(e, "build", `${BUILDINGS[b.type].name} upgraded to level ${b.level}.`);
      }
      b.completesAt = null;
      b.job = null;
    }
  }
}

function finishTraining(e: Empire, at: number): void {
  const remaining: typeof e.trainQueue = [];
  for (const o of e.trainQueue) {
    if (o.completesAt <= at) {
      e.army[o.unit] += o.quantity;
      log(e, "train", `${o.quantity}× ${UNITS[o.unit].name} ready for battle.`);
    } else {
      remaining.push(o);
    }
  }
  e.trainQueue = remaining;
}

function finishAgeUp(e: Empire, at: number): void {
  if (e.ageUpCompletesAt != null && e.ageUpCompletesAt <= at) {
    const n = nextAge(e.age);
    if (n) {
      e.age = n;
      log(e, "system", `Your empire has advanced to the ${AGES[n].name}!`);
    }
    e.ageUpCompletesAt = null;
  }
}

// ── quests & power ──────────────────────────────────────────────────────────

function questMetricValue(e: Empire, metric: (typeof QUESTS)[number]["metric"]): number {
  switch (metric.kind) {
    case "building_count":
      return e.buildings.filter((b) => b.type === metric.building && b.level >= 1).length;
    case "building_level": {
      const b = e.buildings.find((x) => x.type === metric.building);
      return b ? b.level : 0;
    }
    case "resource_total":
      return Math.floor(e.resources[metric.resource]);
    case "army_size":
      return armySize(e.army);
    case "raids_won":
      return e.raidsWon;
    case "reach_age":
      return ageAtLeast(e.age, metric.age) ? 1 : 0;
  }
}

export function updateQuests(e: Empire): void {
  // backfill quests added since this empire was created
  for (const q of QUESTS) {
    if (!e.quests.some((qp) => qp.questId === q.id)) {
      e.quests.push({ questId: q.id, progress: 0, goal: q.goal, completed: false, claimed: false });
    }
  }
  for (const qp of e.quests) {
    const def = QUESTS.find((q) => q.id === qp.questId);
    if (!def) continue;
    const value = questMetricValue(e, def.metric);
    qp.progress = Math.min(value, qp.goal);
    qp.goal = def.goal;
    if (!qp.completed && value >= def.goal) {
      qp.completed = true;
      log(e, "quest", `Quest complete: “${def.title}”. Claim your reward!`);
    }
  }
}

export function recomputePower(e: Empire): void {
  let p = 10 + AGES[e.age].order * 150;
  for (const b of e.buildings) if (b.level >= 1) p += b.level * 8;
  for (const u of Object.keys(e.army) as UnitType[]) {
    p += e.army[u] * (UNITS[u].attack + UNITS[u].defense);
  }
  if (e.armoury) {
    let g = (e.armoury.helmet + e.armoury.heroArmour) * 4;
    for (const u of UNIT_TYPES) g += ((e.armoury.weapon[u] ?? 0) + (e.armoury.armour[u] ?? 0)) * 8;
    p += g;
  }
  p += equippedEffect(e).powerBonus; // equipped relics
  e.power = Math.round(p);
}

// ── player actions (return {ok, error?}) ────────────────────────────────────

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function validWorldSpot(e: Empire, wx?: number, wy?: number): { wx: number; wy: number } {
  if (
    wx != null &&
    wy != null &&
    Number.isFinite(wx) &&
    Number.isFinite(wy) &&
    wx >= 2 &&
    wy >= 2 &&
    wx <= LOCAL_WORLD.width - 2 &&
    wy <= LOCAL_WORLD.height - 2 &&
    !e.buildings.some((b) => b.wx === Math.round(wx) && b.wy === Math.round(wy))
  ) {
    return { wx: Math.round(wx), wy: Math.round(wy) };
  }
  return worldFreeTile(e);
}

export function actBuild(
  e: Empire,
  type: BuildingType,
  pos?: { wx?: number; wy?: number },
): ActionResult {
  const def = BUILDINGS[type];
  if (!def) return { ok: false, error: "Unknown building." };
  if (!ageAtLeast(e.age, def.requiresAge))
    return { ok: false, error: `Requires the ${AGES[def.requiresAge].name}.` };
  if (def.unique && e.buildings.some((b) => b.type === type))
    return { ok: false, error: `You can only have one ${def.name}.` };

  const cost = nextLevelCost(type, 0);
  if (!canAfford(e.resources, cost)) return { ok: false, error: "Not enough resources." };

  const cell = freeBaseCell(e);
  if (!cell) return { ok: false, error: "No room left in your settlement." };

  const spot = validWorldSpot(e, pos?.wx, pos?.wy);

  pay(e.resources, cost);
  const building: Building = {
    id: uid("bld_"),
    type,
    level: 0,
    x: cell.x,
    y: cell.y,
    wx: spot.wx,
    wy: spot.wy,
    completesAt: now() + buildSecondsFor(type, 0) * 1000 * holderSpeedMult(e),
    job: "build",
  };
  e.buildings.push(building);
  awardXp(e, "construction", constructionXp(cost));
  log(e, "build", `Construction of a ${def.name} has begun.`);
  return { ok: true };
}

// Demolish a building the player placed. The Town Centre is the empire's core
// and can't be torn down. Half of everything invested (the build + every
// upgrade) is recovered to your stores.
const DEMOLISH_REFUND = 0.5;
export function actDemolish(e: Empire, buildingId: string): ActionResult {
  const idx = e.buildings.findIndex((b) => b.id === buildingId);
  if (idx < 0) return { ok: false, error: "Building not found." };
  const b = e.buildings[idx];
  if (b.type === "town_center") return { ok: false, error: "You can't demolish your Town Centre." };
  const def = BUILDINGS[b.type];

  // refund 50% of the cumulative cost (build at level 0 → its current level)
  const levels = Math.max(1, b.level);
  const refund: Partial<Resources> = {};
  for (let i = 0; i < levels; i++) {
    const c = nextLevelCost(b.type, i);
    for (const k of RESOURCE_KEYS) refund[k] = (refund[k] ?? 0) + Math.floor((c[k] ?? 0) * DEMOLISH_REFUND);
  }

  e.buildings.splice(idx, 1);
  grant(e.resources, refund, warehouseCapacity(e));
  recomputePower(e);
  const parts = RESOURCE_KEYS.filter((k) => refund[k]).map((k) => `${refund[k]} ${k}`);
  log(e, "build", `Demolished the ${def.name}${parts.length ? ` — recovered ${parts.join(", ")}` : ""}.`);
  return { ok: true };
}

// Harvesting a resource node in the live world. The yield and XP are computed
// from the hero's skill level and tool tier (authoritative), so the client
// can't inflate the amount — it only reports *which* node was struck.
export function actGather(e: Empire, resource: ResourceKind): ActionResult {
  if (!RESOURCE_KEYS.includes(resource)) return { ok: false, error: "Unknown resource." };
  ensureHero(e);
  const skill = resourceSkill(resource);
  const tool = resourceTool(resource);
  const level = levelForXp(e.hero.skills[skill] ?? 0);
  const tier = e.hero.tools[tool] ?? 1;
  // higher ranks + gather traits harvest more; a purchased Harvest Surge stacks
  // a temporary multiplier on top while it lasts.
  const surge = e.boosts?.gatherUntil && e.boosts.gatherUntil > now() ? e.boosts.gatherMult ?? 1 : 1;
  const mult =
    rankForPower(e.power).gatherMult * (1 + traitBonuses(e.traits).gatherPct) * surge * holderGatherMult(e);
  const amt = Math.round(gatherYield(level, tier) * mult);
  const cap = warehouseCapacity(e);
  e.resources[resource] = clamp(e.resources[resource] + amt, 0, cap);
  awardXp(e, skill, gatherXp(resource, tier));
  return { ok: true };
}

export function actUpgradeTool(e: Empire, tool: ToolId): ActionResult {
  ensureHero(e);
  if (!(tool in e.hero.tools)) return { ok: false, error: "Unknown tool." };
  const tier = e.hero.tools[tool];
  if (tier >= MAX_TIER) return { ok: false, error: "Already the finest tier." };
  const cost = toolUpgradeCost(tier);
  if (e.coins < (cost.coins ?? 0)) return { ok: false, error: `Need ${cost.coins} coins.` };
  if (!canAfford(e.resources, cost)) return { ok: false, error: "Not enough resources." };
  pay(e.resources, cost);
  e.coins -= cost.coins ?? 0;
  e.hero.tools[tool] = tier + 1;
  log(e, "system", `Upgraded your ${TOOLS[tool].name} to ${TIER_NAMES[tier + 1]}.`);
  return { ok: true };
}

export function actSlay(e: Empire, kind: string): ActionResult {
  awardXp(e, "combat", slayXp(String(kind || "")));
  return { ok: true };
}

function ensureArmoury(e: Empire): NonNullable<Empire["armoury"]> {
  if (!e.armoury) e.armoury = { weapon: {}, armour: {}, helmet: 0, heroArmour: 0 };
  return e.armoury;
}

// Buy army equipment (weapon = attack, armour = defense, per unit type) or hero
// gear (helmet / armour = extra HP) with coins.
export function actBuyArmoury(
  e: Empire,
  kind: "weapon" | "armour" | "helmet" | "heroArmour",
  unit?: UnitType,
): ActionResult {
  const a = ensureArmoury(e);
  // hero gear (no unit): helmet / armour
  if (kind === "helmet" || kind === "heroArmour") {
    const lvl = kind === "helmet" ? a.helmet : a.heroArmour;
    if (lvl >= MAX_HERO_GEAR) return { ok: false, error: "Already the finest hero gear." };
    const cost = heroGearCost(lvl);
    if (e.coins < cost) return { ok: false, error: `Need ${cost} coins.` };
    e.coins -= cost;
    if (kind === "helmet") a.helmet += 1;
    else a.heroArmour += 1;
    log(e, "system", `Forged finer hero ${kind === "helmet" ? "helmet" : "armour"} (level ${lvl + 1}).`);
    recomputePower(e);
    return { ok: true };
  }
  // army gear (per unit type): weapon / armour
  if (!unit || !UNIT_TYPES.includes(unit)) return { ok: false, error: "Unknown unit type." };
  const track = kind === "weapon" ? a.weapon : a.armour;
  const lvl = track[unit] ?? 0;
  const cap = kind === "weapon" ? MAX_GEAR : MAX_ARMOUR;
  if (lvl >= cap) return { ok: false, error: "Already the finest gear." };
  const cost = gearCost(lvl);
  if (e.coins < cost) return { ok: false, error: `Need ${cost} coins.` };
  e.coins -= cost;
  track[unit] = lvl + 1;
  log(e, "system", `Equipped ${UNITS[unit].name}s with better ${kind} (level ${lvl + 1}).`);
  recomputePower(e);
  return { ok: true };
}

// Learn a hero trait/perk. Free traits cost 0; others cost coins. One-time.
export function actBuyTrait(e: Empire, traitId: string): ActionResult {
  const t = TRAITS.find((x) => x.id === traitId);
  if (!t) return { ok: false, error: "Unknown trait." };
  if (!e.traits) e.traits = [];
  if (e.traits.includes(traitId)) return { ok: false, error: "Already learned." };
  if (e.coins < t.cost) return { ok: false, error: `Need ${t.cost} coins.` };
  e.coins -= t.cost;
  e.traits.push(traitId);
  log(e, "system", `Learned the ${t.name} trait — ${t.desc}.`);
  return { ok: true };
}

// Grant the effect of a token-shop item. Called ONLY after the on-chain payment
// has been verified server-side (see shop.ts). Never trust the client here.
export function applyShopItem(e: Empire, item: ShopItem): ActionResult {
  const fx = item.effect;
  switch (fx.kind) {
    case "resources": {
      if (fx.coins) e.coins += fx.coins;
      // purchased packs are premium: deposited straight to stores, above the
      // passive warehouse cap so big crates aren't wasted.
      if (fx.resources) for (const k of RESOURCE_KEYS) if (fx.resources[k]) e.resources[k] += fx.resources[k]!;
      break;
    }
    case "finishAll": {
      for (const b of e.buildings) if (b.completesAt != null) b.completesAt = now();
      for (const o of e.trainQueue) o.completesAt = now();
      if (e.ageUpCompletesAt != null) e.ageUpCompletesAt = now();
      break;
    }
    case "gatherBuff": {
      e.boosts = { gatherMult: fx.mult, gatherUntil: now() + fx.hours * 3_600_000 };
      break;
    }
    case "army": {
      for (const u of UNIT_TYPES) if (fx.units[u]) e.army[u] = (e.army[u] ?? 0) + fx.units[u]!;
      recomputePower(e);
      break;
    }
    case "trait": {
      if (!e.traits) e.traits = [];
      if (!e.traits.includes(fx.traitId)) e.traits.push(fx.traitId);
      recomputePower(e);
      break;
    }
    case "banner": {
      e.banner = fx.color;
      break;
    }
    default:
      return { ok: false, error: "Unknown shop item." };
  }
  log(e, "system", `Token shop: ${item.name} — ${item.desc}`);
  return { ok: true };
}

export function actUpgrade(e: Empire, buildingId: string): ActionResult {
  const b = e.buildings.find((x) => x.id === buildingId);
  if (!b) return { ok: false, error: "Building not found." };
  if (b.completesAt != null) return { ok: false, error: "That building is already busy." };
  const def = BUILDINGS[b.type];
  if (b.level >= def.maxLevel) return { ok: false, error: "Already at maximum level." };

  const cost = nextLevelCost(b.type, b.level);
  if (!canAfford(e.resources, cost)) return { ok: false, error: "Not enough resources." };

  pay(e.resources, cost);
  b.job = "upgrade";
  b.completesAt = now() + buildSecondsFor(b.type, b.level) * 1000 * holderSpeedMult(e);
  log(e, "build", `Upgrading ${def.name} to level ${b.level + 1}.`);
  return { ok: true };
}

export function actTrain(
  e: Empire,
  buildingType: BuildingType,
  unit: UnitType,
  quantity: number,
): ActionResult {
  quantity = Math.floor(quantity);
  if (quantity <= 0) return { ok: false, error: "Invalid quantity." };
  const udef = UNITS[unit];
  if (!udef) return { ok: false, error: "Unknown unit." };
  if (!ageAtLeast(e.age, udef.requiresAge))
    return { ok: false, error: `Requires the ${AGES[udef.requiresAge].name}.` };

  const building = e.buildings.find((b) => b.type === buildingType && isActive(b));
  if (!building) return { ok: false, error: `Build a ${BUILDINGS[buildingType].name} first.` };
  if (!(BUILDINGS[buildingType].trains ?? []).includes(unit))
    return { ok: false, error: "That building can't train this unit." };

  const popLeft = populationCap(e) - usedPopulation(e);
  const popNeeded = udef.population * quantity;
  if (popNeeded > popLeft)
    return { ok: false, error: "Not enough population. Build more Houses." };

  const totalCost: Partial<Resources> = {};
  for (const [k, v] of Object.entries(udef.cost)) totalCost[k as ResourceKind] = (v as number) * quantity;
  if (!canAfford(e.resources, totalCost)) return { ok: false, error: "Not enough resources." };

  pay(e.resources, totalCost);
  const lastDone = e.trainQueue.reduce((m, o) => Math.max(m, o.completesAt), now());
  e.trainQueue.push({
    id: uid("trn_"),
    unit,
    quantity,
    startedAt: now(),
    completesAt: lastDone + udef.trainSeconds * 1000 * quantity * holderSpeedMult(e),
  });
  log(e, "train", `Training ${quantity}× ${udef.name}.`);
  return { ok: true };
}

export function actAdvanceAge(e: Empire): ActionResult {
  const n = nextAge(e.age);
  if (!n) return { ok: false, error: "Already at the Imperial Age." };
  if (e.ageUpCompletesAt != null) return { ok: false, error: "Already advancing ages." };
  const tc = townCenter(e);
  if (!tc || !isActive(tc)) return { ok: false, error: "Requires an active Town Center." };
  const def = AGES[n];
  if (!canAfford(e.resources, def.cost)) return { ok: false, error: "Not enough resources." };

  pay(e.resources, def.cost);
  e.ageUpCompletesAt = now() + def.researchSeconds * 1000;
  log(e, "system", `Researching the ${def.name}…`);
  return { ok: true };
}

// A target can only be raided once per this window by the same attacker — stops
// farming a single weak bot (or player) over and over for loot.
const RAID_COOLDOWN_MS = 5 * 60 * 1000;
export function actAttack(
  attacker: Empire,
  targetId: string,
  units: Army,
): ActionResult {
  const target = state.empires[targetId];
  if (!target) return { ok: false, error: "Target empire not found." };
  if (target.id === attacker.id) return { ok: false, error: "You cannot attack yourself." };
  if (areAllies(attacker, target)) return { ok: false, error: `${target.name} is your ally — you can't raid them.` };
  // Bracket matchmaking for real players (bots are always fair game). You can't
  // farm the far-weaker ("weak" — the shield), and the far-stronger are out of
  // reach until you grow ("locked"). Routed through here for bots too, so AI
  // raiders respect the same rules.
  if (!target.isBot) {
    const block = raidBlock(attacker.power, target.power, false);
    if (block === "weak")
      return {
        ok: false,
        error: `${target.name} is too weak to raid — pick an empire closer to your own strength.`,
      };
    if (block === "locked")
      return {
        ok: false,
        error: `${target.name} is too powerful to raid yet — grow your army and rank to reach them.`,
      };
  }

  // Per-target raid cooldown — can't spam the same target for loot.
  const lastRaid = attacker.raidCooldowns?.[targetId];
  if (lastRaid && now() - lastRaid < RAID_COOLDOWN_MS) {
    const mins = Math.ceil((RAID_COOLDOWN_MS - (now() - lastRaid)) / 60_000);
    return { ok: false, error: `You raided ${target.name} too recently — regroup or pick another target (~${mins}m).` };
  }

  // Sanitise the payload: only known unit types, integer counts, never more
  // than the attacker actually has. Unknown keys are ignored (not trusted).
  const clean: Army = {};
  let total = 0;
  for (const u of UNIT_TYPES) {
    const n = Math.floor(Number(units[u]) || 0);
    if (n < 0) return { ok: false, error: "Invalid army." };
    if (n > attacker.army[u]) return { ok: false, error: `Not enough ${UNITS[u].name}.` };
    if (n > 0) {
      clean[u] = n;
      total += n;
    }
  }
  if (total <= 0) return { ok: false, error: "Send at least one unit." };

  // detach the marching units from the home army
  for (const u of UNIT_TYPES) if (clean[u]) attacker.army[u] -= clean[u]!;

  const secs = travelSeconds(attacker, target);
  const march: March = {
    id: uid("mar_"),
    fromEmpireId: attacker.id,
    fromName: attacker.name,
    toEmpireId: target.id,
    toName: target.name,
    units: clean,
    departsAt: now(),
    arrivesAt: now() + secs * 1000,
    kind: "attack",
  };
  (attacker.raidCooldowns ??= {})[targetId] = now();
  for (const [k, v] of Object.entries(attacker.raidCooldowns)) if (now() - v > RAID_COOLDOWN_MS) delete attacker.raidCooldowns[k]; // prune stale
  state.marches.push(march);
  log(attacker, "raid", `Your army marches on ${target.name} (arrives in ${Math.round(secs)}s).`);
  return { ok: true };
}

export function actRush(e: Empire, kind: "building" | "age" | "train", id?: string): ActionResult {
  if (kind === "building") {
    const b = e.buildings.find((x) => x.id === id && x.completesAt != null);
    if (!b || b.completesAt == null) return { ok: false, error: "Nothing to rush." };
    const remaining = Math.max(0, (b.completesAt - now()) / 1000);
    const cost = rushCost(remaining);
    if (e.coins < cost) return { ok: false, error: `Need ${cost} coins.` };
    e.coins -= cost;
    b.completesAt = now();
    log(e, "system", `Rushed ${BUILDINGS[b.type].name} for ${cost} coins.`);
    return { ok: true };
  }
  if (kind === "age") {
    if (e.ageUpCompletesAt == null) return { ok: false, error: "Not advancing ages." };
    const remaining = Math.max(0, (e.ageUpCompletesAt - now()) / 1000);
    const cost = rushCost(remaining);
    if (e.coins < cost) return { ok: false, error: `Need ${cost} coins.` };
    e.coins -= cost;
    e.ageUpCompletesAt = now();
    log(e, "system", `Rushed age advancement for ${cost} coins.`);
    return { ok: true };
  }
  if (kind === "train") {
    const order = id
      ? e.trainQueue.find((o) => o.id === id)
      : e.trainQueue.slice().sort((a, b) => a.completesAt - b.completesAt)[0];
    if (!order) return { ok: false, error: "Nothing to rush." };
    const remaining = Math.max(0, (order.completesAt - now()) / 1000);
    const cost = rushCost(remaining);
    if (e.coins < cost) return { ok: false, error: `Need ${cost} coins.` };
    e.coins -= cost;
    order.completesAt = now();
    log(e, "system", `Rushed training for ${cost} coins.`);
    return { ok: true };
  }
  return { ok: false, error: "Unknown rush." };
}

export function actClaimQuest(e: Empire, questId: string): ActionResult {
  const qp = e.quests.find((q) => q.questId === questId);
  const def = QUESTS.find((q) => q.id === questId);
  if (!qp || !def) return { ok: false, error: "Quest not found." };
  if (!qp.completed) return { ok: false, error: "Quest not complete yet." };
  if (qp.claimed) return { ok: false, error: "Reward already claimed." };

  qp.claimed = true;
  const cap = warehouseCapacity(e);
  if (def.reward.coins) e.coins += def.reward.coins;
  grant(e.resources, def.reward, cap);
  const parts: string[] = [];
  if (def.reward.coins) parts.push(`${def.reward.coins} coins`);
  for (const k of RESOURCE_KEYS) if (def.reward[k]) parts.push(`${def.reward[k]} ${k}`);
  log(e, "quest", `Reward claimed: ${parts.join(", ")}.`);
  dropItem(e, 0.2); // 20% chance of a relic drop on quest completion
  return { ok: true };
}

// ── march / battle resolution (world tick) ──────────────────────────────────

function resolveAttack(march: March, at: number): void {
  const attacker = state.empires[march.fromEmpireId];
  const defender = state.empires[march.toEmpireId];
  if (!attacker) return; // attacker vanished, drop march

  if (!defender) {
    // target gone — send the army straight home
    queueReturn(march, march.units, { wood: 0, food: 0, gold: 0, stone: 0 }, at, attacker);
    return;
  }

  // protection for the weak: if the defender has dropped too far below this
  // attacker to be a legal target, the raiding army marches home empty-handed
  // (covers raids that were already in flight when the gap opened up).
  if (raidBlock(attacker.power, defender.power, defender.isBot) === "weak") {
    queueReturn(march, march.units, { wood: 0, food: 0, gold: 0, stone: 0 }, at, attacker);
    return;
  }

  produce(defender, at);

  const defenderArmyBefore: Partial<Record<UnitType, number>> = { ...defender.army };

  const result = resolveBattle(
    march.units,
    {
      army: defender.army,
      wallMultiplier: wallMultiplier(defender),
      garrisonBonus: garrisonBonus(defender),
      resources: defender.resources,
      gear: defender.armoury?.armour, // defender's armour
    },
    attacker.armoury?.weapon, // attacker's weapons
  );
  const razedNames: string[] = [];

  // apply defender casualties
  for (const u of Object.keys(result.defenderLosses) as UnitType[]) {
    defender.army[u] = Math.max(0, defender.army[u] - (result.defenderLosses[u] ?? 0));
  }
  // remove plundered resources from defender
  for (const k of RESOURCE_KEYS) defender.resources[k] = Math.max(0, defender.resources[k] - result.loot[k]);

  const attackerLost = armySize(march.units) - armySize(result.attackerSurvivors);
  const defenderLost = armySize(result.defenderLosses);

  if (result.attackerWins) {
    attacker.raidsWon += 1;
    defender.raidsLost += 1;
    // Coins are only minted by raiding REAL players — bot raids give resources/XP
    // only, so bots can't be farmed for unlimited (sellable) coins.
    const coinReward = defender.isBot ? 0 : 5;
    attacker.coins += coinReward; // spoils of victory
    maybeDropMount(attacker.id); // rare mount drop (beta; no-op while locked)
    const lootTotal = result.loot.wood + result.loot.food + result.loot.gold + result.loot.stone;
    log(
      attacker,
      "battle",
      `Victory at ${defender.name}! Lost ${attackerLost}, plundered ${lootTotal} resources${coinReward ? `, +${coinReward} coins` : ""}.`,
    );
    log(
      defender,
      "battle",
      `Raided by ${attacker.name}! Lost ${defenderLost} defenders and ${lootTotal} resources.`,
    );

    // Victory destroys the rival's buildings — the more decisive, the more you
    // raze. Wrecking their infrastructure (not just their soldiers) is the real
    // way to weaken a world and climb the leaderboard.
    const ratio = result.attackPower / Math.max(1, result.defendPower);
    const razeCount = ratio > 2.5 ? 3 : ratio > 1.5 ? 2 : ratio > 1.1 ? 1 : 0;
    if (razeCount > 0) {
      const razeable = defender.buildings
        .filter((b) => b.type !== "town_center" && b.level >= 1 && b.completesAt == null)
        .sort((a, b) => a.level - b.level);
      for (const razed of razeable.slice(0, razeCount)) {
        if (!defender.isBot) attacker.coins += 5; // raze bounty — real-player raids only (no bot coin farming)
        const name = BUILDINGS[razed.type].name;
        razedNames.push(name);
        if (razed.level <= 1) {
          defender.buildings = defender.buildings.filter((b) => b.id !== razed.id);
          log(attacker, "battle", `You razed the ${name} of ${defender.name}!`);
          log(defender, "battle", `${attacker.name} razed your ${name} to the ground!`);
        } else {
          razed.level -= 1;
          log(attacker, "battle", `You wrecked the ${name} of ${defender.name}.`);
          log(defender, "battle", `${attacker.name} wrecked your ${name}.`);
        }
      }
    }
  } else {
    attacker.raidsLost += 1;
    log(attacker, "battle", `Defeat at ${defender.name}. Lost ${attackerLost} units.`);
    log(defender, "battle", `Defended against ${attacker.name}, slaying ${attackerLost} attackers.`);
  }

  // record a replayable battle report on both empires
  const baseReport = {
    id: uid("bat_"),
    at,
    attackerName: attacker.name,
    defenderName: defender.name,
    attackerArmy: { ...march.units },
    defenderArmy: defenderArmyBefore,
    attackerLosses: result.attackerLosses,
    defenderLosses: result.defenderLosses,
    attackerWon: result.attackerWins,
    loot: result.loot,
    razed: razedNames,
    attackPower: result.attackPower,
    defendPower: result.defendPower,
  };
  attacker.battles = [{ ...baseReport, role: "attacker" as const }, ...(attacker.battles ?? [])].slice(0, 8);
  defender.battles = [{ ...baseReport, role: "defender" as const }, ...(defender.battles ?? [])].slice(0, 8);

  awardXp(attacker, "combat", raidXp(result.defendPower, result.attackerWins));
  recomputePower(defender);
  queueReturn(march, result.attackerSurvivors, result.loot, at, attacker);
}

function queueReturn(
  march: March,
  survivors: Army,
  loot: Resources,
  at: number,
  attacker: Empire,
): void {
  if (armySize(survivors) <= 0) {
    // whole army destroyed; nothing comes home
    log(attacker, "battle", `Your army was wiped out at ${march.toName}.`);
    recomputePower(attacker);
    return;
  }
  const defender = state.empires[march.toEmpireId];
  const ret: March = {
    id: uid("mar_"),
    fromEmpireId: march.fromEmpireId,
    fromName: march.fromName,
    toEmpireId: march.toEmpireId,
    toName: march.toName,
    units: survivors,
    survivors,
    loot,
    departsAt: at,
    arrivesAt: at + (defender ? travelSeconds(attacker, defender) : 20) * 1000,
    kind: "return",
  };
  state.marches.push(ret);
}

function resolveReturn(march: March, at: number): void {
  const home = state.empires[march.fromEmpireId];
  if (!home) return;
  produce(home, at);
  const survivors = march.survivors ?? march.units;
  for (const u of Object.keys(survivors) as UnitType[]) {
    home.army[u] = (home.army[u] ?? 0) + (survivors[u] ?? 0);
  }
  if (march.loot) {
    grant(home.resources, march.loot, warehouseCapacity(home));
    const lootTotal = march.loot.wood + march.loot.food + march.loot.gold + march.loot.stone;
    if (lootTotal > 0) log(home, "raid", `Your army returns home with ${lootTotal} plundered resources.`);
    else log(home, "raid", `Your army returns home.`);
  }
  recomputePower(home);
}

function processMarches(at: number): void {
  const stillMarching: March[] = [];
  for (const m of state.marches) {
    if (m.arrivesAt <= at) {
      if (m.kind === "attack") resolveAttack(m, at);
      else resolveReturn(m, at);
    } else {
      stillMarching.push(m);
    }
  }
  state.marches = stillMarching;
}

// ── the world tick ──────────────────────────────────────────────────────────

export function refreshEmpire(e: Empire, at = now()): void {
  produce(e, at);
  finishBuildJobs(e, at);
  finishTraining(e, at);
  finishAgeUp(e, at);
  ensureHero(e);
  ensureWorldPositions(e);
  updateQuests(e);
  recomputePower(e);
  checkAchievements(e);
}

// Award any newly-earned achievements (logged once). Derived from the empire's
// own progress, so it's self-correcting and matches what the client shows.
function checkAchievements(e: Empire): void {
  const unlocked = achievementsUnlocked({
    raidsWon: e.raidsWon,
    power: e.power,
    age: e.age,
    buildingsBuilt: e.buildings.filter((b) => b.level >= 1).length,
    bossKills: e.bossKills ?? 0,
    inAlliance: !!e.allianceId,
  });
  if (!e.achievements) e.achievements = [];
  for (const id of unlocked) {
    if (!e.achievements.includes(id)) {
      e.achievements.push(id);
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (def) log(e, "system", `🏅 Achievement unlocked: ${def.name} — ${def.desc}.`);
    }
  }

  // rank-up relic drop: every time the empire reaches a new renown rank
  const idx = rankIndex(e.power);
  if (e.lastRankIdx == null) e.lastRankIdx = idx;
  else if (idx > e.lastRankIdx) {
    e.lastRankIdx = idx;
    dropItem(e, 1); // guaranteed drop on rank-up
  }
}

export function tick(at = now()): void {
  state.world.tick += 1;
  processMarches(at);
  for (const e of Object.values(state.empires)) {
    refreshEmpire(e, at);
  }
  scheduleSave();
}

// ── snapshots ───────────────────────────────────────────────────────────────

export function snapshotFor(empireId: string): GameSnapshot | null {
  const empire = state.empires[empireId];
  if (!empire) return null;
  refreshEmpire(empire);
  const others = Object.values(state.empires)
    .filter((e) => e.id !== empireId)
    .map((e) => publicView(e, isOnline(e.id)));
  const incomingMarches = state.marches.filter(
    (m) => m.kind === "attack" && m.toEmpireId === empireId,
  );
  const outgoingMarches = state.marches.filter((m) => m.fromEmpireId === empireId);
  return {
    empire,
    world: state.world,
    others,
    incomingMarches,
    outgoingMarches,
    serverTime: now(),
    alliance: alliancePublic(empire.allianceId),
    boss: bossPublic(empireId),
    duels: openDuelsPublic(),
    tombstones: myTombstones(empireId),
    tournament: tournamentPublic(empireId),
    inventory: inventoryOf(empireId),
    characters: ownedCharacters(empireId),
  };
}
