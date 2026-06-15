import { useState } from "react";
import type { BattleReport, Empire, LogEntry } from "@shared/types";
import { useNow } from "../lib/hooks";
import BattleReplay from "./BattleReplay";

const KIND_ICON: Record<LogEntry["kind"], string> = {
  battle: "⚔️",
  quest: "📜",
  build: "🏗️",
  train: "🛡️",
  raid: "🐎",
  system: "✦",
};

const KIND_COLOR: Record<LogEntry["kind"], string> = {
  battle: "text-blood-light",
  quest: "text-gold-light",
  build: "text-emerald-300",
  train: "text-royal-light",
  raid: "text-orange-300",
  system: "text-parchment-200",
};

function ago(ms: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function LogView({ empire, compact = false }: { empire: Empire; compact?: boolean }) {
  const now = useNow(5000);
  const entries = empire.log;
  const battles = empire.battles ?? [];
  const [replay, setReplay] = useState<BattleReport | null>(null);

  return (
    <div className={compact ? "" : "max-w-2xl"}>
      {!compact && battles.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 font-display text-lg font-semibold">⚔️ Recent battles — watch the replay</h3>
          <div className="space-y-2">
            {battles.map((b) => {
              const youAttacker = b.role === "attacker";
              const youWon = youAttacker ? b.attackerWon : !b.attackerWon;
              const foe = youAttacker ? b.defenderName : b.attackerName;
              return (
                <div
                  key={b.id}
                  className={`flex items-center gap-3 rounded-lg border bg-black/20 px-3 py-2.5 ${
                    youWon ? "border-emerald-500/25" : "border-blood-light/25"
                  }`}
                >
                  <span className="text-xl">{youWon ? "⚑" : "☠"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-parchment-100">
                      {youAttacker ? "Your raid on" : "Defended against"} {foe}
                    </div>
                    <div className={`text-xs ${youWon ? "text-emerald-300" : "text-blood-light"}`}>
                      {youWon ? "Victory" : "Defeat"}
                      {b.razed ? ` · razed ${b.razed}` : ""} · {ago(b.at, now)}
                    </div>
                  </div>
                  <button className="btn-gold btn-sm" onClick={() => setReplay(b)}>
                    ▶ Watch
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!compact && <h3 className="mb-4 font-display text-lg font-semibold">Empire Chronicle</h3>}
      {entries.length === 0 ? (
        <div className="text-sm text-parchment-300/55">No events yet. History awaits.</div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-start gap-3 rounded-lg border border-parchment-300/5 bg-black/20 px-3 py-2"
            >
              <span className="mt-0.5 text-sm">{KIND_ICON[e.kind]}</span>
              <div className="min-w-0 flex-1">
                <div className={`text-sm ${KIND_COLOR[e.kind]}`}>{e.text}</div>
                <div className="text-[10px] text-parchment-300/40">{ago(e.at, now)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {replay && <BattleReplay report={replay} onClose={() => setReplay(null)} />}
    </div>
  );
}
