// Client side of token-weighted governance. Reads polls + tallies and casts a
// vote weighted by the connected wallet's on-chain token holdings (server reads
// the holdings — the client just sends its address).
import type { PollResult } from "@shared/types";
import { SERVER_URL } from "./config";

export async function fetchPolls(address?: string | null): Promise<PollResult[]> {
  try {
    const q = address ? `?address=${encodeURIComponent(address)}` : "";
    const r = await fetch(`${SERVER_URL}/api/governance${q}`).then((x) => x.json());
    return r?.ok ? (r.polls as PollResult[]) : [];
  } catch {
    return [];
  }
}

export async function castVote(
  pollId: string,
  address: string,
  optionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    return await fetch(`${SERVER_URL}/api/governance/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollId, address, optionId }),
    }).then((x) => x.json());
  } catch {
    return { ok: false, error: "Network error." };
  }
}
