// Seed the three VIP wallets with fully-built Imperial empires on first boot.
// Triggered by the SEED_VIP_ACCOUNTS=true env var. Safe to leave on permanently —
// skips any wallet that already has an account.
import { QUESTS } from "../../shared/gamedata.ts";
import { recomputePower } from "./engine.ts";
import { state, scheduleSave } from "./store.ts";
import { now, uid } from "./util.ts";
import type { Empire, User } from "../../shared/types.ts";

const VIP_WALLETS: { address: string; name: string; personality: "raider" | "balanced" | "builder" }[] = [
  { address: "EZppbZe5RaXryEd47NdPRX1ytjCd7bpqnZMDQQXMBB2s", name: "Vaulthorn", personality: "raider"   },
  { address: "57DXn1ZGgfPiT6HqENyokgT9qTyUvpzy4sFraMhAi16z", name: "Solgrave",  personality: "balanced" },
  { address: "H61rKATwp2W8AJpZQLarzXyt8Rpho3UzyRhRpkMgAhY",  name: "Ashveil",   personality: "builder"  },
];

const BANNERS: Record<string, string> = {
  raider:   "#6a0000",
  balanced: "#1a237e",
  builder:  "#1b5e20",
};

const TILE: Record<string, [number, number]> = {
  raider:   [15, 8],
  balanced: [22, 12],
  builder:  [29, 8],
};

// Days-ago offset per personality so join times look natural
const CREATED_OFFSET_MS: Record<string, number> = {
  raider:   2 * 86400 * 1000,
  balanced: 1 * 86400 * 1000,
  builder:  2 * 86400 * 1000,
};

// How many of the 30 quests are claimed per personality
const QUESTS_CLAIMED: Record<string, number> = {
  raider:   30,
  balanced: 25,
  builder:  28,
};

function bld(type: string, level: number, x: number, y: number) {
  return { id: uid("bld_"), type, level, x, y, wx: 24 + (x - 4), wy: 24 + (y - 3), completesAt: null, job: null };
}

function buildings(personality: string) {
  const b = [];
  b.push(bld("town_center", 5, 4, 3));
  for (let x = 0; x < 5; x++) b.push(bld("house", 5, x, 0));
  b.push(bld("lumber_camp", 5, 5, 0));
  b.push(bld("lumber_camp", 5, 6, 0));
  b.push(bld("farm", 5, 7, 0));
  b.push(bld("farm", 5, 8, 0));
  b.push(bld("gold_mine", 5, 0, 1));
  b.push(bld("quarry",    5, 1, 1));
  b.push(bld("market",    5, 2, 1));

  if (personality === "raider") {
    b.push(bld("barracks",      5, 3, 1));
    b.push(bld("archery_range", 5, 5, 1));
    b.push(bld("stable",        5, 6, 1));
    b.push(bld("keep",          5, 7, 1));
    b.push(bld("tower",         4, 8, 1));
    for (const [x, y] of [[0,2],[1,2],[2,2],[3,2],[5,2],[6,2],[7,2],[8,2]] as [number,number][])
      b.push(bld("wall", 3, x, y));
    b.push(bld("temple", 2, 0, 4));
    b.push(bld("wonder", 1, 8, 4));
  } else if (personality === "balanced") {
    b.push(bld("barracks",      5, 3, 1));
    b.push(bld("archery_range", 5, 5, 1));
    b.push(bld("stable",        5, 6, 1));
    b.push(bld("keep",          5, 7, 1));
    b.push(bld("tower",         3, 8, 1));
    for (const [x, y] of [[0,2],[1,2],[2,2],[3,2],[5,2],[6,2],[7,2],[8,2]] as [number,number][])
      b.push(bld("wall", 3, x, y));
    b.push(bld("temple", 3, 0, 4));
    b.push(bld("wonder", 1, 8, 4));
  } else {
    b.push(bld("barracks",      4, 3, 1));
    b.push(bld("archery_range", 4, 5, 1));
    b.push(bld("stable",        4, 6, 1));
    b.push(bld("keep",          5, 7, 1));
    b.push(bld("tower",         3, 8, 1));
    for (const [x, y] of [[0,2],[1,2],[2,2],[3,2],[5,2],[6,2],[7,2],[8,2]] as [number,number][])
      b.push(bld("wall", 4, x, y));
    b.push(bld("temple", 4, 0, 4));
    b.push(bld("wonder", 1, 8, 4));
  }
  return b;
}

function army(personality: string): Record<string, number> {
  if (personality === "raider")   return { villager: 50,  spearman: 800,  archer: 600,  knight: 2800 };
  if (personality === "balanced") return { villager: 80,  spearman: 1200, archer: 1000, knight: 2400 };
  return                                 { villager: 120, spearman: 1500, archer: 1200, knight: 2100 };
}

