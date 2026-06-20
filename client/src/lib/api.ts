import { API_BASE } from "./config";
import type { AuthUser, Empire } from "@shared/types";

export interface EmpireRow {
  id: string;
  name: string;
  banner: string;
  isBot: boolean;
  age: string;
  power: number;
  rank: string;
  tier?: number;
  raidsWon: number;
  raidsLost: number;
  armySize: number;
  buildings: number;
  tileX: number;
  tileY: number;
  online: boolean;
}

export interface AuthResponse {
  ok: boolean;
  error?: string;
  token?: string;
  user?: AuthUser;
  gated?: boolean; // wallet doesn't hold the required minimum to play
  required?: number;
  held?: number;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

async function get<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(API_BASE + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return (await res.json()) as T;
}

export const api = {
  register: (username: string, password: string, empireName?: string) =>
    post<AuthResponse>("/api/register", { username, password, empireName }),
  login: (username: string, password: string) =>
    post<AuthResponse>("/api/login", { username, password }),
  privyAuth: (identity: string, label?: string) =>
    post<AuthResponse>("/api/auth/privy", { identity, label }),
  demoAuth: (label?: string) => post<AuthResponse>("/api/auth/demo", { label }),
  me: (token: string) => get<{ ok: boolean; user?: AuthUser }>("/api/me", token),
  empires: () => get<{ ok: boolean; rows: EmpireRow[] }>("/api/empires"),
  empire: (id: string) =>
    get<{ ok: boolean; empire?: Empire; rank?: string; online?: boolean; error?: string }>(`/api/empires/${id}`),
  stats: () =>
    get<{
      ok: boolean;
      worldTick: number;
      totalEmpires: number;
      players: number;
      bots: number;
      online: number;
      totalSolEarned: number;
      activeMarches: number;
      totalArmies: number;
    }>("/api/stats"),
  leaderboard: () =>
    get<{
      ok: boolean;
      rows: Array<{
        name: string;
        banner: string;
        isBot: boolean;
        age: string;
        power: number;
        raidsWon: number;
        online: boolean;
        solEarned: number;
      }>;
      playersOnline?: number;
      totalSolEarned?: number;
    }>("/api/leaderboard"),
};
