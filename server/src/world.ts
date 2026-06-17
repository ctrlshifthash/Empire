import {
  COLORS_BANNER,
  QUESTS,
  STARTING_RESOURCES,
  botTier,
  rankForPower,
  rollBotTier,
} from "../../shared/gamedata.ts";
import { newHeroState } from "../../shared/progression.ts";
import {
  LOCAL_WORLD,
  type Building,
  type Empire,
  type EmpirePublic,
  type UnitType,
  type User,
} from "../../shared/types.ts";
import { state } from "./store.ts";
import { armySize } from "../../shared/combat.ts";
import { mulberry32, now, pick, randInt, uid } from "./util.ts";

// Base view grid size (where buildings are placed inside an empire).
export const BASE_W = 9;
export const BASE_H = 7;

// Find a free tile in the local walkable world near the town center, spiralling
// outward so buildings don't overlap. Used for in-dashboard placement.
export function worldFreeTile(empire: Empire): { wx: number; wy: number } {
  const occupied = new Set(
    empire.buildings.filter((b) => b.wx != null).map((b) => `${b.wx},${b.wy}`),
  );
  const cx = LOCAL_WORLD.centerX;
  const cy = LOCAL_WORLD.centerY;
  for (let r = 2; r < 8; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring only
        const wx = cx + dx;
        const wy = cy + dy;
        if (wx < 2 || wy < 2 || wx > LOCAL_WORLD.width - 2 || wy > LOCAL_WORLD.height - 2) continue;
        if (!occupied.has(`${wx},${wy}`)) return { wx, wy };
      }
    }
  }
  return { wx: cx, wy: cy + 2 };
}

// Backfill the hero progression block for older saves.
export function ensureHero(empire: Empire): void {
  if (!empire.battles) empire.battles = [];
  if (!empire.hero) empire.hero = newHeroState();
  empire.hero.skills ??= newHeroState().skills;
  empire.hero.tools ??= newHeroState().tools;
  const fresh = newHeroState();
  for (const k of Object.keys(fresh.skills) as (keyof typeof fresh.skills)[]) {
    if (typeof empire.hero.skills[k] !== "number") empire.hero.skills[k] = 0;
  }
  for (const k of Object.keys(fresh.tools) as (keyof typeof fresh.tools)[]) {
    if (typeof empire.hero.tools[k] !== "number") empire.hero.tools[k] = 1;
  }
}

// Backfill world coordinates for any building that lacks them (older saves /
// dashboard-built structures), so everything shows up in the live world.
export function ensureWorldPositions(empire: Empire): void {
  for (const b of empire.buildings) {
    if (b.wx == null || b.wy == null) {
      if (b.type === "town_center") {
        b.wx = LOCAL_WORLD.centerX;
        b.wy = LOCAL_WORLD.centerY;
      } else {
        const t = worldFreeTile(empire);
        b.wx = t.wx;
        b.wy = t.wy;
      }
    }
  }
}

export function emptyArmy(): Record<UnitType, number> {
  return { villager: 0, spearman: 0, archer: 0, knight: 0 };
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.round(Math.hypot(ax - bx, ay - by));
}

// Find an unoccupied tile on the world map with some spacing from others.
export function findFreeTile(): { x: number; y: number } {
  const rng = mulberry32(state.world.seed + Object.keys(state.empires).length * 977 + state.world.tick);
  const occupied = new Set(Object.values(state.empires).map((e) => `${e.tileX},${e.tileY}`));
  for (let attempt = 0; attempt < 600; attempt++) {
    const x = randInt(rng, 1, state.world.width - 2);
    const y = randInt(rng, 1, state.world.height - 2);
    const key = `${x},${y}`;
    if (occupied.has(key)) continue;
    // keep a little breathing room from neighbours
    let tooClose = false;
    for (const e of Object.values(state.empires)) {
      if (Math.abs(e.tileX - x) + Math.abs(e.tileY - y) < 2) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) return { x, y };
  }
  // fallback: any free-ish tile
  return {
    x: randInt(rng, 1, state.world.width - 2),
    y: randInt(rng, 1, state.world.height - 2),
  };
}

