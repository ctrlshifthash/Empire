import { SERVER_URL } from "./config";
import type { BurnRecord } from "@shared/types";

export interface BurnStats {
  totalBurned: number;
  mint: string;
  treasury: string | null;
  burns: BurnRecord[];
}

export async function fetchBurns(): Promise<BurnStats> {
  try {
    const r = await fetch(`${SERVER_URL}/api/burns`).then((x) => x.json());
    return r?.ok
      ? { totalBurned: r.totalBurned ?? 0, mint: r.mint ?? "", treasury: r.treasury ?? null, burns: r.burns ?? [] }
      : { totalBurned: 0, mint: "", treasury: null, burns: [] };
  } catch {
    return { totalBurned: 0, mint: "", treasury: null, burns: [] };
  }
}
