// ─────────────────────────────────────────────────────────────────────────────
// Realm Rumble — Static game definitions & balance (shared client + server)
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AgeDef,
  AgeId,
  BuildingDef,
  BuildingType,
  QuestDef,
  Resources,
  UnitDef,
  UnitType,
} from "./types";

export const RESOURCE_KINDS = ["wood", "food", "gold", "stone"] as const;

// Empires below this power are under "new-ruler protection" — they can't be
// raided, so a fresh or freshly-plundered empire gets room to rebuild.
// Set to 0 to disable the flat floor entirely (the mismatch shield below still
// applies).
export const RAID_PROTECTION_POWER = 0;

// Mismatch shield: a real player can only be raided by an empire whose power is
// at most 1/RAID_SHIELD_RATIO times theirs. In other words a target must be at
// least this fraction of the attacker's power to be a legal target — so the
// strong can't farm the weak. Weaker empires may still "punch up" at stronger
// ones, and bots are always fair game. Raise toward 1 for tighter brackets,
// lower toward 0 to loosen (0 = no shield).
export const RAID_SHIELD_RATIO = 0.5;

// The town centre always yields a small trickle of every resource per level, so
// an empire can never be fully soft-locked out of rebuilding its economy.
export const TC_TRICKLE_PER_LEVEL: Resources = { wood: 18, food: 18, gold: 8, stone: 8 };

// Bot difficulty tiers. Each caps how powerful that rival grows, so the world
// always holds a spread of farmable rookies up to fearsome conquerors. `weight`
// skews the spawn mix toward weaker rivals so new rulers have targets to farm.
export interface BotTier {
  tier: number;
  rank: string;
  powerCap: number;
  weight: number;
  startSpears: number; // head-start army so the tier reaches its band sooner
}
export const BOT_TIERS: BotTier[] = [
  { tier: 0, rank: "Hamlet", powerCap: 70, weight: 30, startSpears: 0 }, // defenceless pushovers
  { tier: 1, rank: "Rookie", powerCap: 280, weight: 26, startSpears: 1 },
  { tier: 2, rank: "Squire", powerCap: 700, weight: 18, startSpears: 3 },
  { tier: 3, rank: "Knight", powerCap: 1600, weight: 12, startSpears: 7 },
  { tier: 4, rank: "Warlord", powerCap: 3600, weight: 9, startSpears: 14 },
  { tier: 5, rank: "Conqueror", powerCap: 99999, weight: 5, startSpears: 26 },
];
export function botTier(tier: number | undefined): BotTier {
  return BOT_TIERS.find((t) => t.tier === tier) ?? BOT_TIERS[BOT_TIERS.length - 1];
}
// Pick a tier by weight, given a 0..1 random roll.
export function rollBotTier(roll: number): BotTier {
  const total = BOT_TIERS.reduce((s, t) => s + t.weight, 0);
  let acc = roll * total;
  for (const t of BOT_TIERS) {
    acc -= t.weight;
    if (acc <= 0) return t;
  }
  return BOT_TIERS[0];
}

export const EMPTY_RESOURCES = (): Resources => ({ wood: 0, food: 0, gold: 0, stone: 0 });

export const STARTING_RESOURCES = (): Resources => ({
  wood: 350,
  food: 300,
  gold: 120,
  stone: 150,
});

export const AGES: Record<AgeId, AgeDef> = {
  dark: {
    id: "dark",
    name: "Dark Age",
    order: 0,
    cost: {},
    researchSeconds: 0,
    blurb: "A humble settlement takes root in the wilderness.",
  },
  feudal: {
    id: "feudal",
    name: "Feudal Age",
    order: 1,
    cost: { food: 500, gold: 200 },
    researchSeconds: 90,
    blurb: "Markets, archers and stone walls bring order to the land.",
  },
  castle: {
    id: "castle",
    name: "Castle Age",
    order: 2,
    cost: { food: 1200, gold: 800, stone: 600 },
    researchSeconds: 240,
    blurb: "Knights ride out from mighty stone keeps.",
  },
  imperial: {
    id: "imperial",
    name: "Imperial Age",
    order: 3,
    cost: { food: 3000, gold: 2500, stone: 1500 },
    researchSeconds: 600,
    blurb: "An empire at the height of its power, feared across the world.",
  },
};

export const AGE_ORDER: AgeId[] = ["dark", "feudal", "castle", "imperial"];

export function nextAge(age: AgeId): AgeId | null {
  const i = AGE_ORDER.indexOf(age);
  return i >= 0 && i < AGE_ORDER.length - 1 ? AGE_ORDER[i + 1] : null;
}

export function ageAtLeast(age: AgeId, required: AgeId): boolean {
  return AGES[age].order >= AGES[required].order;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  town_center: {
    type: "town_center",
    name: "Town Center",
    description: "The heart of your empire. Provides population and lets you advance ages.",
    icon: "🏛️",
    baseCost: { wood: 250, stone: 100 },
    populationProvided: 8,
    buildSeconds: 20,
    requiresAge: "dark",
    maxLevel: 5,
    trains: ["villager"],
    unique: true,
  },
  house: {
    type: "house",
    name: "House",
    description: "Shelters your population, raising your unit capacity.",
    icon: "🏠",
    baseCost: { wood: 60 },
    populationProvided: 6,
    buildSeconds: 15,
    requiresAge: "dark",
    maxLevel: 10,
  },
  lumber_camp: {
    type: "lumber_camp",
    name: "Lumber Camp",
    description: "Villagers fell timber from the forest, producing wood over time.",
    icon: "🪵",
    baseCost: { wood: 80, food: 20 },
    produces: { kind: "wood", perMinute: 30 },
    buildSeconds: 20,
    requiresAge: "dark",
    maxLevel: 10,
  },
  farm: {
    type: "farm",
    name: "Farm",
    description: "Fields of grain feed your people, producing food over time.",
    icon: "🌾",
    baseCost: { wood: 60 },
    produces: { kind: "food", perMinute: 28 },
    buildSeconds: 18,
    requiresAge: "dark",
    maxLevel: 10,
  },
  gold_mine: {
    type: "gold_mine",
    name: "Gold Mine",
    description: "Miners dig precious gold, the lifeblood of armies and trade.",
    icon: "⛏️",
    baseCost: { wood: 100, stone: 40 },
    produces: { kind: "gold", perMinute: 18 },
    buildSeconds: 30,
    requiresAge: "feudal",
    maxLevel: 10,
  },
  quarry: {
    type: "quarry",
    name: "Stone Quarry",
    description: "Hewn stone for walls, keeps and the wonders of your age.",
    icon: "🪨",
    baseCost: { wood: 90, food: 30 },
    produces: { kind: "stone", perMinute: 20 },
    buildSeconds: 28,
    requiresAge: "feudal",
    maxLevel: 10,
  },
  barracks: {
    type: "barracks",
    name: "Barracks",
    description: "Train spearmen — sturdy infantry that anchor your battle line.",
    icon: "⚔️",
    baseCost: { wood: 150, food: 50 },
    buildSeconds: 35,
    requiresAge: "dark",
    maxLevel: 5,
    trains: ["spearman"],
  },
  archery_range: {
    type: "archery_range",
    name: "Archery Range",
    description: "Train archers — ranged attackers that soften enemy ranks.",
    icon: "🏹",
    baseCost: { wood: 175, gold: 25 },
    buildSeconds: 40,
    requiresAge: "feudal",
    maxLevel: 5,
    trains: ["archer"],
  },
  stable: {
    type: "stable",
    name: "Stable",
    description: "Train knights — heavy cavalry that shatter enemy formations.",
    icon: "🐎",
    baseCost: { wood: 200, gold: 100 },
    buildSeconds: 50,
    requiresAge: "castle",
    maxLevel: 5,
    trains: ["knight"],
  },
  wall: {
    type: "wall",
    name: "Stone Wall",
    description: "Fortifications that grant your defenders a powerful edge. Place them in a line to barricade your territory.",
    icon: "🧱",
    baseCost: { stone: 60 },
    buildSeconds: 12,
    requiresAge: "dark",
    maxLevel: 8,
    defenseBonus: 0.06, // +6% defense per level
  },
  tower: {
    type: "tower",
    name: "Watch Tower",
    description: "A tall stone tower bristling with defenders — the backbone of a strong fortification.",
    icon: "🗼",
    baseCost: { stone: 110, wood: 40 },
    buildSeconds: 25,
    requiresAge: "dark",
    maxLevel: 5,
    defenseBonus: 0.16, // +16% defense per level
  },
  gate: {
    type: "gate",
    name: "Gatehouse",
    description: "A fortified gate guarding the way in — cannons watch the approach.",
    icon: "🚪",
    baseCost: { stone: 90, wood: 60 },
    buildSeconds: 22,
    requiresAge: "dark",
    maxLevel: 5,
    defenseBonus: 0.1, // +10% defense per level
  },
  market: {
    type: "market",
    name: "Market",
    description: "Trade routes that trickle in gold and unlock the coin economy.",
    icon: "🏪",
    baseCost: { wood: 175, stone: 50 },
    produces: { kind: "gold", perMinute: 8 },
    buildSeconds: 30,
    requiresAge: "feudal",
    maxLevel: 6,
  },
  keep: {
    type: "keep",
    name: "Castle Keep",
    description: "A mighty stronghold. Houses many troops and hugely strengthens your defence.",
    icon: "🏯",
    baseCost: { wood: 300, stone: 400 },
    populationProvided: 10,
    buildSeconds: 80,
    requiresAge: "castle",
    maxLevel: 5,
    defenseBonus: 0.2, // +20% defence per level
  },
  temple: {
    type: "temple",
    name: "Temple",
    description: "A place of worship that draws pilgrims, tithes and a steady flow of gold.",
    icon: "⛪",
    baseCost: { wood: 220, stone: 180 },
    produces: { kind: "gold", perMinute: 16 },
    populationProvided: 4,
    buildSeconds: 60,
    requiresAge: "castle",
    maxLevel: 6,
  },
  wonder: {
    type: "wonder",
    name: "Wonder",
    description: "A monument to your eternal empire — immense population and prestige. The ultimate build.",
    icon: "🗽",
    baseCost: { wood: 2000, stone: 2000, gold: 1500 },
    populationProvided: 30,
    buildSeconds: 240,
    requiresAge: "imperial",
    maxLevel: 1,
    unique: true,
  },
};

