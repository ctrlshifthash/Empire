// Wallet + token-rewards client. Reads config from Vite env (set these in
// client/.env): VITE_PRIVY_APP_ID, VITE_TOKEN_MINT, VITE_SOLANA_RPC.
import { create } from "zustand";
import { SERVER_URL } from "./config";

export const TOKEN_MINT = (import.meta.env.VITE_TOKEN_MINT as string | undefined) ?? "";
export const SOLANA_RPC =
  (import.meta.env.VITE_SOLANA_RPC as string | undefined) ?? "https://api.mainnet-beta.solana.com";
// Wallet sign-in is always available now (standard Solana wallet adapter — no
// app id, no third-party cap). Kept as a named export so the UI gates still read.
export const walletReady = true;

export interface RewardStatus {
  configured: boolean;
  payouts: boolean;
  network: string;
  pool: number;
  holdings: { balance: number; supply: number; sharePct: number };
  multiplier: number;
  playBonus: number;
  playRank: string;
  loyaltyDays: number;
  loyaltyMult: number;
  relicBoost: number;
  dailySol: number;
  claimableSol: number;
  totalClaimedSol: number;
  claimCount: number;
  cooldownMs: number;
  nextClaimAt: number;
  memberSince: number;
  tier: string;
  tierColor: string;
  nextTier: string | null;
  nextTierShare: number | null;
  poolRemaining: number;
  poolPaid: number;
}

interface WalletStore {
  address: string | null;
  status: RewardStatus | null;
  loading: boolean;
  setAddress: (a: string | null) => void;
  refresh: () => Promise<void>;
  claim: () => Promise<{ ok: boolean; error?: string; signature?: string; claimedSol?: number }>;
}

const LS = "ee_wallet";

export const useWallet = create<WalletStore>((set, get) => ({
  address: localStorage.getItem(LS),
  status: null,
  loading: false,
  setAddress: (a) => {
    if (a) localStorage.setItem(LS, a);
    else localStorage.removeItem(LS);
    set({ address: a, status: null });
    if (a) get().refresh();
  },
  refresh: async () => {
    const a = get().address;
    if (!a) return;
    set({ loading: true });
    try {
      const r = await fetch(`${SERVER_URL}/api/rewards/${a}`).then((x) => x.json());
      if (r?.ok) set({ status: r as RewardStatus });
    } catch {
      /* offline / not configured */
    } finally {
      set({ loading: false });
    }
  },
  claim: async () => {
    const a = get().address;
    if (!a) return { ok: false, error: "Connect a wallet first." };
    try {
      const r = await fetch(`${SERVER_URL}/api/rewards/${a}/claim`, { method: "POST" }).then((x) => x.json());
      if (r?.ok) get().refresh();
      return r;
    } catch {
      return { ok: false, error: "Network error." };
    }
  },
}));
