// ─────────────────────────────────────────────────────────────────────────────
// World Boss — a server-wide PvE event. A shared boss spawns; every player can
// commit army to damage it (losing some troops each strike). When it dies, the
// spoils — IN-GAME coins + resources, scaled by the boss tier — are split across
// everyone who damaged it, by damage share, with a bonus for the top dealer.
// NO SOL is ever paid here: the token reward pool is completely untouched.
// ─────────────────────────────────────────────────────────────────────────────
import {
  UNITS,
  UNIT_TYPES,
  GEAR_BONUS,
  BOSS_BASE_HP,
  BOSS_HP_GROWTH,
  BOSS_RESPAWN_MS,
  BOSS_HIT_COOLDOWN_MS,
  BOSS_CASUALTY_RATE,
  BOSS_COIN_POOL,
  BOSS_RESOURCE_POOL,
  BOSS_POOL_GROWTH,
  BOSS_TOP_BONUS,
  BOSS_NAMES,
} from "../../shared/gamedata.ts";
import type { Army } from "../../shared/combat.ts";
import type { BossPublic, Empire, WorldBoss } from "../../shared/types.ts";
import { state, scheduleSave } from "./store.ts";
import { recomputePower } from "./engine.ts";
import { now, uid } from "./util.ts";

const RESOURCE_KEYS = ["wood", "food", "gold", "stone"] as const;

function spawnBoss(tier: number): WorldBoss {
  const name = BOSS_NAMES[(tier - 1) % BOSS_NAMES.length];
  const maxHp = Math.round(BOSS_BASE_HP * Math.pow(BOSS_HP_GROWTH, tier - 1));
  return { id: uid("boss_"), name, tier, maxHp, hp: maxHp, spawnedAt: now(), status: "alive", contributions: {} };
}

// Called from the world tick: spawn the first boss, and respawn (tougher) once
// the post-kill cooldown elapses.
export function tickBoss(): void {
  const b = state.boss;
  if (!b) {
    state.boss = spawnBoss(1);
    return;
  }
  if (b.status === "slain" && b.respawnAt && now() >= b.respawnAt) {
    state.boss = spawnBoss(b.tier + 1);
    scheduleSave();
  }
}

function armyDamage(e: Empire, units: Army): number {
  let dmg = 0;
  for (const u of UNIT_TYPES) {
    const n = units[u] ?? 0;
    if (n <= 0) continue;
    const gear = 1 + (e.armoury?.weapon?.[u] ?? 0) * GEAR_BONUS; // weapons boost boss damage
    dmg += n * UNITS[u].attack * gear;
  }
  return Math.round(dmg);
}

function bossLog(e: Empire, text: string): void {
  e.log.unshift({ id: uid("log_"), at: now(), kind: "system", text });
  if (e.log.length > 60) e.log.length = 60;
}

export interface BossAttackResult {
  ok: boolean;
  error?: string;
  damage?: number;
  slain?: boolean;
}

export function attackBoss(e: Empire, rawUnits: Army): BossAttackResult {
  const b = state.boss;
  if (!b || b.status !== "alive") return { ok: false, error: "There's no boss to fight right now." };

  const existing = b.contributions[e.id];
  if (existing && existing.lastAt + BOSS_HIT_COOLDOWN_MS > now()) {
    const wait = Math.ceil((existing.lastAt + BOSS_HIT_COOLDOWN_MS - now()) / 1000);
    return { ok: false, error: `Your army is regrouping — strike again in ${wait}s.` };
  }

  // sanitise the committed army (only what they actually have)
  const clean: Army = {};
  let total = 0;
  for (const u of UNIT_TYPES) {
    const n = Math.floor(Number(rawUnits[u]) || 0);
    if (n < 0) return { ok: false, error: "Invalid army." };
    if (n > (e.army[u] ?? 0)) return { ok: false, error: `Not enough ${UNITS[u].name}.` };
    if (n > 0) {
      clean[u] = n;
      total += n;
    }
  }
  if (total <= 0) return { ok: false, error: "Send at least one unit." };

  const dmg = armyDamage(e, clean);
  if (dmg <= 0) return { ok: false, error: "These units can't dent it — send soldiers." };

  // casualties: a fraction of every committed unit type is lost in the assault
  let lostTotal = 0;
  for (const u of UNIT_TYPES) {
    if (!clean[u]) continue;
    const lost = Math.min(e.army[u], Math.round(clean[u]! * BOSS_CASUALTY_RATE));
    e.army[u] -= lost;
    lostTotal += lost;
  }
  recomputePower(e);

  const applied = Math.min(b.hp, dmg);
  b.hp -= applied;
  const c = existing ?? { empireId: e.id, name: e.name, banner: e.banner, damage: 0, lastAt: 0 };
  c.damage += applied;
  c.lastAt = now();
  c.name = e.name;
  c.banner = e.banner;
  b.contributions[e.id] = c;
  bossLog(e, `Struck ${b.name} for ${applied.toLocaleString()} damage (lost ${lostTotal} troops).`);

  let slain = false;
  if (b.hp <= 0) {
    b.hp = 0;
    b.status = "slain";
    b.slainAt = now();
    b.respawnAt = now() + BOSS_RESPAWN_MS;
    b.slayerName = e.name;
    distributeSpoils(b);
    slain = true;
  }
  scheduleSave();
  return { ok: true, damage: applied, slain };
}

// Split in-game spoils across every contributor by damage share (top dealer gets
// a bonus). Coins + resources only — never SOL.
function distributeSpoils(b: WorldBoss): void {
  const contribs = Object.values(b.contributions);
  const total = contribs.reduce((s, c) => s + c.damage, 0);
  if (total <= 0) return;
  const top = contribs.slice().sort((x, y) => y.damage - x.damage)[0];
  const coinPool = Math.round(BOSS_COIN_POOL * Math.pow(BOSS_POOL_GROWTH, b.tier - 1));
  const resPool = Math.round(BOSS_RESOURCE_POOL * Math.pow(BOSS_POOL_GROWTH, b.tier - 1));

  for (const c of contribs) {
    const e = state.empires[c.empireId];
    if (!e) continue;
    const isTop = top && c.empireId === top.empireId;
    const share = (c.damage / total) * (isTop ? BOSS_TOP_BONUS : 1);
    const coins = Math.floor(coinPool * share);
    e.coins += coins;
    for (const k of RESOURCE_KEYS) e.resources[k] += Math.floor(resPool * share);
    bossLog(
      e,
      `${b.name} is slain! Your spoils: ${coins.toLocaleString()} coins + resources${isTop ? " — TOP DAMAGE bonus!" : ""}.`,
    );
  }
}

export function bossPublic(empireId?: string): BossPublic | null {
  const b = state.boss;
  if (!b) return null;
  const contribs = Object.values(b.contributions);
  const topDamage = contribs
    .slice()
    .sort((x, y) => y.damage - x.damage)
    .slice(0, 5)
    .map((c) => ({ name: c.name, banner: c.banner, damage: c.damage }));
  const mine = empireId ? b.contributions[empireId] : undefined;
  const yourCooldownMs = mine ? Math.max(0, mine.lastAt + BOSS_HIT_COOLDOWN_MS - now()) : 0;
  return {
    id: b.id,
    name: b.name,
    tier: b.tier,
    maxHp: b.maxHp,
    hp: b.hp,
    status: b.status,
    respawnAt: b.respawnAt,
    slayerName: b.slayerName,
    totalContributors: contribs.length,
    topDamage,
    yourDamage: mine?.damage ?? 0,
    yourCooldownMs,
  };
}