export const BUILDING_TYPES = Object.keys(BUILDINGS) as BuildingType[];

export const UNITS: Record<UnitType, UnitDef> = {
  villager: {
    type: "villager",
    name: "Villager",
    description: "Backbone of the economy. Counts toward defense at home.",
    icon: "👨‍🌾",
    cost: { food: 50 },
    population: 1,
    attack: 3,
    defense: 4,
    hp: 25,
    carry: 10,
    trainSeconds: 12,
    requiresAge: "dark",
    trainedAt: "town_center",
  },
  spearman: {
    type: "spearman",
    name: "Spearman",
    description: "Cheap, sturdy infantry. Strong versus cavalry.",
    icon: "🛡️",
    cost: { food: 35, wood: 25 },
    population: 1,
    attack: 12,
    defense: 14,
    hp: 45,
    carry: 25,
    trainSeconds: 16,
    requiresAge: "dark",
    trainedAt: "barracks",
  },
  archer: {
    type: "archer",
    name: "Archer",
    description: "Ranged damage that melts infantry from afar.",
    icon: "🏹",
    cost: { wood: 35, gold: 25 },
    population: 1,
    attack: 20,
    defense: 7,
    hp: 35,
    carry: 20,
    trainSeconds: 20,
    requiresAge: "feudal",
    trainedAt: "archery_range",
  },
  knight: {
    type: "knight",
    name: "Knight",
    description: "Elite heavy cavalry. Devastating on the charge.",
    icon: "🐴",
    cost: { food: 70, gold: 75 },
    population: 2,
    attack: 38,
    defense: 22,
    hp: 110,
    carry: 50,
    trainSeconds: 34,
    requiresAge: "castle",
    trainedAt: "stable",
  },
};

export const UNIT_TYPES = Object.keys(UNITS) as UnitType[];

