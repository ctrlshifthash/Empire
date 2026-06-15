// ─────────────────────────────────────────────────────────────────────────────
// Empires Eternal — Static game definitions & balance (shared client + server)
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
export const RAID_PROTECTION_POWER = 200;

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

// ── Armoury (army equipment) & Hero gear (bought with coins) ────────────────
export const MAX_GEAR = 8; // max weapon / armour level per army unit type
export const MAX_HERO_GEAR = 8; // max hero helmet / armour level
export const GEAR_BONUS = 0.1; // +10% army attack (weapon) or defense (armour) per level
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
