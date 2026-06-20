// ─────────────────────────────────────────────────────────────────────────────
// Beta feature locks. New features are built and shipped LOCKED (not live) by
// default — fully functional but gated. Flip a feature's env var to "1" on
// Railway to release it. The client reads the lock map from /api/features and
// shows a "beta · locked" state instead of letting players use it.
// ─────────────────────────────────────────────────────────────────────────────
export type BetaFeature =
  | "spinner"
  | "dailyQuests"
  | "spectate"
  | "mounts"
  | "wilderness"
  | "publicProfile";

// true = locked (hidden/disabled). Default state per feature.
const DEFAULT_LOCKED: Record<BetaFeature, boolean> = {
  spinner: true, // RE-LOCKED — rewards far too generous (passive farm + undercuts $RUMBLE crates); rebalancing before relaunch
  dailyQuests: true, // kept in beta
  spectate: false, // LIVE
  mounts: true, // in-world gameplay stays beta; mounts/pets still appear in the Marketplace as collectibles
  wilderness: false, // LIVE (Tombstone arena mode)
  publicProfile: false, // harmless privacy toggle — live by default
};

const ENV_VAR: Record<BetaFeature, string> = {
  spinner: "FEATURE_SPINNER",
  dailyQuests: "FEATURE_DAILY_QUESTS",
  spectate: "FEATURE_SPECTATE",
  mounts: "FEATURE_MOUNTS",
  wilderness: "FEATURE_WILDERNESS",
  publicProfile: "FEATURE_PUBLIC_PROFILE",
};

// Locked unless the env var explicitly unlocks it ("1"/"true"). Set the var to
// "0" to force-lock a default-on feature.
export function isLocked(f: BetaFeature): boolean {
  const v = (process.env[ENV_VAR[f]] || "").trim().toLowerCase();
  if (v === "1" || v === "true") return false;
  if (v === "0" || v === "false") return true;
  return DEFAULT_LOCKED[f];
}

export function featureLocks(): Record<BetaFeature, boolean> {
  return {
    spinner: isLocked("spinner"),
    dailyQuests: isLocked("dailyQuests"),
    spectate: isLocked("spectate"),
    mounts: isLocked("mounts"),
    wilderness: isLocked("wilderness"),
    publicProfile: isLocked("publicProfile"),
  };
}
