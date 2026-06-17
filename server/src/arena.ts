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
} from "../../shared/gamedata.ts";
import type {
  Duel,
  DuelPublic,
  Empire,
  Tournament,
  TournamentPublic,
  UnitType,
} from "../../shared/types.ts";
import { state, scheduleSave } from "./store.ts";
import { recomputePower } from "./engine.ts";
import { now, uid } from "./util.ts";

type Army = Partial<Record<UnitType, number>>;
const DAY_MS = 86_400_000;

// Award win-streak + the once-daily win bonus to a duel/tournament winner.
function recordWin(e: Empire): number {
  e.duelsWon = (e.duelsWon ?? 0) + 1;
  e.duelStreak = (e.duelStreak ?? 0) + 1;
  e.bestStreak = Math.max(e.bestStreak ?? 0, e.duelStreak);
  const day = Math.floor(now() / DAY_MS);
  if (e.lastArenaBonusDay !== day) {
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

export function createDuel(e: Empire, rawStake: number, rawArmy: Army): ArenaResult {
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
  let bonus = 0;
  if (winner) {
    winner.coins += prize;
    bonus = recordWin(winner); // streak + once-daily win bonus
  }
  if (loser) {
    loser.duelsLost = (loser.duelsLost ?? 0) + 1;
    loser.duelStreak = 0;
  }

  // logs
  if (challenger) {
    challenger.log.unshift({
      id: uid("log_"),
      at: now(),
      kind: "battle",
      text: challengerWins
        ? `Arena: you beat ${e.name} and won ${prize} coins!`
        : `Arena: ${e.name} beat you — lost your ${duel.stake} coin stake.`,
    });
    if (challenger.log.length > 60) challenger.log.length = 60;
    recomputePower(challenger);
  }
  e.log.unshift({
    id: uid("log_"),
    at: now(),
    kind: "battle",
    text: challengerWins
      ? `Arena: ${duel.challengerName} beat you — lost your ${duel.stake} coin stake.`
      : `Arena: you beat ${duel.challengerName} and won ${prize} coins!`,
  });
  if (e.log.length > 60) e.log.length = 60;
  recomputePower(e);

  if (bonus > 0 && winner) {
    winner.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `Arena: first win of the day — +${bonus} bonus coins!` });
    if (winner.log.length > 60) winner.log.length = 60;
  }

  delete state.duels[duelId];
  scheduleSave(0);
  return {
    ok: true,
    members: [e.id, duel.challengerId],
    outcome: { won: !challengerWins, prize, opponentName: duel.challengerName },
  };
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
    }));
}
