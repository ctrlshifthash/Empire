// ─────────────────────────────────────────────────────────────────────────────
// Realm Rumble — Bot AI. Bots grow their economy, advance ages, raise armies
// and occasionally raid rivals so the persistent world always feels alive.
// ─────────────────────────────────────────────────────────────────────────────
import { BUILDINGS, RAID_PROTECTION_POWER, ageAtLeast, botTier } from "../../shared/gamedata.ts";
import { armySize, type Army } from "../../shared/combat.ts";
import type { BuildingType, Empire, UnitType } from "../../shared/types.ts";
import { state } from "./store.ts";
import {
  actAdvanceAge,
  actAttack,
  actBuild,
  actTrain,
  actUpgrade,
  populationCap,
  recomputePower,
  refreshEmpire,
  usedPopulation,
} from "./engine.ts";
import { distance } from "./world.ts";
import { now } from "./util.ts";

function activeCount(e: Empire, type: BuildingType): number {
  return e.buildings.filter((b) => b.type === type).length;
}

// Returns the highest-priority building this bot still wants and can build.
function chooseBuild(e: Empire): BuildingType | null {
  const feudal = ageAtLeast(e.age, "feudal");
  const castle = ageAtLeast(e.age, "castle");

  const want: Array<{ type: BuildingType; min: number; when: boolean }> = [
    { type: "lumber_camp", min: 2, when: true },
    { type: "farm", min: 2, when: true },
    { type: "house", min: 2, when: true },
    { type: "barracks", min: 1, when: true },
    { type: "gold_mine", min: 1, when: feudal },
    { type: "quarry", min: 1, when: feudal },
    { type: "market", min: 1, when: feudal },
    { type: "archery_range", min: 1, when: feudal },
    { type: "lumber_camp", min: 4, when: feudal },
    { type: "farm", min: 4, when: feudal },
    { type: "wall", min: 2, when: feudal },
    { type: "stable", min: 1, when: castle },
    { type: "house", min: 5, when: castle },
    { type: "gold_mine", min: 3, when: castle },
  ];

  // population pressure: prioritise a house if nearly capped
  if (populationCap(e) - usedPopulation(e) <= 2) {
    return "house";
  }

  for (const w of want) {
    if (!w.when) continue;
    if (activeCount(e, w.type) < w.min) return w.type;
  }
  return null;
}

function chooseTrain(e: Empire): { building: BuildingType; unit: UnitType } | null {
  const options: Array<{ building: BuildingType; unit: UnitType }> = [];
  if (activeBuilt(e, "stable") && ageAtLeast(e.age, "castle"))
    options.push({ building: "stable", unit: "knight" });
  if (activeBuilt(e, "archery_range") && ageAtLeast(e.age, "feudal"))
    options.push({ building: "archery_range", unit: "archer" });
  if (activeBuilt(e, "barracks")) options.push({ building: "barracks", unit: "spearman" });
  if (options.length === 0) return null;
  // prefer stronger units when available
  return options[0];
}

function activeBuilt(e: Empire, type: BuildingType): boolean {
  return e.buildings.some((b) => b.type === type && b.completesAt == null && b.level >= 1);
}

function maybeAttack(bot: Empire): void {
  const myArmy = armySize(bot.army);
  // need a real army and some aggression
  if (myArmy < 6) return;
  if (Math.random() > 0.25) return; // ~25% chance per AI step when eligible

  // candidates: any empire within range and not vastly stronger
  const candidates = Object.values(state.empires).filter((t) => {
    if (t.id === bot.id) return false;
    if (!t.isBot && t.power < RAID_PROTECTION_POWER) return false; // protect new human rulers
    const d = distance(bot.tileX, bot.tileY, t.tileX, t.tileY);
    if (d > 18) return false;
    return t.power <= bot.power * 1.1;
  });
  if (candidates.length === 0) return;

  // prefer the weakest nearby target
  candidates.sort((a, b) => a.power - b.power);
  const target = candidates[0];

  // commit ~60% of the army, never villagers
  const units: Army = {};
  for (const u of ["knight", "archer", "spearman"] as UnitType[]) {
    const send = Math.floor((bot.army[u] ?? 0) * 0.6);
    if (send > 0) units[u] = send;
  }
  if (armySize(units) <= 0) return;
  actAttack(bot, target.id, units);
}

export function stepBot(bot: Empire): void {
  refreshEmpire(bot, now());
  recomputePower(bot); // keep power current so the tier cap is enforced accurately

  // a bot that's reached its difficulty tier's power cap stops growing, so it
  // stays a farmable target in its band instead of snowballing forever
  const capped = bot.tier != null && bot.power >= botTier(bot.tier).powerCap;

  if (!capped) {
    // 1) advance age opportunistically
    if (bot.ageUpCompletesAt == null && Math.random() < 0.5) {
      actAdvanceAge(bot); // silently fails if unaffordable
    }

    // 2) construct the next wanted building
    const toBuild = chooseBuild(bot);
    if (toBuild) actBuild(bot, toBuild);

    // 3) occasionally upgrade a producer or the town center
    if (Math.random() < 0.3) {
      const upgradable = bot.buildings.filter(
        (b) =>
          b.completesAt == null &&
          b.level >= 1 &&
          b.level < BUILDINGS[b.type].maxLevel &&
          (BUILDINGS[b.type].produces || b.type === "town_center"),
      );
      if (upgradable.length) {
        const pick = upgradable[Math.floor(Math.random() * upgradable.length)];
        actUpgrade(bot, pick.id);
      }
    }

    // 4) train troops if there's population headroom
    if (populationCap(bot) - usedPopulation(bot) >= 2) {
      const t = chooseTrain(bot);
      if (t) actTrain(bot, t.building, t.unit, 1 + Math.floor(Math.random() * 3));
    }
  }

  // 5) maybe raid a neighbour (capped bots still skirmish to keep the world alive)
  maybeAttack(bot);
}

let aiCursor = 0;

// Step a slice of the bot population each call to spread out the work.
export function stepBots(): void {
  const bots = Object.values(state.empires).filter((e) => e.isBot);
  if (bots.length === 0) return;
  const batch = Math.max(1, Math.ceil(bots.length / 3));
  for (let i = 0; i < batch; i++) {
    const bot = bots[(aiCursor + i) % bots.length];
    try {
      stepBot(bot);
    } catch (err) {
      console.error("[ai] bot step failed:", err);
    }
  }
  aiCursor = (aiCursor + batch) % bots.length;
}
