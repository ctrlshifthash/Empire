// ─────────────────────────────────────────────────────────────────────────────
// Wagered Arena — consensual PvP coin duels. A challenger stakes coins and
// commits an army; anyone can accept by matching the stake and committing their
// own army. The fight resolves instantly: the winner takes the pot (minus a
// small rake that's burned as a coin sink). Both sides take army casualties.
// Rewards are IN-GAME COINS only — no SOL, the reward pool is untouched.
// ─────────────────────────────────────────────────────────────────────────────
import {
  UNITS,
  UNIT_TYPES,
  GEAR_BONUS,
  ARENA_MIN_STAKE,
  ARENA_RAKE,
  ARENA_WINNER_LOSS,
  ARENA_LOSER_LOSS,
  ARENA_DAILY_BONUS,
  TOURNEY_ENTRY_FEE,
  TOURNEY_SIZE,
  TOMBSTONE_RECOVER_PCT,
  TOMBSTONE_WINDOW_MS,
} from "../../shared/gamedata.ts";
import type {
  Duel,
  DuelPublic,
  Empire,
  Tombstone,
  TombstonePublic,
  Tournament,
  TournamentPublic,
  UnitType,
} from "../../shared/types.ts";
import { state, scheduleSave } from "./store.ts";
import { recomputePower } from "./engine.ts";
import { mintItem, randomDropType } from "./market.ts";
import { isLocked } from "./features.ts";
import { now, uid } from "./util.ts";

type Army = Partial<Record<UnitType, number>>;
const DAY_MS = 86_400_000;

// Award win-streak + the once-daily win bonus to a duel/tournament winner. The
// bonus is only paid for beating a real, comparable opponent (non-bot, at least
// half your power) — so it can't be farmed off bots or a weak throwaway alt. The
// streak always counts.
const MIN_BONUS_OPP_RATIO = 0.5;
function recordWin(e: Empire, opponent?: Empire): number {
  e.duelsWon = (e.duelsWon ?? 0) + 1;
  e.duelStreak = (e.duelStreak ?? 0) + 1;
  e.bestStreak = Math.max(e.bestStreak ?? 0, e.duelStreak);
  const qualifies = !!opponent && !opponent.isBot && opponent.power >= e.power * MIN_BONUS_OPP_RATIO;
  const day = Math.floor(now() / DAY_MS);
  if (qualifies && e.lastArenaBonusDay !== day) {
    e.lastArenaBonusDay = day;
    e.coins += ARENA_DAILY_BONUS;
    return ARENA_DAILY_BONUS;
  }
  return 0;
}

export interface ArenaResult {
  ok: boolean;
  error?: string;
  members?: string[]; // empire ids to refresh
  outcome?: { won: boolean; prize: number; opponentName: string }; // for the accepter
}

function sanitiseArmy(e: Empire, raw: Army): { army: Army; total: number; error?: string } {
  const army: Army = {};
  let total = 0;
  for (const u of UNIT_TYPES) {
    const n = Math.floor(Number(raw[u]) || 0);
    if (n < 0) return { army, total, error: "Invalid army." };
    if (n > (e.army[u] ?? 0)) return { army, total, error: `Not enough ${UNITS[u].name}.` };
    if (n > 0) {
      army[u] = n;
      total += n;
    }
  }
  return { army, total };
}

function battlePower(army: Army, armoury: Empire["armoury"]): number {
  let p = 0;
  for (const u of UNIT_TYPES) {
    const n = army[u] ?? 0;
    if (n <= 0) continue;
    const atk = UNITS[u].attack * (1 + (armoury?.weapon?.[u] ?? 0) * GEAR_BONUS);
    const def = UNITS[u].defense * (1 + (armoury?.armour?.[u] ?? 0) * GEAR_BONUS);
    p += n * (atk + def + UNITS[u].hp * 0.1);
  }
  return p;
}

function returnSurvivors(e: Empire, committed: Army, lossFrac: number): void {
  for (const u of UNIT_TYPES) {
    const n = committed[u] ?? 0;
    if (n > 0) e.army[u] = (e.army[u] ?? 0) + Math.floor(n * (1 - lossFrac));
  }
}