function armoury(personality: string) {
  if (personality === "raider") return {
    weapon: { villager: 3, spearman: 5, archer: 4, knight: 5 },
    armour: { villager: 3, spearman: 4, archer: 4, knight: 5 },
    helmet: 5, heroArmour: 4,
  };
  if (personality === "balanced") return {
    weapon: { villager: 4, spearman: 5, archer: 5, knight: 5 },
    armour: { villager: 3, spearman: 5, archer: 4, knight: 5 },
    helmet: 4, heroArmour: 4,
  };
  return {
    weapon: { villager: 3, spearman: 4, archer: 5, knight: 4 },
    armour: { villager: 3, spearman: 4, archer: 4, knight: 4 },
    helmet: 4, heroArmour: 3,
  };
}

function hero(personality: string) {
  if (personality === "raider") return {
    skills: { woodcutting: 80000, mining: 65000, foraging: 55000, combat: 280000, construction: 70000 },
    tools:  { axe: 4, pickaxe: 4, sickle: 3, sword: 5 },
  };
  if (personality === "balanced") return {
    skills: { woodcutting: 130000, mining: 110000, foraging: 95000, combat: 160000, construction: 120000 },
    tools:  { axe: 5, pickaxe: 4, sickle: 4, sword: 5 },
  };
  return {
    skills: { woodcutting: 190000, mining: 175000, foraging: 140000, combat: 90000, construction: 210000 },
    tools:  { axe: 5, pickaxe: 5, sickle: 5, sword: 3 },
  };
}

function resources(personality: string) {
  if (personality === "raider")   return { wood: 12000, food: 38000, gold: 25000, stone: 8000  };
  if (personality === "balanced") return { wood: 28000, food: 31000, gold: 19000, stone: 22000 };
  return                                 { wood: 65000, food: 48000, gold: 52000, stone: 71000 };
}

function questList(personality: string) {
  const claimed = QUESTS_CLAIMED[personality];
  return QUESTS.map((q, i) => ({
    questId:   q.id,
    progress:  i < claimed ? q.goal : Math.floor(q.goal / 2),
    goal:      q.goal,
    completed: i < claimed,
    claimed:   i < claimed,
  }));
}

export function seedVipAccounts(): void {
  if (process.env.SEED_VIP_ACCOUNTS !== "true") return;

  let seeded = 0;
  const nowMs = now();

  for (const { address, name, personality } of VIP_WALLETS) {
    // Find existing user/empire for this wallet
    const existingUser = Object.values(state.users).find((u) => u.externalId === address);
    const existingEmpire = existingUser ? state.empires[existingUser.empireId] : undefined;

    // Skip only if already properly seeded (high power = already done)
    if (existingEmpire && existingEmpire.power >= 100000) continue;

    // Remove old under-built empire so we replace it cleanly
    if (existingUser) {
      delete state.empires[existingUser.empireId];
      delete state.users[existingUser.id];
    }

    const userId  = existingUser?.id ?? uid("usr_");
    const empireId = uid("emp_");
    const [tileX, tileY] = TILE[personality];
    const createdAt = nowMs - CREATED_OFFSET_MS[personality];
    const arm = armoury(personality);

    const empire: Empire = {
      id: empireId,
      userId,
      name,
      banner: BANNERS[personality],
      isBot: false,
      age: "imperial",
      tileX, tileY,
      resources: resources(personality) as Empire["resources"],
      lastTick: nowMs,
      buildings: buildings(personality) as Empire["buildings"],
      army: army(personality) as Empire["army"],
      trainQueue: [],
      ageUpCompletesAt: null,
      coins: personality === "raider" ? 4200 : personality === "balanced" ? 8800 : 15500,
      hero: hero(personality) as Empire["hero"],
      quests: questList(personality),
      battles: [],
      log: [{ id: uid("log_"), at: createdAt, kind: "system", text: "Your empire is founded. Long may it reign!" }],
      power: 0,
      raidsWon:  personality === "raider" ? 47 : personality === "balanced" ? 29 : 17,
      raidsLost: personality === "raider" ? 9  : personality === "balanced" ? 6  : 4,
      createdAt,
      armoury: arm as Empire["armoury"],
      duelsWon:   personality === "raider" ? 22 : personality === "balanced" ? 14 : 8,
      duelsLost:  personality === "raider" ? 7  : personality === "balanced" ? 5  : 4,
      duelStreak: personality === "raider" ? 5  : personality === "balanced" ? 2  : 1,
      bossKills:  personality === "raider" ? 9  : personality === "balanced" ? 5  : 3,
    };

    recomputePower(empire);
    state.empires[empireId] = empire;

    const user: User = {
      id: userId,
      username: name,
      passHash: "",
      empireId,
      createdAt,
      externalId: address,
    };
    state.users[userId] = user;

    console.log(`[seed] created VIP account: ${name} (power=${empire.power})`);
    seeded++;
  }

  if (seeded > 0) scheduleSave(0);
}