export const QUESTS: QuestDef[] = [
  {
    id: "q_first_lumber",
    title: "Timber!",
    description: "Build your first Lumber Camp.",
    goal: 1,
    reward: { coins: 25, food: 100 },
    metric: { kind: "building_count", building: "lumber_camp" },
  },
  {
    id: "q_first_farm",
    title: "Bread & Grain",
    description: "Build a Farm to feed your people.",
    goal: 1,
    reward: { coins: 25, wood: 100 },
    metric: { kind: "building_count", building: "farm" },
  },
  {
    id: "q_houses",
    title: "A Growing Town",
    description: "Build 3 Houses to expand your population.",
    goal: 3,
    reward: { coins: 40, wood: 150 },
    metric: { kind: "building_count", building: "house" },
  },
  {
    id: "q_feudal",
    title: "Into the Feudal Age",
    description: "Advance your empire to the Feudal Age.",
    goal: 1,
    reward: { coins: 80, gold: 150 },
    metric: { kind: "reach_age", age: "feudal" },
  },
  {
    id: "q_army_10",
    title: "Raise the Banners",
    description: "Field an army of 10 units.",
    goal: 10,
    reward: { coins: 60, food: 200, gold: 100 },
    metric: { kind: "army_size" },
  },
  {
    id: "q_first_raid",
    title: "First Blood",
    description: "Win your first raid against a rival empire.",
    goal: 1,
    reward: { coins: 120, gold: 250 },
    metric: { kind: "raids_won" },
  },
  {
    id: "q_wood_2000",
    title: "Stockpile",
    description: "Hold 2,000 wood at once.",
    goal: 2000,
    reward: { coins: 50, stone: 250 },
    metric: { kind: "resource_total", resource: "wood" },
  },
  {
    id: "q_castle",
    title: "Rise of the Keep",
    description: "Advance to the Castle Age.",
    goal: 1,
    reward: { coins: 200, gold: 400, stone: 300 },
    metric: { kind: "reach_age", age: "castle" },
  },
  {
    id: "q_army_40",
    title: "A Standing Army",
    description: "Field an army of 40 units.",
    goal: 40,
    reward: { coins: 180, food: 500, gold: 300 },
    metric: { kind: "army_size" },
  },
  {
    id: "q_imperial",
    title: "Empire Eternal",
    description: "Reach the Imperial Age — the pinnacle of power.",
    goal: 1,
    reward: { coins: 500, gold: 1000, stone: 800 },
    metric: { kind: "reach_age", age: "imperial" },
  },
  {
    id: "q_lumber_2",
    title: "Timber Trade",
    description: "Operate 2 Lumber Camps.",
    goal: 2,
    reward: { coins: 40, wood: 200 },
    metric: { kind: "building_count", building: "lumber_camp" },
  },
  {
    id: "q_farms_2",
    title: "Full Granary",
    description: "Run 2 Farms to feed your people.",
    goal: 2,
    reward: { coins: 40, food: 200 },
    metric: { kind: "building_count", building: "farm" },
  },
  {
    id: "q_market",
    title: "Open for Business",
    description: "Build a Market to unlock the coin economy.",
    goal: 1,
    reward: { coins: 60, gold: 120 },
    metric: { kind: "building_count", building: "market" },
  },
  {
    id: "q_barracks",
    title: "Muster the Ranks",
    description: "Raise a Barracks to train soldiers.",
    goal: 1,
    reward: { coins: 50, food: 150 },
    metric: { kind: "building_count", building: "barracks" },
  },
  {
    id: "q_walls_3",
    title: "Hold the Line",
    description: "Raise 3 Stone Walls to barricade your territory.",
    goal: 3,
    reward: { coins: 70, stone: 200 },
    metric: { kind: "building_count", building: "wall" },
  },
  {
    id: "q_tower",
    title: "Eyes on the Horizon",
    description: "Build a Watch Tower to guard your lands.",
    goal: 1,
    reward: { coins: 80, stone: 150 },
    metric: { kind: "building_count", building: "tower" },
  },
  {
    id: "q_raids_3",
    title: "Blooded",
    description: "Win 3 raids against rival empires.",
    goal: 3,
    reward: { coins: 150, gold: 300 },
    metric: { kind: "raids_won" },
  },
  {
    id: "q_raids_10",
    title: "Scourge of the Realm",
    description: "Win 10 raids.",
    goal: 10,
    reward: { coins: 400, gold: 700 },
    metric: { kind: "raids_won" },
  },
  {
    id: "q_army_25",
    title: "War Host",
    description: "Field an army of 25 units.",
    goal: 25,
    reward: { coins: 120, food: 300, gold: 200 },
    metric: { kind: "army_size" },
  },
  {
    id: "q_gold_3000",
    title: "War Chest",
    description: "Hold 3,000 gold at once.",
    goal: 3000,
    reward: { coins: 200, stone: 400 },
    metric: { kind: "resource_total", resource: "gold" },
  },
  {
    id: "q_stone_3000",
    title: "Quarryman's Pride",
    description: "Hold 3,000 stone at once.",
    goal: 3000,
    reward: { coins: 150, gold: 250 },
    metric: { kind: "resource_total", resource: "stone" },
  },
  {
    id: "q_stable",
    title: "Knights of the Realm",
    description: "Build a Stable to train heavy cavalry.",
    goal: 1,
    reward: { coins: 120, gold: 200 },
    metric: { kind: "building_count", building: "stable" },
  },
  {
    id: "q_houses_5",
    title: "Bustling Town",
    description: "Build 5 Houses to grow your population.",
    goal: 5,
    reward: { coins: 80, wood: 250 },
    metric: { kind: "building_count", building: "house" },
  },
  {
    id: "q_walls_8",
    title: "Iron Curtain",
    description: "Raise 8 Stone Walls to ring your territory.",
    goal: 8,
    reward: { coins: 120, stone: 400 },
    metric: { kind: "building_count", building: "wall" },
  },
  {
    id: "q_keep",
    title: "The Keep",
    description: "Build a Castle Keep — the heart of a fortress.",
    goal: 1,
    reward: { coins: 250, stone: 500 },
    metric: { kind: "building_count", building: "keep" },
  },
  {
    id: "q_temple",
    title: "Faith & Coin",
    description: "Build a Temple to draw pilgrims and gold.",
    goal: 1,
    reward: { coins: 200, gold: 400 },
    metric: { kind: "building_count", building: "temple" },
  },
  {
    id: "q_raids_20",
    title: "Warbringer",
    description: "Win 20 raids against your rivals.",
    goal: 20,
    reward: { coins: 700, gold: 1200 },
    metric: { kind: "raids_won" },
  },
  {
    id: "q_army_60",
    title: "Grand Host",
    description: "Field an army of 60 units.",
    goal: 60,
    reward: { coins: 300, food: 700, gold: 400 },
    metric: { kind: "army_size" },
  },
  {
    id: "q_wood_5000",
    title: "Endless Timber",
    description: "Hold 5,000 wood at once.",
    goal: 5000,
    reward: { coins: 150, stone: 500 },
    metric: { kind: "resource_total", resource: "wood" },
  },
  {
    id: "q_wonder",
    title: "Empire Eternal",
    description: "Raise a Wonder — a monument to your everlasting reign.",
    goal: 1,
    reward: { coins: 2000, gold: 3000, stone: 2000 },
    metric: { kind: "building_count", building: "wonder" },
  },
];

// ── Ranks ─────────────────────────────────────────────────────────────────
// A renown ladder driven by empire power. Higher ranks grant a harvest bonus,
// rewarding players who win, build and gather their way up.
export interface Rank {
  name: string;
  minPower: number;
  gatherMult: number;
}
export const RANKS: Rank[] = [
  { name: "Peasant", minPower: 0, gatherMult: 1.0 },
  { name: "Footman", minPower: 120, gatherMult: 1.1 },
  { name: "Squire", minPower: 300, gatherMult: 1.2 },
  { name: "Knight", minPower: 700, gatherMult: 1.35 },
  { name: "Baron", minPower: 1500, gatherMult: 1.5 },
  { name: "Warlord", minPower: 3000, gatherMult: 1.7 },
  { name: "Conqueror", minPower: 6000, gatherMult: 2.0 },
  { name: "Emperor", minPower: 12000, gatherMult: 2.5 },
];
export function rankForPower(power: number): Rank {
  let r = RANKS[0];
  for (const rank of RANKS) if (power >= rank.minPower) r = rank;
  return r;
}
export function nextRank(power: number): Rank | null {
  return RANKS.find((r) => r.minPower > power) ?? null;
}
export function rankIndex(power: number): number {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (power >= r.minPower) idx = i;
  });
  return idx;
}

// How many times your own power you can reach UP TO when choosing a raid target.
// It grows as you climb the ranks, so tougher empires unlock as your army & rank
// grow. (The lower bound is RAID_SHIELD_RATIO, which protects the weak.)
export function raidReach(power: number): number {
  return 1.75 + 0.35 * rankIndex(power); // Peasant ≈1.75× up to Emperor ≈4.2×
}

export type RaidBlock = "weak" | "locked" | null;
// Why an attacker can't raid a given target — or null if the raid is allowed.
// Bots are always raidable. A real player is protected when far weaker than the
// attacker ("weak" — the shield) and out of reach when far stronger ("locked" —
// unlocks as the attacker grows).
export function raidBlock(attackerPower: number, targetPower: number, targetIsBot: boolean): RaidBlock {
  if (targetIsBot) return null;
  if (targetPower < RAID_PROTECTION_POWER || targetPower < attackerPower * RAID_SHIELD_RATIO) return "weak";
  if (targetPower > attackerPower * raidReach(attackerPower)) return "locked";
  return null;
}