export function createDuel(e: Empire, rawStake: number, rawArmy: Army, mode: "normal" | "tombstone" = "normal"): ArenaResult {
  if (mode === "tombstone" && isLocked("wilderness")) return { ok: false, error: "Tombstone duels are in beta — not live yet." };
  const stake = Math.floor(Number(rawStake) || 0);
  if (stake < ARENA_MIN_STAKE) return { ok: false, error: `Minimum wager is ${ARENA_MIN_STAKE} coins.` };
  if (e.coins < stake) return { ok: false, error: `You need ${stake} coins to stake that.` };
  const { army, total, error } = sanitiseArmy(e, rawArmy);
  if (error) return { ok: false, error };
  if (total <= 0) return { ok: false, error: "Commit at least one unit." };

  // escrow: take the stake and detach the committed army
  e.coins -= stake;
  for (const u of UNIT_TYPES) if (army[u]) e.army[u] -= army[u]!;

  const duel: Duel = {
    id: uid("duel_"),
    challengerId: e.id,
    challengerName: e.name,
    challengerBanner: e.banner,
    stake,
    army,
    status: "open",
    createdAt: now(),
    mode,
  };
  state.duels[duel.id] = duel;
  scheduleSave(0);
  return { ok: true, members: [e.id] };
}

export function cancelDuel(e: Empire, duelId: string): ArenaResult {
  const duel = state.duels[duelId];
  if (!duel || duel.status !== "open") return { ok: false, error: "That duel is no longer open." };
  if (duel.challengerId !== e.id) return { ok: false, error: "Not your duel." };
  // refund the stake + return the committed army
  e.coins += duel.stake;
  for (const u of UNIT_TYPES) if (duel.army[u]) e.army[u] = (e.army[u] ?? 0) + duel.army[u]!;
  delete state.duels[duelId];
  scheduleSave(0);
  return { ok: true, members: [e.id] };
}

export function acceptDuel(e: Empire, duelId: string, rawArmy: Army): ArenaResult {
  const duel = state.duels[duelId];
  if (!duel || duel.status !== "open") return { ok: false, error: "That duel is no longer open." };
  if (duel.challengerId === e.id) return { ok: false, error: "You can't accept your own duel." };
  if (e.coins < duel.stake) return { ok: false, error: `You need ${duel.stake} coins to accept.` };
  const { army: oppArmy, total, error } = sanitiseArmy(e, rawArmy);
  if (error) return { ok: false, error };
  if (total <= 0) return { ok: false, error: "Commit at least one unit." };

  const challenger = state.empires[duel.challengerId];

  // escrow the accepter's stake + army
  e.coins -= duel.stake;
  for (const u of UNIT_TYPES) if (oppArmy[u]) e.army[u] -= oppArmy[u]!;

  // resolve with a little variance so it's a real gamble
  const rng = () => 0.8 + Math.random() * 0.4;
  const powA = battlePower(duel.army, challenger?.armoury) * rng();
  const powB = battlePower(oppArmy, e.armoury) * rng();
  const challengerWins = powA >= powB;

  const pot = duel.stake * 2;
  const prize = pot - Math.floor(pot * ARENA_RAKE); // rake is burned (coin sink)

  // pay out + return survivors
  returnSurvivors(e, oppArmy, challengerWins ? ARENA_LOSER_LOSS : ARENA_WINNER_LOSS);
  if (challenger) returnSurvivors(challenger, duel.army, challengerWins ? ARENA_WINNER_LOSS : ARENA_LOSER_LOSS);

  const winner = challengerWins ? challenger : e;
  const loser = challengerWins ? e : challenger;
  const tombstoneMode = duel.mode === "tombstone" && !!winner && !!loser;
  let bonus = 0;
  if (winner) {
    winner.coins += tombstoneMode ? duel.stake : prize; // tombstone: only your own stake back now
    bonus = recordWin(winner, loser); // streak always; daily bonus needs a real, comparable opponent
  }
  if (loser) {
    loser.duelsLost = (loser.duelsLost ?? 0) + 1;
    loser.duelStreak = 0;
  }

  const pushLog = (emp: Empire | undefined, kind: "battle" | "system", text: string) => {
    if (!emp) return;
    emp.log.unshift({ id: uid("log_"), at: now(), kind, text });
    if (emp.log.length > 60) emp.log.length = 60;
  };

  // logs (+ drop the loser's stake into a tombstone in tombstone mode)
  if (tombstoneMode && winner && loser) {
    const tomb: Tombstone = {
      id: uid("tomb_"),
      ownerId: loser.id,
      ownerName: loser.name,
      winnerId: winner.id,
      winnerName: winner.name,
      coins: duel.stake,
      createdAt: now(),
      expiresAt: now() + TOMBSTONE_WINDOW_MS,
    };
    state.tombstones[tomb.id] = tomb;
    pushLog(winner, "battle", `☠️ Tombstone duel: you beat ${loser.name}! Their ${duel.stake} coins are in a tombstone — yours if they don't recover it within 5 minutes.`);
    pushLog(loser, "battle", `☠️ Tombstone duel: ${winner.name} beat you! Your ${duel.stake} coins dropped into a tombstone — recover ${Math.round(TOMBSTONE_RECOVER_PCT * 100)}% within 5 minutes in the Arena.`);
  } else {
    pushLog(winner, "battle", `Arena: you beat ${loser?.name ?? "your rival"} and won ${prize} coins!`);
    pushLog(loser, "battle", `Arena: ${winner?.name ?? "your rival"} beat you — lost your ${duel.stake} coin stake.`);
  }
  if (bonus > 0 && winner) pushLog(winner, "system", `Arena: first win of the day — +${bonus} bonus coins!`);

  if (challenger) recomputePower(challenger);
  recomputePower(e);

  delete state.duels[duelId];
  scheduleSave(0);
  return {
    ok: true,
    members: [e.id, duel.challengerId],
    outcome: { won: !challengerWins, prize: tombstoneMode ? duel.stake : prize, opponentName: duel.challengerName },
  };
}

