// ─────────────────────────────────────────────────────────────────────────────
// Hero progression — skills, tools, XP curve and the formulas that turn levels
// and tool tiers into gather yield, combat power and upgrade costs. Shared so
// the server (authoritative) and client (preview/display) agree exactly.
// ─────────────────────────────────────────────────────────────────────────────
import type { HeroState, Resources, ResourceKind, SkillId, ToolId } from "./types";
export type { HeroState, SkillId, ToolId } from "./types";

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  blurb: string;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  combat: { id: "combat", name: "Combat", icon: "⚔️", blurb: "Damage & health. Trained by slaying foes and beating empires." },
  woodcutting: { id: "woodcutting", name: "Woodcutting", icon: "🪓", blurb: "Chop trees faster and for more wood." },
  mining: { id: "mining", name: "Mining", icon: "⛏️", blurb: "Mine stone and gold faster and for more." },
  foraging: { id: "foraging", name: "Foraging", icon: "🌿", blurb: "Gather more food from bushes and fields." },
  construction: { id: "construction", name: "Construction", icon: "🔨", blurb: "Trained by raising buildings in your empire." },
};

export const SKILL_ORDER: SkillId[] = ["combat", "woodcutting", "mining", "foraging", "construction"];

export interface ToolDef {
  id: ToolId;
  name: string;
  icon: string;
  skill: SkillId;
}

export const TOOLS: Record<ToolId, ToolDef> = {
  sword: { id: "sword", name: "Sword", icon: "🗡️", skill: "combat" },
  axe: { id: "axe", name: "Axe", icon: "🪓", skill: "woodcutting" },
  pickaxe: { id: "pickaxe", name: "Pickaxe", icon: "⛏️", skill: "mining" },
  sickle: { id: "sickle", name: "Sickle", icon: "🌾", skill: "foraging" },
};

export const TOOL_ORDER: ToolId[] = ["sword", "axe", "pickaxe", "sickle"];

export const MAX_TIER = 5;
export const TIER_NAMES = ["", "Crude", "Bronze", "Iron", "Steel", "Mythril"];
export const MAX_LEVEL = 50;

// which tool / skill a harvested resource uses
export function resourceSkill(r: ResourceKind): SkillId {
  if (r === "wood") return "woodcutting";
  if (r === "food") return "foraging";
  return "mining"; // stone, gold
}
export function resourceTool(r: ResourceKind): ToolId {
  if (r === "wood") return "axe";
  if (r === "food") return "sickle";
  return "pickaxe";
}

// ── XP curve ────────────────────────────────────────────────────────────────

export function xpToReach(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(80 * Math.pow(level - 1, 1.9));
}

export function levelForXp(xp: number): number {
  let lvl = 1;
  while (lvl < MAX_LEVEL && xpToReach(lvl + 1) <= xp) lvl++;
  return lvl;
}

// progress (0..1) toward the next level
export function levelProgress(xp: number): { level: number; into: number; need: number; frac: number } {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, need: 0, frac: 1 };
  const base = xpToReach(level);
  const next = xpToReach(level + 1);
  const into = xp - base;
  const need = next - base;
  return { level, into, need, frac: need > 0 ? into / need : 1 };
}

// ── gameplay formulas ───────────────────────────────────────────────────────

// resources gained per harvest "chop"
export function gatherYield(skillLevel: number, toolTier: number): number {
  const base = 4;
  const y = base * (1 + (skillLevel - 1) * 0.05) * (1 + (toolTier - 1) * 0.3);
  return Math.max(1, Math.min(60, Math.round(y)));
}

// xp gained per harvest
export function gatherXp(resource: ResourceKind, toolTier: number): number {
  const base: Record<ResourceKind, number> = { wood: 8, food: 7, stone: 9, gold: 14 };
  return Math.round(base[resource] * (1 + (toolTier - 1) * 0.15));
}

// hero melee damage in the live world
export function heroDamage(combatLevel: number, swordTier: number): number {
  return Math.round(12 * (1 + (combatLevel - 1) * 0.06) * (1 + (swordTier - 1) * 0.3));
}

export function heroMaxHp(combatLevel: number): number {
  return 100 + (combatLevel - 1) * 12;
}

// construction xp for raising a building (scaled by its total resource cost)
export function constructionXp(cost: Partial<Resources>): number {
  let total = 0;
  for (const v of Object.values(cost)) total += v ?? 0;
  return Math.max(8, Math.round(total / 8));
}

// combat xp from a raid on a rival empire
export function raidXp(defendPower: number, won: boolean): number {
  const base = 15 + defendPower * 0.35;
  return Math.round(won ? base : base * 0.25);
}

// combat xp for slaying a world enemy
export function slayXp(kind: string): number {
  if (kind === "wolf") return 9;
  if (kind === "brigand") return 35;
  return 18; // bandit
}

// cost to upgrade a tool from currentTier -> currentTier+1
export function toolUpgradeCost(currentTier: number): { coins: number } & Partial<Resources> {
  const t = currentTier;
  return {
    wood: Math.round(120 * Math.pow(1.9, t - 1)),
    stone: Math.round(60 * Math.pow(1.9, t - 1)),
    gold: Math.round(80 * Math.pow(2.0, t - 1)),
    coins: Math.round(10 * Math.pow(1.8, t - 1)),
  };
}

export function newHeroState(): HeroState {
  return {
    skills: { combat: 0, woodcutting: 0, mining: 0, foraging: 0, construction: 0 },
    tools: { sword: 1, axe: 1, pickaxe: 1, sickle: 1 },
  };
}

// total hero level = sum of skill levels (used for display / a single number)
export function heroLevel(hero: HeroState): number {
  let sum = 0;
  for (const s of SKILL_ORDER) sum += levelForXp(hero.skills[s] ?? 0);
  return sum;
}