// ── Token-holder reward tiers ───────────────────────────────────────────────
// Holders of the game token are sorted into tiers by their share of circulating
// supply. The tier sets the multiplier applied on top of a holder's pro-rata
// slice of the daily SOL pool — the more you hold, the higher the tier, the
// bigger the multiplier. minShare is a fraction of supply (0.001 = 0.1%).
export interface RewardTier {
  name: string;
  minShare: number;
  multiplier: number;
  color: string;
  blurb: string;
}
export const REWARD_TIERS: RewardTier[] = [
  { name: "Bronze", minShare: 0, multiplier: 1.0, color: "#cd7f32", blurb: "Any holder. Full pro-rata share of the pool." },
  { name: "Silver", minShare: 0.001, multiplier: 1.25, color: "#c7ccd1", blurb: "≥ 0.1% of supply. +25% on your share." },
  { name: "Gold", minShare: 0.005, multiplier: 1.5, color: "#e8c75a", blurb: "≥ 0.5% of supply. +50% on your share." },
  { name: "Sapphire", minShare: 0.02, multiplier: 2.0, color: "#5a8fd8", blurb: "≥ 2% of supply. Double your share." },
  { name: "Diamond", minShare: 0.05, multiplier: 3.0, color: "#86e8e0", blurb: "≥ 5% of supply. Triple your share — the whales." },
];
export function rewardTier(share: number): RewardTier {
  let t = REWARD_TIERS[0];
  for (const tier of REWARD_TIERS) if (share >= tier.minShare) t = tier;
  return t;
}
export function nextRewardTier(share: number): RewardTier | null {
  return REWARD_TIERS.find((t) => t.minShare > share) ?? null;
}

// In-game perks granted by your holder tier — a real gameplay edge for holding,
// on top of the SOL reward multiplier. gatherPct boosts harvest yield; speedPct
// speeds up construction & training. Applied to the wallet's linked empire.
export interface HolderPerk {
  gatherPct: number;
  speedPct: number;
}
export const HOLDER_PERKS: Record<string, HolderPerk> = {
  Bronze: { gatherPct: 0.05, speedPct: 0.05 },
  Silver: { gatherPct: 0.1, speedPct: 0.1 },
  Gold: { gatherPct: 0.18, speedPct: 0.15 },
  Sapphire: { gatherPct: 0.25, speedPct: 0.22 },
  Diamond: { gatherPct: 0.35, speedPct: 0.3 },
};
export const EMPTY_HOLDER_PERK: HolderPerk = { gatherPct: 0, speedPct: 0 };
export function holderPerksForTier(tierName: string | undefined): HolderPerk {
  return (tierName && HOLDER_PERKS[tierName]) || EMPTY_HOLDER_PERK;
}

// Hard ceiling on an empire's population — caps army size no matter how many
// houses are built (units consume population, so this bounds the whole army).
export const MAX_POPULATION = 10_000;

// ── Armoury (army equipment) & Hero gear (bought with coins) ────────────────
export const MAX_GEAR = 8; // max weapon level per army unit type
// Armour goes higher than weapons so a defender who invests can out-armour an
// attacker's weapons — this is what keeps lower-level players from being farmed.
export const MAX_ARMOUR = 12; // max armour level per army unit type
export const MAX_HERO_GEAR = 8; // max hero helmet / armour level
export const GEAR_BONUS = 0.1; // +10% army attack (weapon) or defense (armour) per level

// Named armour tiers, indexed by level (0 = none). Shown in the Armoury so each
// upgrade reads as a distinct piece of kit, not just a number.
export const ARMOUR_TIERS = [
  "Unarmoured",
  "Padded",
  "Leather",
  "Boiled Leather",
  "Ringmail",
  "Chainmail",
  "Scale",
  "Brigandine",
  "Banded",
  "Plate",
  "Tempered Plate",
  "Knightly Plate",
  "Royal Plate",
] as const;
export const armourTier = (level: number): string =>
  ARMOUR_TIERS[Math.max(0, Math.min(level, ARMOUR_TIERS.length - 1))];
export const HELMET_HP = 10; // hero max HP per helmet level
export const HERO_ARMOUR_HP = 16; // hero max HP per armour level
export function gearCost(level: number): number {
  return Math.round(40 * Math.pow(1.7, level)); // army gear coins to reach level+1
}
export function heroGearCost(level: number): number {
  return Math.round(35 * Math.pow(1.65, level)); // hero gear coins to reach level+1
}

// ── Hero traits (perks) — some free to learn, some bought with coins ─────────
export interface Trait {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cost: number; // 0 = free to learn
  hp?: number; // flat max HP
  dmg?: number; // flat hero damage
  dmgPct?: number; // % hero damage
  gatherPct?: number; // % harvest yield
  speedPct?: number; // % move speed
  premium?: boolean; // token-shop only — hidden from the coin trait list
}
export const TRAITS: Trait[] = [
  // free starter perks
  { id: "hardy", name: "Hardy", desc: "+25 max HP", icon: "💪", cost: 0, hp: 25 },
  { id: "keen", name: "Keen Eye", desc: "+15% harvest yield", icon: "👁️", cost: 0, gatherPct: 0.15 },
  { id: "brawler", name: "Brawler", desc: "+3 hero damage", icon: "👊", cost: 0, dmg: 3 },
  // bought with coins
  { id: "ironhide", name: "Ironhide", desc: "+60 max HP", icon: "🪨", cost: 120, hp: 60 },
  { id: "swift", name: "Swift", desc: "+25% move speed", icon: "🏃", cost: 140, speedPct: 0.25 },
  { id: "gatherer", name: "Gatherer", desc: "+30% harvest yield", icon: "🌾", cost: 160, gatherPct: 0.3 },
  { id: "berserker", name: "Berserker", desc: "+25% hero damage", icon: "🪓", cost: 200, dmgPct: 0.25 },
  { id: "warlord", name: "Warlord", desc: "+40 HP & +15% damage", icon: "🎖️", cost: 320, hp: 40, dmgPct: 0.15 },
  { id: "juggernaut", name: "Juggernaut", desc: "+120 max HP", icon: "🗿", cost: 420, hp: 120 },
  { id: "duelist", name: "Duelist", desc: "+45% hero damage", icon: "⚔️", cost: 480, dmgPct: 0.45 },
  // premium — only purchasable in the token shop (see SHOP_ITEMS)
  { id: "conqueror", name: "Conqueror", desc: "+200 max HP & +30% hero damage", icon: "👑", cost: 0, premium: true, hp: 200, dmgPct: 0.3 },
  { id: "warmaster", name: "Warmaster", desc: "+50% harvest & +25% move speed", icon: "🏆", cost: 0, premium: true, gatherPct: 0.5, speedPct: 0.25 },
];
export interface TraitBonuses {
  hp: number;
  dmg: number;
  dmgPct: number;
  gatherPct: number;
  speedPct: number;
}
export function traitBonuses(owned: string[] | undefined): TraitBonuses {
  const out: TraitBonuses = { hp: 0, dmg: 0, dmgPct: 0, gatherPct: 0, speedPct: 0 };
  if (!owned) return out;
  for (const id of owned) {
    const t = TRAITS.find((x) => x.id === id);
    if (!t) continue;
    out.hp += t.hp ?? 0;
    out.dmg += t.dmg ?? 0;
    out.dmgPct += t.dmgPct ?? 0;
    out.gatherPct += t.gatherPct ?? 0;
    out.speedPct += t.speedPct ?? 0;
  }
  return out;
}

// ── Balance helpers ─────────────────────────────────────────────────────────

// Cost scaling: each level multiplies the base cost.
export function buildingCost(type: BuildingType, level: number): Partial<Resources> {
  const def = BUILDINGS[type];
  const mult = Math.pow(1.6, level); // level 0->1 uses mult^0... handled by caller
  const out: Partial<Resources> = {};
  for (const [k, v] of Object.entries(def.baseCost)) {
    out[k as keyof Resources] = Math.round((v as number) * mult);
  }
  return out;
}

// Cost to build the first instance / next level. `currentLevel` = 0 for new build.
export function nextLevelCost(type: BuildingType, currentLevel: number): Partial<Resources> {
  const def = BUILDINGS[type];
  const mult = Math.pow(1.55, currentLevel);
  const out: Partial<Resources> = {};
  for (const [k, v] of Object.entries(def.baseCost)) {
    out[k as keyof Resources] = Math.round((v as number) * mult);
  }
  return out;
}

