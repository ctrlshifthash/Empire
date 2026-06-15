import type { AuthUser, User } from "../../shared/types.ts";
import { state, scheduleSave } from "./store.ts";
import { createEmpire } from "./world.ts";
import { hashPassword, token as makeToken, now, uid, verifyPassword } from "./util.ts";

export interface AuthResult {
  ok: boolean;
  error?: string;
  token?: string;
  user?: AuthUser;
}

function publicUser(u: User): AuthUser {
  return { id: u.id, username: u.username, empireId: u.empireId, demo: u.demo };
}

// keep only the allowed username charset, collapse whitespace
function sanitizeName(s: string): string {
  return (s || "").replace(/[^a-zA-Z0-9_ ]+/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
}

// a friendly display name from a wallet address or email
function prettyIdentity(ext: string): string {
  if (ext.includes("@")) return sanitizeName(ext.split("@")[0]) || "Player";
  // looks like a wallet address — short it
  if (ext.length > 12) return `Sol ${ext.slice(0, 4)}${ext.slice(-4)}`;
  return sanitizeName(ext) || "Player";
}

// ensure the chosen display name is unique (append a number if taken)
function uniqueUsername(base: string): string {
  let name = sanitizeName(base) || "Player";
  if (name.length < 3) name = `${name}${name}`.slice(0, 6) || "Player";
  const taken = (n: string) => Object.values(state.users).some((u) => u.username.toLowerCase() === n.toLowerCase());
  if (!taken(name)) return name;
  for (let i = 2; i < 100000; i++) {
    const candidate = `${name} ${i}`.slice(0, 20);
    if (!taken(candidate)) return candidate;
  }
  return `${name} ${uid()}`.slice(0, 20);
}

function newAccount(username: string, extra: Partial<User>): User {
  const userId = uid("usr_");
  const empire = createEmpire({
    userId,
    name: username.slice(0, 24) || username,
    isBot: false,
    bannerIndex: Object.keys(state.users).length,
  });
  state.empires[empire.id] = empire;
  const user: User = { id: userId, username, passHash: "", empireId: empire.id, createdAt: now(), ...extra };
  state.users[userId] = user;
  return user;
}

function issueToken(user: User): AuthResult {
  // invalidate this user's previous tokens so state.tokens stays bounded
  for (const [t, id] of Object.entries(state.tokens)) {
    if (id === user.id) delete state.tokens[t];
  }
  const tok = makeToken();
  state.tokens[tok] = user.id;
  scheduleSave(0);
  return { ok: true, token: tok, user: publicUser(user) };
}

// Login (or first-time create) via Privy — keyed by a verified wallet address or
// email. No password: ownership is proven by Privy on the client. The same
// identity always resolves to the same empire.
export function privyLogin(identity: string, label?: string): AuthResult {
  const ext = (identity || "").trim();
  if (ext.length < 3) return { ok: false, error: "Missing wallet or email identity." };
  let user = Object.values(state.users).find((u) => u.externalId === ext);
  if (!user) user = newAccount(uniqueUsername(label || prettyIdentity(ext)), { externalId: ext });
  return issueToken(user);
}

// Spin up a fresh throwaway demo empire (worthless in-game coins, no rewards).
export function demoLogin(label?: string): AuthResult {
  const user = newAccount(uniqueUsername(label || "Wanderer"), { demo: true });
  return issueToken(user);
}

export function register(username: string, password: string, empireName?: string): AuthResult {
  username = (username || "").trim();
  if (username.length < 3 || username.length > 20)
    return { ok: false, error: "Username must be 3–20 characters." };
  if (!/^[a-zA-Z0-9_ ]+$/.test(username))
    return { ok: false, error: "Username may only contain letters, numbers, spaces and underscores." };
  if ((password || "").length < 4) return { ok: false, error: "Password must be at least 4 characters." };

  const exists = Object.values(state.users).some(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
  if (exists) return { ok: false, error: "That username is already taken." };

  const userId = uid("usr_");
  const empire = createEmpire({
    userId,
    name: (empireName || username).trim().slice(0, 24) || username,
    isBot: false,
    bannerIndex: Object.keys(state.users).length,
  });
  state.empires[empire.id] = empire;

  const user: User = {
    id: userId,
    username,
    passHash: hashPassword(password),
    empireId: empire.id,
    createdAt: now(),
  };
  state.users[userId] = user;

  const tok = makeToken();
  state.tokens[tok] = userId;
  scheduleSave(0);
  return { ok: true, token: tok, user: publicUser(user) };
}

export function login(username: string, password: string): AuthResult {
  const user = Object.values(state.users).find(
    (u) => u.username.toLowerCase() === (username || "").trim().toLowerCase(),
  );
  if (!user || !user.passHash) return { ok: false, error: "Invalid username or password." };
  if (!verifyPassword(password, user.passHash))
    return { ok: false, error: "Invalid username or password." };

  // invalidate this user's previous tokens so state.tokens stays bounded
  for (const [t, uid] of Object.entries(state.tokens)) {
    if (uid === user.id) delete state.tokens[t];
  }

  const tok = makeToken();
  state.tokens[tok] = user.id;
  scheduleSave(0);
  return { ok: true, token: tok, user: publicUser(user) };
}

export function userByToken(token: string | undefined): User | undefined {
  if (!token) return undefined;
  const userId = state.tokens[token];
  if (!userId) return undefined;
  return state.users[userId];
}

export function authUser(token: string | undefined): AuthUser | undefined {
  const u = userByToken(token);
  return u ? publicUser(u) : undefined;
}
