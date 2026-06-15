// ─────────────────────────────────────────────────────────────────────────────
// Empires Eternal — Core simulation engine
// Pure-ish functions that mutate the shared `state`. The realtime/api layers
// call these in response to player actions; tick() advances the whole world.
// ─────────────────────────────────────────────────────────────────────────────
import {
  AGES,
  BUILDINGS,
  RAID_PROTECTION_POWER,
  RESOURCE_KINDS,
  TC_TRICKLE_PER_LEVEL,
  UNITS,
  UNIT_TYPES,
  QUESTS,
  buildSecondsFor,
  nextAge,
  nextLevelCost,
  populationProvided,
  productionPerMinute,
  rushCost,
  ageAtLeast,
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
  return cap;
}

export function usedPopulation(e: Empire): number {
  let used = 0;
  for (const u of Object.keys(e.army) as UnitType[]) used += e.army[u] * UNITS[u].population;
  for (const o of e.trainQueue) used += UNITS[o.unit].population * o.quantity;
  return used;
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
  return clamp(12 + d * 6, 15, 600);
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
    completesAt: now() + buildSecondsFor(type, 0) * 1000,
    job: "build",
  };
  e.buildings.push(building);
  awardXp(e, "construction", constructionXp(cost));
  log(e, "build", `Construction of a ${def.name} has begun.`);
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
  const amt = gatherYield(level, tier);
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
  b.completesAt = now() + buildSecondsFor(b.type, b.level) * 1000;
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
    completesAt: lastDone + udef.trainSeconds * 1000 * quantity,
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

export function actAttack(
  attacker: Empire,
  targetId: string,
  units: Army,
): ActionResult {
  const target = state.empires[targetId];
  if (!target) return { ok: false, error: "Target empire not found." };
  if (target.id === attacker.id) return { ok: false, error: "You cannot attack yourself." };
  if (!target.isBot && target.power < RAID_PROTECTION_POWER)
    return { ok: false, error: `${target.name} is under new-ruler protection.` };

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

  // new-ruler protection: a weak human ruler can't be plundered — the raiding
  // army simply marches home empty-handed (covers raids already in flight).
  if (!defender.isBot && defender.power < RAID_PROTECTION_POWER) {
    queueReturn(march, march.units, { wood: 0, food: 0, gold: 0, stone: 0 }, at, attacker);
    return;
  }

  produce(defender, at);

  const defenderArmyBefore: Partial<Record<UnitType, number>> = { ...defender.army };

  const result = resolveBattle(march.units, {
    army: defender.army,
    wallMultiplier: wallMultiplier(defender),
    garrisonBonus: garrisonBonus(defender),
    resources: defender.resources,
  });
  let razedName: string | null = null;

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
    attacker.coins += 5; // spoils of victory
    const lootTotal = result.loot.wood + result.loot.food + result.loot.gold + result.loot.stone;
    log(
      attacker,
      "battle",
      `Victory at ${defender.name}! Lost ${attackerLost}, plundered ${lootTotal} resources, +5 coins.`,
    );
    log(
      defender,
      "battle",
      `Raided by ${attacker.name}! Lost ${defenderLost} defenders and ${lootTotal} resources.`,
    );

    // a decisive victory razes one of the rival's lesser buildings — real
    // incentive to invade: you weaken them and climb the leaderboard.
    if (result.attackPower > result.defendPower * 1.5) {
      const razeable = defender.buildings
        .filter((b) => b.type !== "town_center" && b.level >= 1 && b.completesAt == null)
        .sort((a, b) => a.level - b.level);
      const razed = razeable[0];
      if (razed) {
        attacker.coins += 5; // bonus for a decisive win
        razedName = BUILDINGS[razed.type].name;
        if (razed.level <= 1) {
          defender.buildings = defender.buildings.filter((b) => b.id !== razed.id);
          log(attacker, "battle", `Decisive victory — you razed the ${razedName} of ${defender.name}!`);
          log(defender, "battle", `${attacker.name} razed your ${razedName} to the ground!`);
        } else {
          razed.level -= 1;
          log(attacker, "battle", `Decisive victory — you damaged the ${razedName} of ${defender.name}.`);
          log(defender, "battle", `${attacker.name} damaged your ${razedName}.`);
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
    razed: razedName,
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
  };
}