export function buildSecondsFor(type: BuildingType, currentLevel: number): number {
  return Math.round(BUILDINGS[type].buildSeconds * Math.pow(1.35, currentLevel));
}

// Production per minute for a building at a given level (linear-ish scaling).
export function productionPerMinute(type: BuildingType, level: number): number {
  const def = BUILDINGS[type];
  if (!def.produces) return 0;
  return def.produces.perMinute * (1 + (level - 1) * 0.6);
}

export function populationProvided(type: BuildingType, level: number): number {
  const def = BUILDINGS[type];
  if (!def.populationProvided) return 0;
  return Math.round(def.populationProvided * (1 + (level - 1) * 0.5));
}

// Coins needed to instantly finish a job, based on remaining seconds.
export function rushCost(remainingSeconds: number): number {
  return Math.max(1, Math.ceil(remainingSeconds / 30));
}

export const COLORS_BANNER = [
  "#c0392b", "#2980b9", "#27ae60", "#8e44ad",
  "#d35400", "#16a085", "#2c3e50", "#c0a020",
];

// ── Achievements ─────────────────────────────────────────────────────────────
// Title-style milestones unlocked from your own empire's progress. The unlock
// check is shared so the client shows the same thing the server awards.
export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
}
export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_blood", name: "First Blood", desc: "Win your first raid", icon: "🩸" },
  { id: "raider", name: "Raider", desc: "Win 10 raids", icon: "🗡️" },
  { id: "warbringer", name: "Warbringer", desc: "Win 50 raids", icon: "⚔️" },
  { id: "builder", name: "Builder", desc: "Raise 6 buildings", icon: "🧱" },
  { id: "architect", name: "Architect", desc: "Raise 12 buildings", icon: "🏛️" },
  { id: "veteran", name: "Veteran", desc: "Reach 1,000 power", icon: "🛡️" },
  { id: "conqueror", name: "Conqueror", desc: "Reach 6,000 power", icon: "👑" },
  { id: "emperor", name: "Emperor", desc: "Reach 12,000 power", icon: "🏆" },
  { id: "boss_slayer", name: "Boss Slayer", desc: "Help slay a World Boss", icon: "👹" },
  { id: "boss_hunter", name: "Boss Hunter", desc: "Slay 5 World Bosses", icon: "🔥" },
  { id: "ally", name: "Sworn", desc: "Join or found an alliance", icon: "🤝" },
  { id: "imperial_age", name: "Golden Age", desc: "Reach the Imperial Age", icon: "🌟" },
];

// Inputs an achievement check needs from an empire (kept loose so both client &
// server can call it from a snapshot or live state).
export interface AchievementStats {
  raidsWon: number;
  power: number;
  age: AgeId;
  buildingsBuilt: number;
  bossKills: number;
  inAlliance: boolean;
}
export function achievementsUnlocked(s: AchievementStats): string[] {
  const out: string[] = [];
  if (s.raidsWon >= 1) out.push("first_blood");
  if (s.raidsWon >= 10) out.push("raider");
  if (s.raidsWon >= 50) out.push("warbringer");
  if (s.buildingsBuilt >= 6) out.push("builder");
  if (s.buildingsBuilt >= 12) out.push("architect");
  if (s.power >= 1000) out.push("veteran");
  if (s.power >= 6000) out.push("conqueror");
  if (s.power >= 12000) out.push("emperor");
  if (s.bossKills >= 1) out.push("boss_slayer");
  if (s.bossKills >= 5) out.push("boss_hunter");
  if (s.inAlliance) out.push("ally");
  if (s.age === "imperial") out.push("imperial_age");
  return out;
}

// ── Player Marketplace ───────────────────────────────────────────────────────
// Scarce, tradeable collectibles. Each type has a hard max supply, so the rare
// ones hold value. Bought & sold player-to-player in SOL or USDC (wallet-to-
// wallet, verified on-chain). A small fee goes to the treasury.
export type ItemRarity = "common" | "rare" | "epic" | "legendary";
export const RARITY_META: Record<ItemRarity, { label: string; color: string }> = {
  common: { label: "Common", color: "#9aa4ad" },
  rare: { label: "Rare", color: "#5a8fd8" },
  epic: { label: "Epic", color: "#9b59b6" },
  legendary: { label: "Legendary", color: "#e8c75a" },
};

// ── Character cNFTs ──────────────────────────────────────────────────────────
// Cosmetic characters you buy (coins or $RUMBLE), wear as your hub avatar, and
// own as a compressed NFT you can resell. BETA: icon+colour placeholders until
// the real character art is imported (then `art` points at the sprite/skin).
// `hat`/`cape`/`weapon` drive a distinct placeholder look via the game's own
// character renderer until real artwork is imported.
export type CharHat = "crown" | "helmet" | "hood" | "cap" | null;
export interface CharacterType {
  id: string;
  name: string;
  icon: string; // small glyph accent
  color: string; // tunic colour
  hat: CharHat;
  cape: boolean;
  rarity: ItemRarity;
  priceCoins: number; // buy with in-game coins
  priceRumble: number; // or buy with $RUMBLE (burned)
  maxSupply: number; // how many cNFTs of this character can ever mint
  image?: string; // optional PNG art (overrides the procedural avatar)
  desc: string;
}

export const CHARACTERS: CharacterType[] = [
  // featured / real-art characters — listed first
  { id: "bloodsworn", name: "Toly", icon: "🩸", color: "#7a1f1f", hat: "cap", cape: false, rarity: "legendary", priceCoins: 600000, priceRumble: 150000, maxSupply: 25, image: "/characters/lincoln/card.png", desc: "Marked by sorrow, cloaked in black — he weeps for the realm." },
  { id: "alon", name: "Alon", icon: "🧢", color: "#d4a017", hat: "cap", cape: false, rarity: "legendary", priceCoins: 600000, priceRumble: 150000, maxSupply: 25, image: "/characters/alon/card.png", desc: "Don't tread on him. Shades on, never off." },
  { id: "frank", name: "Frank De Gods", icon: "🎨", color: "#3b5b8c", hat: null, cape: false, rarity: "legendary", priceCoins: 600000, priceRumble: 150000, maxSupply: 25, image: "/characters/frank/card.png", desc: "Built different. Mints harder." },
  // ── community character cNFTs (hand-made art; varied rarity, price & supply) ──
  { id: "gake", name: "Gake", icon: "🟩", color: "#4caf50", hat: null, cape: false, rarity: "common", priceCoins: 15000, priceRumble: 4000, maxSupply: 300, image: "/characters/gake/card.png", desc: "A familiar face from the timeline." },
  { id: "pingu", name: "Pingu Charts", icon: "🐧", color: "#5dade2", hat: null, cape: false, rarity: "common", priceCoins: 20000, priceRumble: 5000, maxSupply: 250, image: "/characters/pingu/card.png", desc: "Charts up, vibes up." },
  { id: "sling", name: "Sling", icon: "🪢", color: "#e67e22", hat: null, cape: false, rarity: "common", priceCoins: 25000, priceRumble: 6000, maxSupply: 200, image: "/characters/sling/card.png", desc: "Quick hands, quicker exits." },
  { id: "fibonacki", name: "Fibonacki", icon: "🌀", color: "#9b59b6", hat: null, cape: false, rarity: "rare", priceCoins: 60000, priceRumble: 14000, maxSupply: 120, image: "/characters/fibonacki/card.png", desc: "Everything retraces to him." },
  { id: "json1444", name: "json1444", icon: "🧩", color: "#34495e", hat: null, cape: false, rarity: "rare", priceCoins: 70000, priceRumble: 16000, maxSupply: 100, image: "/characters/json1444/card.png", desc: "Reads the chain like an open book." },
  { id: "remus", name: "Remus", icon: "🐺", color: "#7f8c8d", hat: null, cape: false, rarity: "rare", priceCoins: 85000, priceRumble: 19000, maxSupply: 80, image: "/characters/remus/card.png", desc: "Runs with the pack, leads it too." },
  { id: "mert", name: "Mert", icon: "⚡", color: "#f39c12", hat: null, cape: false, rarity: "epic", priceCoins: 180000, priceRumble: 40000, maxSupply: 40, image: "/characters/mert/card.png", desc: "Wired into the network." },
  { id: "rains", name: "Rains Revenge", icon: "🌧️", color: "#2c3e50", hat: null, cape: false, rarity: "epic", priceCoins: 220000, priceRumble: 50000, maxSupply: 30, image: "/characters/rains/card.png", desc: "When it pours, he collects." },
  { id: "ansem", name: "Ansem", icon: "☀️", color: "#f1c40f", hat: null, cape: false, rarity: "legendary", priceCoins: 750000, priceRumble: 170000, maxSupply: 15, image: "/characters/ansem/card.png", desc: "All smiles, all signal." },
  { id: "cobie", name: "Cobie", icon: "🎙️", color: "#c0392b", hat: null, cape: false, rarity: "legendary", priceCoins: 900000, priceRumble: 190000, maxSupply: 10, image: "/characters/cobie/card.png", desc: "Says little, moves markets." },
];

