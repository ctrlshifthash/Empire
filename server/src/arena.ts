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
} from "../../shared/gamedata.ts";
import type { Duel, DuelPublic, Empire, UnitType } from "../../shared/types.ts";
import { state, scheduleSave } from "./store.ts";
import { recomputePower } from "./engine.ts";
import { now, uid } from "./util.ts";

type Army = Partial<Record<UnitType, number>>;

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
  if (winner) {
    winner.coins += prize;
    winner.duelsWon = (winner.duelsWon ?? 0) + 1;
  }
  if (loser) loser.duelsLost = (loser.duelsLost ?? 0) + 1;

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

  delete state.duels[duelId];
  scheduleSave(0);
  return {
    ok: true,
    members: [e.id, duel.challengerId],
    outcome: { won: !challengerWins, prize, opponentName: duel.challengerName },
  };
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
