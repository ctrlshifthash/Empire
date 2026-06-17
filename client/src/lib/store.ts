import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import { SERVER_URL } from "./config";
import type {
  AuthUser,
  BattleReport,
  BuildingType,
  GameSnapshot,
  ResourceKind,
  ToolId,
  UnitType,
} from "@shared/types";
import { SKILLS, SKILL_ORDER, levelForXp } from "@shared/progression";

export interface Toast {
  id: number;
  kind: "info" | "success" | "warn";
  text: string;
}

interface GameStore {
  token: string | null;
  user: AuthUser | null;
  snapshot: GameSnapshot | null;
  connected: boolean;
  toasts: Toast[];
  // a battle to spectate in-world (your own invasions auto-open), or null
  pendingBattle: BattleReport | null;
  clearPendingBattle: () => void;
  watchBattle: (report: BattleReport) => void;
  // request to fly the Adventure camera + hero to the nearest source of a resource
  locateRequest: { kind: ResourceKind; n: number } | null;
  locate: (kind: ResourceKind) => void;
  // an empire the player asked to invade from the Empires page; the Attack tab
  // opens with this target preselected, then clears it.
  invadeTarget: string | null;
  requestInvade: (empireId: string) => void;
  clearInvade: () => void;

  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  connect: () => void;
  disconnect: () => void;

  build: (type: BuildingType, wx?: number, wy?: number) => void;
  upgrade: (buildingId: string) => void;
  demolish: (buildingId: string) => void;
  train: (building: BuildingType, unit: UnitType, quantity: number) => void;
  advanceAge: () => void;
  attack: (targetEmpireId: string, units: Partial<Record<UnitType, number>>) => void;
  attackBoss: (units: Partial<Record<UnitType, number>>) => void;
  createDuel: (stake: number, units: Partial<Record<UnitType, number>>) => void;
  acceptDuel: (duelId: string, units: Partial<Record<UnitType, number>>) => void;
  cancelDuel: (duelId: string) => void;
  joinTournament: () => void;
  leaveTournament: () => void;
  rush: (kind: "building" | "age" | "train", id?: string) => void;
  claimQuest: (questId: string) => void;
  gather: (resource: ResourceKind) => void;
  upgradeTool: (tool: ToolId) => void;
  slay: (kind: string) => void;
  buyArmoury: (kind: "weapon" | "armour" | "helmet" | "heroArmour", unit?: UnitType) => void;
  buyTrait: (traitId: string) => void;

  createAlliance: (name: string, tag: string) => void;
  joinAlliance: (allianceId: string) => void;
  leaveAlliance: () => void;
  kickAllianceMember: (targetId: string) => void;
  disbandAlliance: () => void;
  allianceChat: (text: string) => void;

  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
}

let socket: Socket | null = null;
let toastSeq = 1;

const LS_TOKEN = "ee_token";
const LS_USER = "ee_user";

function loadAuth(): { token: string | null; user: AuthUser | null } {
  try {
    const token = localStorage.getItem(LS_TOKEN);
    const userRaw = localStorage.getItem(LS_USER);
    return { token, user: userRaw ? (JSON.parse(userRaw) as AuthUser) : null };
  } catch {
    return { token: null, user: null };
  }
}