export const characterType = (id: string): CharacterType | undefined => CHARACTERS.find((c) => c.id === id);

// ── Daily Quests (beta) ──────────────────────────────────────────────────────
// Daily-resetting objectives tracked as a delta off cumulative counters. Rewards
// are RESOURCES (never coins — peg-safe). Progress resets each UTC day.
export interface DailyQuestDef {
  id: string;
  label: string;
  icon: string;
  metric: "raids" | "duels" | "xp";
  target: number;
  rewardText: string;
  resources?: { wood?: number; food?: number; gold?: number; stone?: number };
}
export const DAILY_QUESTS: DailyQuestDef[] = [
  { id: "dq_raids", label: "Win 2 raids", icon: "🗡️", metric: "raids", target: 2, rewardText: "8,000 Gold", resources: { gold: 8000 } },
  { id: "dq_duels", label: "Win an Arena duel", icon: "🏟️", metric: "duels", target: 1, rewardText: "6,000 Gold", resources: { gold: 6000 } },
  { id: "dq_xp", label: "Earn 800 XP", icon: "⭐", metric: "xp", target: 800, rewardText: "6,000 Wood + 6,000 Food", resources: { wood: 6000, food: 6000 } },
];

// ── Spinner Wheel ────────────────────────────────────────────────────────────
// A free spin every 12h. Rewards are MODEST RESOURCES only — kept small so it's
// a daily top-up, not a farm (a whole day's spins ≈ a few building levels, well
// below what one quest/raid pays). Never coins (would break the coin↔$RUMBLE
// price) and never relics (would flood the marketplace + hand out free permanent
// bonuses). Bigger prizes are reserved for future paid spins that burn $RUMBLE.
export const SPIN_COOLDOWN_MS = 12 * 60 * 60 * 1000;
export interface SpinSegment {
  id: string;
  label: string;
  icon: string;
  color: string;
  weight: number;
  resources?: { wood?: number; food?: number; gold?: number; stone?: number };
  relic?: boolean;
}
export const SPIN_SEGMENTS: SpinSegment[] = [
  { id: "wood", label: "600 Wood", icon: "🪵", color: "#6e5a30", weight: 20, resources: { wood: 600 } },
  { id: "food", label: "600 Food", icon: "🍖", color: "#9c5a3c", weight: 20, resources: { food: 600 } },
  { id: "stone", label: "500 Stone", icon: "🪨", color: "#7c766b", weight: 16, resources: { stone: 500 } },
  { id: "gold", label: "500 Gold", icon: "🟡", color: "#c0a020", weight: 16, resources: { gold: 500 } },
  { id: "haul", label: "Lucky Crate", icon: "🎁", color: "#2980b9", weight: 7, resources: { wood: 800, food: 800, gold: 800, stone: 800 } },
  { id: "bigGold", label: "1,200 Gold", icon: "💰", color: "#d4af37", weight: 10, resources: { gold: 1200 } },
  { id: "scraps", label: "250 Wood", icon: "🌿", color: "#27ae60", weight: 11, resources: { wood: 250 } },
];

// ── Mounts & Pets (beta) ─────────────────────────────────────────────────────
// Rare drops earned by winning raids — cNFT-style collectibles you own, equip
// beside your hero, and (later) resell. No supply cap; rarity sets drop odds.
// A pet/mount's equipped bonus — its "use". gather → +resource gathering,
// speed → −build/training time, sol → +share of the daily SOL pool.
export type MountTrait = { kind: "gather" | "speed" | "sol"; value: number; label: string };
export interface MountType {
  id: string;
  name: string;
  icon: string;
  rarity: ItemRarity;
  dropWeight: number; // relative odds within a drop
  priceUsd: number; // marketplace price in USD (settled in $RUMBLE, like relics)
  maxSupply: number; // total mintable across all players (scarcity)
  trait: MountTrait; // the equipped bonus — the reason to own it
  desc: string;
}
export const MOUNTS: MountType[] = [
  { id: "war_pony", name: "War Pony", icon: "🐴", rarity: "common", dropWeight: 100, priceUsd: 5, maxSupply: 1000, trait: { kind: "speed", value: 0.05, label: "−5% build & training time" }, desc: "A sturdy, dependable steed." },
  { id: "dire_wolf", name: "Dire Wolf", icon: "🐺", rarity: "rare", dropWeight: 42, priceUsd: 14, maxSupply: 250, trait: { kind: "speed", value: 0.12, label: "−12% build & training time" }, desc: "A fanged companion of the wild." },
  { id: "war_boar", name: "War Boar", icon: "🐗", rarity: "rare", dropWeight: 36, priceUsd: 12, maxSupply: 250, trait: { kind: "gather", value: 0.12, label: "+12% resource gathering" }, desc: "Tusked, armoured and tireless." },
  { id: "royal_stag", name: "Royal Stag", icon: "🦌", rarity: "epic", dropWeight: 14, priceUsd: 45, maxSupply: 50, trait: { kind: "gather", value: 0.22, label: "+22% resource gathering" }, desc: "A noble mount of the high court." },
  { id: "phoenix", name: "Phoenix", icon: "🦅", rarity: "legendary", dropWeight: 4, priceUsd: 180, maxSupply: 15, trait: { kind: "sol", value: 0.12, label: "+12% daily SOL reward share" }, desc: "Reborn from its own ashes." },
  { id: "dragonling", name: "Dragonling", icon: "🐉", rarity: "legendary", dropWeight: 1, priceUsd: 350, maxSupply: 8, trait: { kind: "sol", value: 0.2, label: "+20% daily SOL reward share" }, desc: "The rarest beast in the realm." },
];
export const mountType = (id: string): MountType | undefined => MOUNTS.find((m) => m.id === id);
export const MOUNT_DROP_CHANCE = 0.06; // chance to drop a mount on a raid win
export interface MarketItemType {
  id: string;
  name: string;
  icon: string;
  rarity: ItemRarity;
  maxSupply: number;
  banner: string; // cosmetic banner colour granted when equipped
  desc: string;
  // passive effects while equipped (stack across your equipped relics)
  powerBonus?: number; // flat power (→ higher rank → bigger SOL share)
  gatherPct?: number; // bonus harvest yield
  speedPct?: number; // faster build & train
  solPct?: number; // boosts your SOL accrual rate (token holders only)
}
export const EQUIP_SLOTS = 3; // how many relics you can equip at once
export const RELIC_CAP = 15; // max relics an empire can HOLD (forces choices / selling)
// Minimum renown-rank index needed to EQUIP a relic of each rarity — you unlock
// the power as you climb (you can own/trade them any time). Rank indices come
// from RANKS (Peasant 0 … Emperor 7).
export const EQUIP_MIN_RANK: Record<string, number> = { common: 0, rare: 1, epic: 3, legendary: 5 };
export function minRankNameForRarity(rarity: string): string {
  return RANKS[EQUIP_MIN_RANK[rarity] ?? 0]?.name ?? "Peasant";
}

