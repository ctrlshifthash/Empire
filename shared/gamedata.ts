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
    description: "Fortifications that grant your defenders a powerful edge.",
    icon: "🧱",
    baseCost: { stone: 120 },
    buildSeconds: 30,
    requiresAge: "feudal",
    maxLevel: 8,
    defenseBonus: 0.12, // +12% defense per level
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
];

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
