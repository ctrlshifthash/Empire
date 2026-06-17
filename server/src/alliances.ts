// ─────────────────────────────────────────────────────────────────────────────
// Alliances. Players band together: allies can't raid one another, share a tag
// and a chat, and compete on an alliance leaderboard. All state lives in
// state.alliances; each Empire carries its allianceId. Mutating calls return the
// set of member empire ids whose snapshot should be re-pushed.
// ─────────────────────────────────────────────────────────────────────────────
import {
  ALLIANCE_MAX_MEMBERS,
  ALLIANCE_CREATE_COST,
  ALLIANCE_NAME_MAX,
  ALLIANCE_TAG_MAX,
  ALLIANCE_CHAT_KEEP,
  ALLIANCE_MSG_MAX,
  rankForPower,
} from "../../shared/gamedata.ts";
import type { Alliance, AlliancePublic, Empire } from "../../shared/types.ts";
import { state, scheduleSave } from "./store.ts";
import { isOnline } from "./presence.ts";
import { now, uid } from "./util.ts";

export interface AllianceResult {
  ok: boolean;
  error?: string;
  allianceId?: string;
  members?: string[]; // empire ids to refresh
}

export function areAllies(a: Empire, b: Empire): boolean {
  return !!a.allianceId && a.allianceId === b.allianceId;
}

function pushSystem(alliance: Alliance, text: string): void {
  alliance.chat.push({ id: uid("msg_"), from: "system", fromName: "", text, at: now() });
  if (alliance.chat.length > ALLIANCE_CHAT_KEEP) alliance.chat.splice(0, alliance.chat.length - ALLIANCE_CHAT_KEEP);
}

export function createAlliance(empire: Empire, rawName: string, rawTag: string): AllianceResult {
  if (empire.allianceId) return { ok: false, error: "Leave your current alliance first." };
  const name = String(rawName ?? "").trim().slice(0, ALLIANCE_NAME_MAX);
  const tag = String(rawTag ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ALLIANCE_TAG_MAX);
  if (name.length < 3) return { ok: false, error: "Name must be at least 3 characters." };
  if (tag.length < 2) return { ok: false, error: "Tag must be 2–5 letters/numbers." };
  if (Object.values(state.alliances).some((a) => a.tag === tag))
    return { ok: false, error: `Tag [${tag}] is already taken.` };
  if (empire.coins < ALLIANCE_CREATE_COST) return { ok: false, error: `Founding an alliance costs ${ALLIANCE_CREATE_COST} coins.` };

  empire.coins -= ALLIANCE_CREATE_COST;
  const alliance: Alliance = {
    id: uid("ally_"),
    name,
    tag,
    banner: empire.banner,
    leaderId: empire.id,
    memberIds: [empire.id],
    createdAt: now(),
    chat: [],
  };
  pushSystem(alliance, `${empire.name} founded the alliance.`);
  state.alliances[alliance.id] = alliance;
  empire.allianceId = alliance.id;
  scheduleSave(0);
  return { ok: true, allianceId: alliance.id, members: [empire.id] };
}

export function joinAlliance(empire: Empire, allianceId: string): AllianceResult {
  if (empire.allianceId) return { ok: false, error: "Leave your current alliance first." };
  const alliance = state.alliances[allianceId];
  if (!alliance) return { ok: false, error: "That alliance no longer exists." };
  if (alliance.memberIds.length >= ALLIANCE_MAX_MEMBERS) return { ok: false, error: "That alliance is full." };
  alliance.memberIds.push(empire.id);
  empire.allianceId = alliance.id;
  pushSystem(alliance, `${empire.name} joined.`);
  scheduleSave(0);
  return { ok: true, members: [...alliance.memberIds] };
}