// ── Tombstones (beta) ────────────────────────────────────────────────────────
// Recover your own dropped stake within the window (keep TOMBSTONE_RECOVER_PCT;
// the rest goes to the victor). After it expires, the victor loots the lot.
function awardTombstoneToWinner(t: Tombstone, full: boolean): void {
  const winner = state.empires[t.winnerId];
  const owner = state.empires[t.ownerId];
  const toWinnerGross = full ? t.coins : t.coins - Math.floor(t.coins * TOMBSTONE_RECOVER_PCT);
  const prize = toWinnerGross - Math.floor(toWinnerGross * ARENA_RAKE); // rake burned (coin sink)
  if (winner && prize > 0) {
    winner.coins += prize;
    winner.log.unshift({ id: uid("log_"), at: now(), kind: full ? "battle" : "system", text: full ? `☠️ ${t.ownerName} never recovered their tombstone — you looted ${prize} coins.` : `☠️ ${t.ownerName} recovered their tombstone — you claimed ${prize} coins.` });
    if (winner.log.length > 60) winner.log.length = 60;
  }
  if (full && owner) {
    owner.log.unshift({ id: uid("log_"), at: now(), kind: "battle", text: `☠️ Your tombstone was looted by ${t.winnerName} — too slow to recover it.` });
    if (owner.log.length > 60) owner.log.length = 60;
  }
}

export function recoverTombstone(e: Empire, tombId: string): ArenaResult {
  if (isLocked("wilderness")) return { ok: false, error: "Tombstone duels are in beta — not live yet." };
  const t = state.tombstones[tombId];
  if (!t || t.ownerId !== e.id) return { ok: false, error: "That tombstone isn't yours." };
  if (now() > t.expiresAt) {
    awardTombstoneToWinner(t, true);
    delete state.tombstones[tombId];
    scheduleSave(0);
    return { ok: false, error: "Too late — the victor looted your tombstone.", members: [e.id, t.winnerId] };
  }
  const recovered = Math.floor(t.coins * TOMBSTONE_RECOVER_PCT);
  e.coins += recovered;
  e.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `☠️ Recovered your tombstone — ${recovered} coins back.` });
  if (e.log.length > 60) e.log.length = 60;
  awardTombstoneToWinner(t, false); // victor gets the remainder
  delete state.tombstones[tombId];
  scheduleSave(0);
  return { ok: true, members: [e.id, t.winnerId] };
}

// Lazy expiry: award expired tombstones to their victors. Returns affected ids.
export function sweepTombstones(): string[] {
  const affected: string[] = [];
  for (const t of Object.values(state.tombstones)) {
    if (now() > t.expiresAt) {
      awardTombstoneToWinner(t, true);
      affected.push(t.winnerId, t.ownerId);
      delete state.tombstones[t.id];
    }
  }
  if (affected.length) scheduleSave(0);
  return affected;
}

export function myTombstones(empireId: string): TombstonePublic[] {
  return Object.values(state.tombstones)
    .filter((t) => t.ownerId === empireId && now() <= t.expiresAt)
    .sort((a, b) => a.expiresAt - b.expiresAt)
    .map((t) => ({ id: t.id, coins: t.coins, recoverable: Math.floor(t.coins * TOMBSTONE_RECOVER_PCT), expiresAt: t.expiresAt, winnerName: t.winnerName }));
}

// ── Rolling tournament ───────────────────────────────────────────────────────
export function ensureTournament(): Tournament {
  if (!state.tournament) {
    state.tournament = { id: uid("tny_"), entryFee: TOURNEY_ENTRY_FEE, size: TOURNEY_SIZE, entrants: [], createdAt: now() };
  }
  return state.tournament;
}