export const MARKET_ITEMS: MarketItemType[] = [
  // legendary — 10 each, biggest boosts (incl. the rare SOL-yield relics)
  { id: "eternal_crown", name: "Eternal Crown", icon: "👑", rarity: "legendary", maxSupply: 10, banner: "#e8c75a", desc: "The crown of the first emperor. Ten will ever exist.", powerBonus: 1000, gatherPct: 0.15, solPct: 0.2 },
  { id: "dragon_sigil", name: "Dragon Sigil", icon: "🐉", rarity: "legendary", maxSupply: 10, banner: "#c0392b", desc: "Mark of the dragon lords.", powerBonus: 1200, solPct: 0.25 },
  { id: "titan_heart", name: "Titan Heart", icon: "💗", rarity: "legendary", maxSupply: 10, banner: "#8e44ad", desc: "Still beating after a thousand years.", powerBonus: 700, speedPct: 0.3, solPct: 0.15 },
  // epic — 50 each
  { id: "obsidian_blade", name: "Obsidian Blade", icon: "🗡️", rarity: "epic", maxSupply: 50, banner: "#2c3e50", desc: "Forged in a dead volcano.", powerBonus: 450, solPct: 0.1 },
  { id: "phoenix_banner", name: "Phoenix Banner", icon: "🔥", rarity: "epic", maxSupply: 50, banner: "#d35400", desc: "Rises again from every defeat.", gatherPct: 0.3, solPct: 0.1 },
  { id: "storm_crown", name: "Storm Crown", icon: "⚡", rarity: "epic", maxSupply: 50, banner: "#2980b9", desc: "Hums with caged lightning.", powerBonus: 200, speedPct: 0.22, solPct: 0.08 },
  { id: "frost_aegis", name: "Frost Aegis", icon: "🛡️", rarity: "epic", maxSupply: 50, banner: "#5a8fd8", desc: "Never thaws, never breaks.", powerBonus: 380, gatherPct: 0.08, solPct: 0.08 },
  // rare — 250 each
  { id: "wolf_totem", name: "Wolf Totem", icon: "🐺", rarity: "rare", maxSupply: 250, banner: "#7f8c8d", desc: "Token of the pack-bound clans.", gatherPct: 0.16, solPct: 0.03 },
  { id: "ivory_horn", name: "Ivory Horn", icon: "📯", rarity: "rare", maxSupply: 250, banner: "#ecf0f1", desc: "Its call rallies a thousand spears.", powerBonus: 160, solPct: 0.03 },
  { id: "silver_fang", name: "Silver Fang", icon: "🦷", rarity: "rare", maxSupply: 250, banner: "#bdc3c7", desc: "A relic blade that never dulls.", powerBonus: 110, gatherPct: 0.06 },
  { id: "emerald_idol", name: "Emerald Idol", icon: "🟢", rarity: "rare", maxSupply: 250, banner: "#27ae60", desc: "The harvest god, palm-sized.", gatherPct: 0.2 },
  { id: "runic_anvil", name: "Runic Anvil", icon: "⚒️", rarity: "rare", maxSupply: 250, banner: "#34495e", desc: "Builds itself while you sleep.", speedPct: 0.18 },
  // common — 1000 each
  { id: "iron_chalice", name: "Iron Chalice", icon: "🏆", rarity: "common", maxSupply: 1000, banner: "#16a085", desc: "A victor's cup, passed hand to hand.", gatherPct: 0.06 },
  { id: "bronze_medallion", name: "Bronze Medallion", icon: "🥉", rarity: "common", maxSupply: 1000, banner: "#cd7f32", desc: "Awarded for valour, traded for coin.", powerBonus: 50 },
  { id: "oak_charm", name: "Oak Charm", icon: "🌰", rarity: "common", maxSupply: 1000, banner: "#6b4f2a", desc: "A woodland blessing for the busy.", speedPct: 0.08 },
  { id: "lucky_coin", name: "Lucky Coin", icon: "🪙", rarity: "common", maxSupply: 1000, banner: "#c0a020", desc: "Heads you win, tails you win.", gatherPct: 0.04, powerBonus: 20 },
  { id: "swift_boots", name: "Swift Boots", icon: "🥾", rarity: "common", maxSupply: 1000, banner: "#7d5a3c", desc: "Worn smooth by a hundred marches.", speedPct: 0.1 },
  // more rare — variety of effect archetypes
  { id: "merchants_seal", name: "Merchant's Seal", icon: "📜", rarity: "rare", maxSupply: 250, banner: "#b8860b", desc: "Opens every gate in the bazaar.", gatherPct: 0.1, speedPct: 0.08 },
  { id: "blood_ruby", name: "Blood Ruby", icon: "🔴", rarity: "rare", maxSupply: 250, banner: "#a01818", desc: "Glows brighter the more you conquer.", powerBonus: 140, solPct: 0.04 },
  { id: "ancient_tome", name: "Ancient Tome", icon: "📖", rarity: "rare", maxSupply: 250, banner: "#3b2f6b", desc: "Forgotten knowledge, freely given.", gatherPct: 0.1, speedPct: 0.1 },
  // more epic
  { id: "warlords_pennant", name: "Warlord's Pennant", icon: "🚩", rarity: "epic", maxSupply: 50, banner: "#7b241c", desc: "Flown over a hundred sacked cities.", powerBonus: 420, solPct: 0.06 },
  { id: "harvest_crown", name: "Harvest Crown", icon: "🌾", rarity: "epic", maxSupply: 50, banner: "#b7950b", desc: "Crowned by the gods of plenty.", gatherPct: 0.35, speedPct: 0.1 },
  // more legendary
  { id: "kings_ransom", name: "King's Ransom", icon: "💰", rarity: "legendary", maxSupply: 10, banner: "#d4af37", desc: "Wealth enough to buy an empire.", powerBonus: 600, gatherPct: 0.2, speedPct: 0.15, solPct: 0.18 },
];
export const marketItem = (id: string): MarketItemType | undefined => MARKET_ITEMS.find((m) => m.id === id);