export function leaveAlliance(empire: Empire): AllianceResult {
  const alliance = empire.allianceId ? state.alliances[empire.allianceId] : undefined;
  if (!alliance) return { ok: false, error: "You're not in an alliance." };
  const affected = [...alliance.memberIds];
  alliance.memberIds = alliance.memberIds.filter((id) => id !== empire.id);
  empire.allianceId = undefined;
  pushSystem(alliance, `${empire.name} left.`);
  if (alliance.memberIds.length === 0) {
    delete state.alliances[alliance.id];
  } else if (alliance.leaderId === empire.id) {
    // promote the strongest remaining member to leader
    alliance.leaderId = [...alliance.memberIds].sort(
      (a, b) => (state.empires[b]?.power ?? 0) - (state.empires[a]?.power ?? 0),
    )[0];
    const lead = state.empires[alliance.leaderId];
    if (lead) pushSystem(alliance, `${lead.name} is now the leader.`);
  }
  scheduleSave(0);
  return { ok: true, members: affected };
}

export function kickMember(leader: Empire, targetId: string): AllianceResult {
  const alliance = leader.allianceId ? state.alliances[leader.allianceId] : undefined;
  if (!alliance) return { ok: false, error: "You're not in an alliance." };
  if (alliance.leaderId !== leader.id) return { ok: false, error: "Only the leader can remove members." };
  if (targetId === leader.id) return { ok: false, error: "You can't kick yourself — disband instead." };
  if (!alliance.memberIds.includes(targetId)) return { ok: false, error: "They're not in your alliance." };
  const affected = [...alliance.memberIds];
  alliance.memberIds = alliance.memberIds.filter((id) => id !== targetId);
  const target = state.empires[targetId];
  if (target) target.allianceId = undefined;
  pushSystem(alliance, `${target?.name ?? "A member"} was removed.`);
  scheduleSave(0);
  return { ok: true, members: affected };
}

export function disbandAlliance(leader: Empire): AllianceResult {
  const alliance = leader.allianceId ? state.alliances[leader.allianceId] : undefined;
  if (!alliance) return { ok: false, error: "You're not in an alliance." };
  if (alliance.leaderId !== leader.id) return { ok: false, error: "Only the leader can disband." };
  const affected = [...alliance.memberIds];
  for (const id of alliance.memberIds) {
    const e = state.empires[id];
    if (e) e.allianceId = undefined;
  }
  delete state.alliances[alliance.id];
  scheduleSave(0);
  return { ok: true, members: affected };
}

export function postChat(empire: Empire, rawText: string): AllianceResult {
  const alliance = empire.allianceId ? state.alliances[empire.allianceId] : undefined;
  if (!alliance) return { ok: false, error: "You're not in an alliance." };
  const text = String(rawText ?? "").trim().slice(0, ALLIANCE_MSG_MAX);
  if (!text) return { ok: false, error: "Empty message." };
  alliance.chat.push({ id: uid("msg_"), from: empire.id, fromName: empire.name, text, at: now() });
  if (alliance.chat.length > ALLIANCE_CHAT_KEEP) alliance.chat.splice(0, alliance.chat.length - ALLIANCE_CHAT_KEEP);
  scheduleSave();
  return { ok: true, members: [...alliance.memberIds] };
}

export function alliancePublic(allianceId: string | undefined): AlliancePublic | null {
  if (!allianceId) return null;
  const a = state.alliances[allianceId];
  if (!a) return null;
  const members = a.memberIds
    .map((id) => state.empires[id])
    .filter((e): e is Empire => !!e)
    .map((e) => ({
      id: e.id,
      name: e.name,
      power: e.power,
      rank: rankForPower(e.power).name,
      online: isOnline(e.id),
      leader: e.id === a.leaderId,
    }))
    .sort((x, y) => y.power - x.power);
  return {
    id: a.id,
    name: a.name,
    tag: a.tag,
    banner: a.banner,
    leaderId: a.leaderId,
    members,
    memberCount: members.length,
    totalPower: members.reduce((s, m) => s + m.power, 0),
    createdAt: a.createdAt,
    chat: a.chat,
  };
}

export function allianceLeaderboard(): AlliancePublic[] {
  return Object.keys(state.alliances)
    .map((id) => alliancePublic(id))
    .filter((a): a is AlliancePublic => !!a)
    .sort((a, b) => b.totalPower - a.totalPower);
}