const BOT_NAMES = [
  "Iron Legion", "Crimson Horde", "Azure Dynasty", "Golden Caliphate",
  "Stormguard", "Black Banner", "Sunspear Clan", "Frostwolf Tribe",
  "Emerald Court", "Ashen Empire", "Silver Host", "Thunder Khanate",
];

export function createEmpire(opts: {
  userId: string;
  name: string;
  isBot: boolean;
  bannerIndex?: number;
}): Empire {
  const tile = findFreeTile();
  const banner =
    opts.bannerIndex != null
      ? COLORS_BANNER[opts.bannerIndex % COLORS_BANNER.length]
      : COLORS_BANNER[Math.floor((Object.keys(state.empires).length) % COLORS_BANNER.length)];

  const army = emptyArmy();
  army.villager = 3;

  const empire: Empire = {
    id: uid("emp_"),
    userId: opts.userId,
    name: opts.name,
    banner,
    isBot: opts.isBot,
    age: "dark",
    tileX: tile.x,
    tileY: tile.y,
    resources: STARTING_RESOURCES(),
    lastTick: now(),
    buildings: [
      {
        id: uid("bld_"),
        type: "town_center",
        level: 1,
        x: Math.floor(BASE_W / 2),
        y: Math.floor(BASE_H / 2),
        wx: LOCAL_WORLD.centerX,
        wy: LOCAL_WORLD.centerY,
        completesAt: null,
        job: null,
      },
    ],
    army,
    trainQueue: [],
    ageUpCompletesAt: null,
    coins: 50,
    hero: newHeroState(),
    battles: [],
    quests: QUESTS.map((q) => ({
      questId: q.id,
      progress: 0,
      goal: q.goal,
      completed: false,
      claimed: false,
    })),
    log: [
      {
        id: uid("log_"),
        at: now(),
        kind: "system",
        text: opts.isBot ? "A rival empire rises." : "Your empire is founded. Long may it reign!",
      },
    ],
    power: 10,
    raidsWon: 0,
    raidsLost: 0,
    createdAt: now(),
  };
  return empire;
}

export function spawnBot(): Empire {
  const rng = mulberry32(state.world.seed + Object.keys(state.empires).length * 131 + state.world.tick);
  const baseName = pick(rng, BOT_NAMES);
  // avoid duplicate names
  let name = baseName;
  let n = 2;
  const existing = new Set(Object.values(state.empires).map((e) => e.name));
  while (existing.has(name)) name = `${baseName} ${n++}`;

  const botUserId = uid("botuser_");
  const empire = createEmpire({ userId: botUserId, name, isBot: true });
  // assign a difficulty tier (weighted toward weaker rivals) and a head-start
  // army so each rival climbs to its tier's power band
  const tier = rollBotTier(rng());
  empire.tier = tier.tier;
  empire.army.spearman = tier.startSpears + randInt(rng, 0, 2);
  state.empires[empire.id] = empire;
  return empire;
}

export function publicView(e: Empire, online: boolean): EmpirePublic {
  return {
    id: e.id,
    name: e.name,
    banner: e.banner,
    isBot: e.isBot,
    age: e.age,
    tileX: e.tileX,
    tileY: e.tileY,
    power: e.power,
    armySize: armySize(e.army),
    online: e.isBot ? true : online,
    tier: e.tier,
    rank: e.isBot ? botTier(e.tier).rank : rankForPower(e.power).name,
    allianceId: e.allianceId,
    allianceTag: e.allianceId ? state.alliances[e.allianceId]?.tag : undefined,
  };
}

export function empireOfUser(user: User): Empire | undefined {
  return state.empires[user.empireId];
}
