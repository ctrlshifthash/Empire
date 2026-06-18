import { SERVER_URL } from "./config";

// Beta feature locks, read from the server. true = locked (not live yet).
export type BetaFeature = "spinner" | "dailyQuests" | "spectate" | "mounts" | "wilderness" | "publicProfile";

export async function fetchFeatureLocks(): Promise<Partial<Record<BetaFeature, boolean>>> {
  try {
    const r = await fetch(`${SERVER_URL}/api/features`).then((x) => x.json());
    return r?.ok ? (r.locked ?? {}) : {};
  } catch {
    return {};
  }
}
