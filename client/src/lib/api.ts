import { API_BASE } from "./config";
import type { AuthUser } from "@shared/types";

export interface AuthResponse {
  ok: boolean;
  error?: string;
  token?: string;
  user?: AuthUser;
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
  stats: () =>
    get<{
      ok: boolean;
      worldTick: number;
      totalEmpires: number;
      players: number;
      bots: number;
      online: number;
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
      }>;
    }>("/api/leaderboard"),
};
