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
  return { id: u.id, username: u.username, empireId: u.empireId };
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