export const useGame = create<GameStore>((set, get) => ({
  ...loadAuth(),
  snapshot: null,
  connected: false,
  toasts: [],
  pendingBattle: null,
  clearPendingBattle: () => set({ pendingBattle: null }),
  watchBattle: (report) => set({ pendingBattle: report }),
  locateRequest: null,
  locate: (kind) => set((s) => ({ locateRequest: { kind, n: (s.locateRequest?.n ?? 0) + 1 } })),
  invadeTarget: null,
  requestInvade: (empireId) => set({ invadeTarget: empireId }),
  clearInvade: () => set({ invadeTarget: null }),

  setAuth: (token, user) => {
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER, JSON.stringify(user));
    set({ token, user });
    get().connect();
  },

  logout: () => {
    get().disconnect();
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
    set({ token: null, user: null, snapshot: null });
  },

  connect: () => {
    const { token } = get();
    if (!token) return;
    // idempotent: if a socket already exists just (re)authenticate it rather
    // than tearing it down and rebuilding (avoids a double-connect on mount).
    if (socket) {
      if (socket.connected) socket.emit("hello", token);
      return;
    }
    socket = io(SERVER_URL || "/", {
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    socket.on("connect", () => {
      set({ connected: true });
      const t = get().token;
      if (t) socket?.emit("hello", t);
    });
    socket.on("disconnect", () => set({ connected: false }));
    socket.on("snapshot", (snap: GameSnapshot) => {
      // surface skill level-ups as toasts
      const prev = get().snapshot;
      if (prev?.empire?.hero && snap?.empire?.hero) {
        for (const s of SKILL_ORDER) {
          const a = levelForXp(prev.empire.hero.skills[s] ?? 0);
          const b = levelForXp(snap.empire.hero.skills[s] ?? 0);
          if (b > a) get().pushToast({ kind: "success", text: `${SKILLS[s].icon} ${SKILLS[s].name} level ${b}!` });
        }
      }
      // notify on a freshly resolved battle (watch it back in the Chronicle)
      const newBat = snap?.empire?.battles?.[0];
      if (prev && newBat && newBat.id !== prev.empire?.battles?.[0]?.id) {
        const youWon = newBat.role === "attacker" ? newBat.attackerWon : !newBat.attackerWon;
        const foe = newBat.role === "attacker" ? newBat.defenderName : newBat.attackerName;
        get().pushToast({
          kind: youWon ? "success" : "warn",
          text: `⚔ ${youWon ? "Victory" : "Battle"} vs ${foe} — watch it back in the Chronicle`,
        });
        // auto-spectate YOUR OWN invasions in-world; defences just toast
        if (newBat.role === "attacker" && !get().pendingBattle) set({ pendingBattle: newBat });
      }
      set({ snapshot: snap });
    });
    socket.on("toast", (t: { kind: Toast["kind"]; text: string }) =>
      get().pushToast(t),
    );
    socket.on("error", (msg: string) => get().pushToast({ kind: "warn", text: msg }));
    // server rejected our token (world reset / expired) — clear it and bounce
    // back to the login screen instead of leaving the UI stuck.
    socket.on("unauthorized", () => {
      get().pushToast({ kind: "warn", text: "Your session expired — please log in again." });
      get().logout();
    });
  },

  disconnect: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    set({ connected: false });
  },

  build: (type, wx, wy) => socket?.emit("build", { type, wx, wy }),
  upgrade: (buildingId) => socket?.emit("upgrade", { buildingId }),
  demolish: (buildingId) => socket?.emit("demolish", { buildingId }),
  train: (building, unit, quantity) => socket?.emit("train", { building, unit, quantity }),
  advanceAge: () => socket?.emit("advanceAge"),
  attack: (targetEmpireId, units) => socket?.emit("attack", { targetEmpireId, units }),
  attackBoss: (units) => socket?.emit("attackBoss", { units }),
  createDuel: (stake, units) => socket?.emit("duel:create", { stake, units }),
  acceptDuel: (duelId, units) => socket?.emit("duel:accept", { duelId, units }),
  cancelDuel: (duelId) => socket?.emit("duel:cancel", { duelId }),
  joinTournament: () => socket?.emit("tournament:join"),
  leaveTournament: () => socket?.emit("tournament:leave"),
  rush: (kind, id) => socket?.emit("rush", { kind, id }),
  claimQuest: (questId) => socket?.emit("claimQuest", { questId }),
  gather: (resource) => socket?.emit("gather", { resource }),
  upgradeTool: (tool) => socket?.emit("upgradeTool", { tool }),
  slay: (kind) => socket?.emit("slay", { kind }),
  buyArmoury: (kind, unit) => socket?.emit("buyArmoury", { kind, unit }),
  buyTrait: (traitId) => socket?.emit("buyTrait", { traitId }),
  createAlliance: (name, tag) => socket?.emit("alliance:create", { name, tag }),
  joinAlliance: (allianceId) => socket?.emit("alliance:join", { allianceId }),
  leaveAlliance: () => socket?.emit("alliance:leave"),
  kickAllianceMember: (targetId) => socket?.emit("alliance:kick", { targetId }),
  disbandAlliance: () => socket?.emit("alliance:disband"),
  allianceChat: (text) => socket?.emit("alliance:chat", { text }),

  pushToast: (t) => {
    const id = toastSeq++;
    set({ toasts: [...get().toasts, { ...t, id }] });
    setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));
