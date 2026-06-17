import { useEffect, useRef, useState } from "react";
import type { Empire, AlliancePublic } from "@shared/types";
import {
  ALLIANCE_MAX_MEMBERS,
  ALLIANCE_CREATE_COST,
  ALLIANCE_NAME_MAX,
  ALLIANCE_TAG_MAX,
} from "@shared/gamedata";
import { useGame } from "../lib/store";
import { SERVER_URL } from "../lib/config";
import { fmt } from "../lib/format";

type AllianceRow = Omit<AlliancePublic, "chat">;

export default function AllianceView({ empire }: { empire: Empire }) {
  const alliance = useGame((s) => s.snapshot?.alliance ?? null);
  if (alliance) return <MyAlliance alliance={alliance} empire={empire} />;
  return <NoAlliance empire={empire} />;
}

// ── In an alliance ───────────────────────────────────────────────────────────
function MyAlliance({ alliance, empire }: { alliance: AlliancePublic; empire: Empire }) {
  const leaveAlliance = useGame((s) => s.leaveAlliance);
  const disbandAlliance = useGame((s) => s.disbandAlliance);
  const kick = useGame((s) => s.kickAllianceMember);
  const isLeader = alliance.leaderId === empire.id;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div className="panel p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg font-display text-sm font-bold text-ink ring-1 ring-black/40" style={{ background: alliance.banner }}>
              {alliance.tag}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg font-bold text-parchment-100">{alliance.name}</div>
              <div className="text-xs text-parchment-300/55">
                {alliance.memberCount}/{ALLIANCE_MAX_MEMBERS} members · {fmt(alliance.totalPower)} total power
              </div>
            </div>
            <button
              className="btn-ghost btn-sm"
              onClick={() =>
                confirm(isLeader ? "Leave and hand leadership to the next strongest?" : "Leave this alliance?") &&
                leaveAlliance()
              }
            >
              Leave
            </button>
            {isLeader && (
              <button className="btn-ghost btn-sm" onClick={() => confirm("Disband the whole alliance?") && disbandAlliance()}>
                Disband
              </button>
            )}
          </div>
        </div>

        <div className="panel p-4">
          <div className="mb-2 px-1 font-display text-base font-semibold">⚔ Members</div>
          <div className="space-y-1">
            {alliance.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 hover:bg-white/5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${m.online ? "bg-emerald-400" : "bg-parchment-300/25"}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {m.name} {m.leader && <span title="Leader">👑</span>} {m.id === empire.id && <span className="text-parchment-300/45">(you)</span>}
                  </div>
                  <div className="text-xs text-parchment-300/55">{m.rank}</div>
                </div>
                <div className="text-sm font-semibold text-gold-light">{fmt(m.power)}</div>
                {isLeader && m.id !== empire.id && (
                  <button className="chip py-0.5 text-[10px] hover:border-blood/50" onClick={() => kick(m.id)}>
                    Kick
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <AllianceChat chat={alliance.chat} selfId={empire.id} />
      </div>
    </div>
  );
}

function AllianceChat({ chat, selfId }: { chat: AlliancePublic["chat"]; selfId: string }) {
  const send = useGame((s) => s.allianceChat);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat.length]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    send(t);
    setText("");
  };

  return (
    <div className="panel flex h-[420px] flex-col p-4">
      <div className="mb-2 px-1 font-display text-base font-semibold">💬 War Room</div>
      <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {chat.length === 0 && <div className="px-1 text-xs text-parchment-300/45">No messages yet. Rally your allies.</div>}
        {chat.map((m) =>
          m.from === "system" ? (
            <div key={m.id} className="text-center text-[11px] italic text-parchment-300/45">{m.text}</div>
          ) : (
            <div key={m.id} className="text-sm">
              <span className={`font-semibold ${m.from === selfId ? "text-gold-light" : "text-parchment-100"}`}>{m.fromName}: </span>
              <span className="text-parchment-200/90">{m.text}</span>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={240}
          placeholder="Message your alliance…"
          className="flex-1 rounded-lg border border-parchment-300/15 bg-black/30 px-3 py-2 text-sm focus:border-gold/40 focus:outline-none"
        />
        <button className="btn-gold btn-sm" onClick={submit}>Send</button>
      </div>
    </div>
  );
}

// ── Not in an alliance: create or browse ─────────────────────────────────────
function NoAlliance({ empire }: { empire: Empire }) {
  const create = useGame((s) => s.createAlliance);
  const join = useGame((s) => s.joinAlliance);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [list, setList] = useState<AllianceRow[]>([]);

  const refresh = () => {
    fetch(`${SERVER_URL}/api/alliances`)
      .then((r) => r.json())
      .then((d) => d?.ok && setList(d.alliances))
      .catch(() => {});
  };
  useEffect(refresh, []);

  const canAfford = empire.coins >= ALLIANCE_CREATE_COST;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="panel p-5">
        <div className="font-display text-base font-semibold">🛡 Found an alliance</div>
        <p className="mt-1 text-sm text-parchment-300/65">
          Rally other rulers. Allies can't raid each other and climb the alliance leaderboard together.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-parchment-300/55">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={ALLIANCE_NAME_MAX}
              placeholder="The Dragon Lords"
              className="mt-1 w-full rounded-lg border border-parchment-300/15 bg-black/30 px-3 py-2 text-sm focus:border-gold/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-parchment-300/55">Tag (2–{ALLIANCE_TAG_MAX})</label>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ALLIANCE_TAG_MAX))}
              placeholder="DRGN"
              className="mt-1 w-full rounded-lg border border-parchment-300/15 bg-black/30 px-3 py-2 text-sm font-mono focus:border-gold/40 focus:outline-none"
            />
          </div>
          <button
            className="btn-gold btn-sm w-full justify-center"
            disabled={!canAfford || name.trim().length < 3 || tag.length < 2}
            onClick={() => create(name.trim(), tag)}
          >
            Found alliance · {fmt(ALLIANCE_CREATE_COST)} coins
          </button>
          {!canAfford && <p className="text-center text-[11px] text-blood-light">You need {fmt(ALLIANCE_CREATE_COST)} coins to found one.</p>}
        </div>
      </div>

      <div className="panel p-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="font-display text-base font-semibold">Join an alliance</span>
          <button className="chip py-0.5 text-[10px]" onClick={refresh}>↻ Refresh</button>
        </div>
        <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
          {list.length === 0 && <div className="px-2 py-6 text-center text-sm text-parchment-300/55">No alliances yet — found the first.</div>}
          {list.map((a) => {
            const full = a.memberCount >= ALLIANCE_MAX_MEMBERS;
            return (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 hover:bg-white/5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md font-display text-[11px] font-bold text-ink ring-1 ring-black/40" style={{ background: a.banner }}>
                  {a.tag}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.name}</div>
                  <div className="text-xs text-parchment-300/55">{a.memberCount}/{ALLIANCE_MAX_MEMBERS} · {fmt(a.totalPower)} power</div>
                </div>
                <button className="btn-ghost btn-sm" disabled={full} onClick={() => join(a.id)}>
                  {full ? "Full" : "Join"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
