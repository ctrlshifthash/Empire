import { useEffect, useRef, useState } from "react";
import { useGame } from "../lib/store";

const fmtTime = (at: number) => {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// The social hub: a shared chat lobby every player lands in before entering their
// world. Chat with everyone online, see who's here, then head into your realm.
export default function HubView({ onEnter }: { onEnter: () => void }) {
  const messages = useGame((s) => s.hubMessages);
  const online = useGame((s) => s.hubOnline);
  const hubChat = useGame((s) => s.hubChat);
  const myName = useGame((s) => s.snapshot?.empire?.name);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // keep the chat pinned to the newest message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    hubChat(t);
    setText("");
  };

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3">
        <div>
          <div className="font-display text-xl font-bold text-gold-gradient">🏰 The Hub</div>
          <p className="text-sm text-parchment-300/70">
            Meet every ruler online, trade tips and talk strategy — then march into your realm.
          </p>
        </div>
        <button className="btn-gold" onClick={onEnter}>
          Enter your world ⚔
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* chat */}
        <div className="lg:col-span-2">
          <div className="panel flex h-[28rem] flex-col p-0">
            <div className="border-b border-parchment-300/10 px-4 py-2.5 text-sm font-semibold text-parchment-200">
              💬 Hub chat
            </div>
            <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center text-center text-sm text-parchment-300/50">
                  No messages yet — say hello to the realm.
                </div>
              )}
              {messages.map((m) => {
                const mine = m.fromName === myName;
                return (
                  <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-1.5 text-[11px] text-parchment-300/55">
                      <span className="h-2 w-2 rounded-full" style={{ background: m.banner }} />
                      <span className="font-semibold text-parchment-200">{mine ? "You" : m.fromName}</span>
                      <span>{fmtTime(m.at)}</span>
                    </div>
                    <div
                      className={`mt-0.5 max-w-[80%] break-words rounded-lg px-3 py-1.5 text-sm ${
                        mine ? "bg-gold/15 text-parchment-50" : "bg-black/30 text-parchment-100"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 border-t border-parchment-300/10 p-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                maxLength={240}
                placeholder="Message the realm…"
                className="flex-1 rounded-lg border border-parchment-300/15 bg-black/30 px-3 py-2 text-sm focus:border-gold/40 focus:outline-none"
              />
              <button className="btn-gold btn-sm" disabled={!text.trim()} onClick={send}>
                Send
              </button>
            </div>
          </div>
        </div>

        {/* online players */}
        <div>
          <div className="panel flex h-[28rem] flex-col p-0">
            <div className="border-b border-parchment-300/10 px-4 py-2.5 text-sm font-semibold text-parchment-200">
              🟢 In the hub <span className="text-parchment-300/50">({online.length})</span>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
              {online.length === 0 && (
                <div className="px-2 py-4 text-center text-sm text-parchment-300/50">Just you for now.</div>
              )}
              {online.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-black/20">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.banner }} />
                  <span className="min-w-0 flex-1 truncate text-sm text-parchment-100">
                    {p.name}
                    {p.name === myName && <span className="text-parchment-300/50"> (you)</span>}
                  </span>
                  <span className="shrink-0 text-[11px] text-gold-light/80">{p.rank}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