// Rarity ladder (for the Forge: fuse 3 of a rarity → 1 of the next up).
export const RARITY_ORDER: ItemRarity[] = ["common", "rare", "epic", "legendary"];
export function nextRarity(r: ItemRarity): ItemRarity | null {
  const i = RARITY_ORDER.indexOf(r);
  return i >= 0 && i < RARITY_ORDER.length - 1 ? RARITY_ORDER[i + 1] : null;
}
// Forge economy (a deflationary sink — fusing burns relics, crafting burns resources).
export const FUSE_COUNT = 3; // relics consumed per fuse
export const FUSE_COINS: Record<string, number> = { common: 5000, rare: 25000, epic: 100000 };
export const CRAFT_COST: { wood: number; food: number; gold: number; stone: number; coins: number } = {
  wood: 25000,
  food: 25000,
  gold: 25000,
  stone: 25000,
  coins: 8000,
};
// Human summary of an item's equipped effects (for tooltips / inventory).
export function itemEffectSummary(m: MarketItemType): string {
  const parts: string[] = [];
  if (m.powerBonus) parts.push(`+${m.powerBonus} power`);
  if (m.gatherPct) parts.push(`+${Math.round(m.gatherPct * 100)}% gather`);
  if (m.speedPct) parts.push(`+${Math.round(m.speedPct * 100)}% speed`);
  if (m.solPct) parts.push(`+${Math.round(m.solPct * 100)}% SOL`);
  return parts.join(" · ") || "Collectible";
}
export const MARKET_FEE = 0.025; // 2.5% of the sale, to the treasury
// USDC mint on Solana mainnet.
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// ── Wagered Arena (PvP coin duels) ───────────────────────────────────────────
export const ARENA_MIN_STAKE = 100; // minimum coins per side
export const ARENA_RAKE = 0.05; // 5% of the pot is burned (coin sink)
export const ARENA_WINNER_LOSS = 0.15; // winner loses 15% of committed army
export const ARENA_LOSER_LOSS = 0.55; // loser loses 55% of committed army
export const ARENA_DAILY_BONUS = 2000; // coins for your first arena win each day
// Tombstone duels (beta): the loser's stake drops into a recoverable tombstone.
export const TOMBSTONE_RECOVER_PCT = 0.6; // loser recovers this much if they reach it in time
export const TOMBSTONE_WINDOW_MS = 5 * 60 * 1000; // window to recover before the victor loots it
export const TOURNEY_ENTRY_FEE = 1000; // coins to enter the rolling tournament
export const TOURNEY_SIZE = 8; // entrants before it auto-runs

// ── World Boss ───────────────────────────────────────────────────────────────
// A server-wide PvE event. Everyone sends armies to damage a shared boss; when
// it dies, IN-GAME spoils (coins + resources) are split by damage dealt. No SOL
// is ever paid here — the token reward pool is untouched.
export const BOSS_BASE_HP = 150_000; // tier 1 boss hp
export const BOSS_HP_GROWTH = 1.3; // each successive boss is tougher
export const BOSS_RESPAWN_MS = 10 * 60 * 1000; // 10 min after a kill
export const BOSS_HIT_COOLDOWN_MS = 60 * 1000; // per-empire delay between strikes
export const BOSS_CASUALTY_RATE = 0.18; // fraction of committed army lost per strike
export const BOSS_COIN_POOL = 60_000; // coins split by damage share on a kill
export const BOSS_RESOURCE_POOL = 120_000; // each resource split by damage share
export const BOSS_POOL_GROWTH = 1.25; // spoils grow with boss tier
export const BOSS_TOP_BONUS = 1.5; // top damage dealer's share multiplier
export const BOSS_NAMES = [
  "The Dread Titan",
  "Gorehowl the Ravager",
  "Mortis, Bane of Realms",
  "The Obsidian Behemoth",
  "Varog the World-Eater",
  "Skarn the Unbroken",
];

// ── Alliances ────────────────────────────────────────────────────────────────
export const ALLIANCE_MAX_MEMBERS = 12;
export const ALLIANCE_CREATE_COST = 2000; // coins to found an alliance
export const ALLIANCE_NAME_MAX = 24;
export const ALLIANCE_TAG_MAX = 5;
export const ALLIANCE_CHAT_KEEP = 50; // recent messages retained per alliance
export const ALLIANCE_MSG_MAX = 240;

// ── Token shop ───────────────────────────────────────────────────────────────
// Items players buy with the project's SPL token. Payment is a real on-chain
// transfer of `price` whole tokens to the treasury (verified server-side before
// the effect is granted). Prices are in WHOLE tokens (converted to raw using the
// mint's decimals at purchase time).
export type ShopCategory = "pack" | "boost" | "army" | "trait" | "cosmetic";

export type ShopEffect =
  | { kind: "resources"; coins?: number; resources?: Partial<Resources> }
  | { kind: "finishAll" } // instantly complete builds, training & age research
  | { kind: "gatherBuff"; mult: number; hours: number } // temporary harvest multiplier
  | { kind: "army"; units: Partial<Record<UnitType, number>> }
  | { kind: "trait"; traitId: string }
  | { kind: "banner"; color: string };

export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  icon: string;
  category: ShopCategory;
  price: number; // whole tokens
  effect: ShopEffect;
}

export const SHOP_ITEMS: ShopItem[] = [
  // resource & coin packs
  { id: "pack_supplies", name: "Supply Crate", icon: "📦", category: "pack", price: 1000,
    desc: "+20,000 of every resource (wood, food, gold, stone).",
    effect: { kind: "resources", resources: { wood: 20000, food: 20000, gold: 20000, stone: 20000 } } },
  { id: "pack_war", name: "War Chest", icon: "🎁", category: "pack", price: 5000,
    desc: "+50,000 of every resource (wood, food, gold, stone).",
    effect: { kind: "resources", resources: { wood: 50000, food: 50000, gold: 50000, stone: 50000 } } },
  // boosts
  { id: "boost_finish", name: "Master Builder", icon: "⚡", category: "boost", price: 2500,
    desc: "Instantly finish all builds, training and age research in progress.",
    effect: { kind: "finishAll" } },
  { id: "boost_gather", name: "Harvest Surge", icon: "🌾", category: "boost", price: 2000,
    desc: "Double your harvest yield for the next 2 hours.",
    effect: { kind: "gatherBuff", mult: 2, hours: 2 } },
  // army
  { id: "army_warband", name: "Elite Warband", icon: "🛡️", category: "army", price: 4000,
    desc: "Instantly muster 25 knights, 25 archers and 25 spearmen.",
    effect: { kind: "army", units: { knight: 25, archer: 25, spearman: 25 } } },
  { id: "army_legion", name: "Royal Legion", icon: "⚔️", category: "army", price: 12000,
    desc: "Instantly muster 100 knights — a devastating standing force.",
    effect: { kind: "army", units: { knight: 100 } } },
  // exclusive traits (token-only)
  { id: "trait_conqueror", name: "Conqueror", icon: "👑", category: "trait", price: 6000,
    desc: "Permanent hero trait: +200 max HP & +30% hero damage.",
    effect: { kind: "trait", traitId: "conqueror" } },
  { id: "trait_warmaster", name: "Warmaster", icon: "🏆", category: "trait", price: 6000,
    desc: "Permanent hero trait: +50% harvest & +25% move speed.",
    effect: { kind: "trait", traitId: "warmaster" } },
  // cosmetic crests (banner heraldry)
  { id: "crest_gold", name: "Gilded Banner", icon: "🟡", category: "cosmetic", price: 1500,
    desc: "A gleaming gold banner for your empire's heraldry.",
    effect: { kind: "banner", color: "#e8c75a" } },
  { id: "crest_crimson", name: "Crimson Royal", icon: "🔴", category: "cosmetic", price: 1500,
    desc: "A deep crimson royal banner.",
    effect: { kind: "banner", color: "#9b1b1b" } },
  { id: "crest_amethyst", name: "Amethyst Crown", icon: "🟣", category: "cosmetic", price: 1500,
    desc: "A regal amethyst-purple banner.",
    effect: { kind: "banner", color: "#7d3cc0" } },
];

export const shopItem = (id: string): ShopItem | undefined => SHOP_ITEMS.find((i) => i.id === id);