export function joinTournament(e: Empire): ArenaResult {
  const t = ensureTournament();
  if (t.entrants.some((x) => x.empireId === e.id)) return { ok: false, error: "You're already entered." };
  if (e.coins < t.entryFee) return { ok: false, error: `Entry is ${t.entryFee} coins.` };
  e.coins -= t.entryFee; // escrow the entry fee
  t.entrants.push({ empireId: e.id, name: e.name, banner: e.banner, power: battlePower(e.army, e.armoury) });
  const affected = t.entrants.map((x) => x.empireId);
  if (t.entrants.length >= t.size) runTournament(t);
  scheduleSave(0);
  return { ok: true, members: affected };
}

export function leaveTournament(e: Empire): ArenaResult {
  const t = state.tournament;
  if (!t) return { ok: false, error: "No tournament running." };
  const idx = t.entrants.findIndex((x) => x.empireId === e.id);
  if (idx < 0) return { ok: false, error: "You're not entered." };
  t.entrants.splice(idx, 1);
  e.coins += t.entryFee; // refund
  scheduleSave(0);
  return { ok: true, members: [e.id] };
}

// Single-elimination by battle-power with variance; champion takes the pot.
function runTournament(t: Tournament): void {
  const field = [...t.entrants];
  const pot = t.entryFee * field.length;
  const prize = pot - Math.floor(pot * ARENA_RAKE);
  let round = field.slice();
  while (round.length > 1) {
    const next: typeof round = [];
    for (let i = 0; i < round.length; i += 2) {
      const a = round[i];
      const b = round[i + 1];
      if (!b) {
        next.push(a); // bye
        continue;
      }
      const rng = () => 0.8 + Math.random() * 0.4;
      next.push(a.power * rng() >= b.power * rng() ? a : b);
    }
    round = next;
  }
  const champ = round[0];
  const champEmpire = champ ? state.empires[champ.empireId] : undefined;
  if (champEmpire) {
    champEmpire.coins += prize;
    recordWin(champEmpire);
    champEmpire.log.unshift({
      id: uid("log_"),
      at: now(),
      kind: "battle",
      text: `🏆 Tournament champion! You won ${prize} coins (${field.length}-player bracket).`,
    });
    if (champEmpire.log.length > 60) champEmpire.log.length = 60;
    // champion drop: a random scarce marketplace item (if any supply remains)
    const dropType = randomDropType();
    if (dropType) {
      const inst = mintItem(champEmpire.id, dropType);
      if (inst) {
        champEmpire.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `Champion's drop: a marketplace item landed in your inventory!` });
        if (champEmpire.log.length > 60) champEmpire.log.length = 60;
      }
    }
  }
  // notify the rest
  for (const ent of field) {
    if (champ && ent.empireId === champ.empireId) continue;
    const emp = state.empires[ent.empireId];
    if (!emp) continue;
    emp.log.unshift({
      id: uid("log_"),
      at: now(),
      kind: "battle",
      text: `Tournament over — ${champ?.name ?? "someone"} took the crown.`,
    });
    if (emp.log.length > 60) emp.log.length = 60;
  }
  // reset for the next one, keeping the champion banner
  state.tournament = {
    id: uid("tny_"),
    entryFee: t.entryFee,
    size: t.size,
    entrants: [],
    createdAt: now(),
    lastChampion: champ ? { name: champ.name, banner: champ.banner, prize, size: field.length, at: now() } : t.lastChampion,
  };
}

export function tournamentPublic(empireId?: string): TournamentPublic | null {
  const t = state.tournament;
  if (!t) return null;
  return {
    id: t.id,
    entryFee: t.entryFee,
    size: t.size,
    count: t.entrants.length,
    entrants: t.entrants.map((x) => ({ name: x.name, banner: x.banner })),
    joined: !!empireId && t.entrants.some((x) => x.empireId === empireId),
    lastChampion: t.lastChampion ?? null,
  };
}

// Top duelists by wins (then best streak). Humans only.
export function arenaRankings(): { name: string; banner: string; duelsWon: number; bestStreak: number; power: number }[] {
  return Object.values(state.empires)
    .filter((e) => !e.isBot && (e.duelsWon ?? 0) > 0)
    .map((e) => ({ name: e.name, banner: e.banner, duelsWon: e.duelsWon ?? 0, bestStreak: e.bestStreak ?? 0, power: e.power }))
    .sort((a, b) => b.duelsWon - a.duelsWon || b.bestStreak - a.bestStreak)
    .slice(0, 25);
}

export function openDuelsPublic(): DuelPublic[] {
  return Object.values(state.duels)
    .filter((d) => d.status === "open")
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((d) => ({
      id: d.id,
      challengerId: d.challengerId,
      challengerName: d.challengerName,
      challengerBanner: d.challengerBanner,
      stake: d.stake,
      armySize: UNIT_TYPES.reduce((s, u) => s + (d.army[u] ?? 0), 0),
      createdAt: d.createdAt,
      mode: d.mode ?? "normal",
    }));
}
