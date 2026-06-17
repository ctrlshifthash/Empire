// ─────────────────────────────────────────────────────────────────────────────
// Token-weighted governance. Holders vote on polls; their vote weight is their
// on-chain token balance (read live at vote time). One vote per wallet, and it
// can be changed while the poll is open. Reading holdings reuses the same RPC +
// mint as the rewards system. No SOL is spent — this is purely a community vote.
// ─────────────────────────────────────────────────────────────────────────────
import type { Poll, PollResult } from "../../shared/types.ts";
import { state, scheduleSave } from "./store.ts";
import { getHoldings, rewardsConfigured } from "./rewards.ts";
import { now, uid } from "./util.ts";

export interface GovResult {
  ok: boolean;
  error?: string;
}

// Close any polls whose time is up (lazy — called whenever polls are read/voted).
function closeExpired(): void {
  for (const p of Object.values(state.polls)) {
    if (p.status === "open" && now() >= p.endsAt) p.status = "closed";
  }
}

export function createPoll(question: string, optionLabels: string[], durationMs: number): { ok: boolean; error?: string; id?: string } {
  const q = String(question ?? "").trim();
  const labels = (optionLabels ?? []).map((l) => String(l).trim()).filter(Boolean);
  if (q.length < 4) return { ok: false, error: "Question too short." };
  if (labels.length < 2) return { ok: false, error: "Need at least two options." };
  const poll: Poll = {
    id: uid("poll_"),
    question: q,
    options: labels.slice(0, 6).map((label) => ({ id: uid("opt_"), label })),
    createdAt: now(),
    endsAt: now() + Math.max(60_000, durationMs),
    status: "open",
    votes: {},
    weights: {},
  };
  state.polls[poll.id] = poll;
  scheduleSave(0);
  return { ok: true, id: poll.id };
}

export async function castVote(pollId: string, address: string, optionId: string): Promise<GovResult> {
  if (!rewardsConfigured()) return { ok: false, error: "Voting opens once the token is live." };
  const poll = state.polls[pollId];
  if (!poll) return { ok: false, error: "Poll not found." };
  if (poll.status !== "open" || now() >= poll.endsAt) return { ok: false, error: "This poll has closed." };
  if (!poll.options.some((o) => o.id === optionId)) return { ok: false, error: "Unknown option." };

  // vote weight = current on-chain token holdings
  const holdings = await getHoldings(address);
  if (holdings.balance <= 0) return { ok: false, error: "You need to hold the token to vote." };

  poll.votes[address] = optionId;
  poll.weights[address] = holdings.balance;
  scheduleSave(0);
  return { ok: true };
}

export function pollResults(address?: string): PollResult[] {
  closeExpired();
  return Object.values(state.polls)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((p) => {
      const tally: Record<string, number> = {};
      let totalWeight = 0;
      for (const [wallet, optId] of Object.entries(p.votes)) {
        const w = p.weights[wallet] ?? 0;
        tally[optId] = (tally[optId] ?? 0) + w;
        totalWeight += w;
      }
      return {
        id: p.id,
        question: p.question,
        createdAt: p.createdAt,
        endsAt: p.endsAt,
        status: p.status,
        totalVoters: Object.keys(p.votes).length,
        totalWeight,
        options: p.options.map((o) => ({
          id: o.id,
          label: o.label,
          weight: tally[o.id] ?? 0,
          pct: totalWeight > 0 ? ((tally[o.id] ?? 0) / totalWeight) * 100 : 0,
        })),
        yourVote: address ? p.votes[address] ?? null : null,
      };
    });
}

// Seed a first community poll on boot so the page is never empty.
export function seedGovernance(): void {
  if (Object.keys(state.polls).length > 0) return;
  createPoll(
    "What should the realm build next?",
    ["Naval raids & ships", "A contested Wonder to hold", "Seasons with prize ladders", "Spy & scouting missions"],
    7 * 24 * 60 * 60 * 1000, // 7 days
  );
}
