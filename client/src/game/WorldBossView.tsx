import { useState } from "react";
import type { Empire } from "@shared/types";
import { UNITS, UNIT_TYPES } from "@shared/gamedata";
import { useGame } from "../lib/store";
import { fmt } from "../lib/format";

export default function WorldBossView({ empire }: { empire: Empire }) {
  const boss = useGame((s) => s.snapshot?.boss ?? null);
  const attackBoss = useGame((s) => s.attackBoss);
  const [units, setUnits] = useState<Partial<Record<(typeof UNIT_TYPES)[number], number>>>({});

  if (!boss) {
    return (
      <div className="panel p-8 text-center text-sm text-parchment-300/60">The world is quiet… no boss has risen yet.</div>
    );
  }

  const pct = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));
  const onCooldown = boss.yourCooldownMs > 0;
  const total = UNIT_TYPES.reduce((s, u) => s + (units[u] ?? 0), 0);
  const setUnit = (u: (typeof UNIT_TYPES)[number], v: number) =>
    setUnits((p) => ({ ...p, [u]: Math.max(0, Math.min(empire.army[u] ?? 0, v)) }));

  // slain → respawn countdown
  if (boss.status === "slain") {
    const secs = boss.respawnAt ? Math.max(0, Math.ceil((boss.respawnAt - Date.now()) / 1000)) : 0;
    return (
      <div className="panel p-8 text-center">
        <div className="text-4xl">💀</div>
        <div className="mt-2 font-display text-xl font-bold text-gold-gradient">{boss.name} has been slain</div>
        {boss.slayerName && <div className="mt-1 text-sm text-parchment-300/70">Killing blow by {boss.slayerName}</div>}
        <div className="mt-4 text-sm text-parchment-300/60">
          A mightier foe rises in <span className="font-semibold text-gold-light">{Math.floor(secs / 60)}m {secs % 60}s</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* boss + strike */}
      <div className="space-y-4 lg:col-span-3">
        <div className="panel overflow-hidden p-0">
          <div className="bg-gradient-to-br from-blood/30 to-ink-800 p-5">
            <div className="flex items-center gap-3">
              <span className="text-4xl">👹</span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-xl font-bold text-parchment-100">{boss.name}</div>
                <div className="text-xs uppercase tracking-wider text-blood-light">Tier {boss.tier} · World Boss</div>
              </div>
              <div className="text-right text-xs text-parchment-300/60">
                {boss.totalContributors} {boss.totalContributors === 1 ? "challenger" : "challengers"}
              </div>
            </div>
            {/* HP bar */}
            <div className="mt-4">
              <div className="h-5 overflow-hidden rounded-full bg-black/40 ring-1 ring-black/50">
                <div className="h-full rounded-full bg-gradient-to-r from-blood to-blood-light transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-xs text-parchment-300/70">
                <span>{fmt(boss.hp)} / {fmt(boss.maxHp)} HP</span>
                <span>{pct.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="panel p-4">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="font-display text-base font-semibold">⚔ Commit your army</span>
            <span className="text-[11px] text-parchment-300/50">~18% of sent troops are lost</span>
          </div>
          <div className="space-y-2">
            {UNIT_TYPES.map((u) => {
              const have = empire.army[u] ?? 0;
              return (
                <div key={u} className="flex items-center gap-3 rounded-lg border border-parchment-300/10 bg-black/20 px-3 py-2">
                  <span className="text-lg">{UNITS[u].icon}</span>
                  <div className="flex-1 text-sm">
                    <span className="font-medium">{UNITS[u].name}</span>
                    <span className="ml-1 text-parchment-300/50">({have})</span>
                  </div>
                  <div className="flex items-center rounded-lg border border-parchment-300/15 bg-black/30">
                    <button className="px-2 py-1 text-parchment-300/70 hover:text-gold-light" onClick={() => setUnit(u, (units[u] ?? 0) - 1)}>−</button>
                    <input
                      value={units[u] ?? 0}
                      onChange={(e) => setUnit(u, parseInt(e.target.value) || 0)}
                      className="w-12 bg-transparent text-center text-sm font-semibold focus:outline-none"
                    />
                    <button className="px-2 py-1 text-parchment-300/70 hover:text-gold-light" onClick={() => setUnit(u, (units[u] ?? 0) + 1)}>+</button>
                  </div>
                  <button className="chip py-0.5 text-[10px] hover:border-gold/40" disabled={have === 0} onClick={() => setUnit(u, have)}>
                    All
                  </button>
                </div>
              );
            })}
          </div>
          <button
            className="btn-blood mt-4 w-full py-2.5"
            disabled={total === 0 || onCooldown}
            onClick={() => {
              attackBoss(units);
              setUnits({});
            }}
          >
            {onCooldown
              ? `Regrouping… ${Math.ceil(boss.yourCooldownMs / 1000)}s`
              : `🗡 Strike (${total} unit${total === 1 ? "" : "s"})`}
          </button>
        </div>
      </div>

      {/* damage leaderboard */}
      <div className="lg:col-span-2">
        <div className="panel p-4">
          <div className="mb-2 px-1 font-display text-base font-semibold">🏆 Top damage</div>
          {boss.topDamage.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-parchment-300/55">No one has struck yet. Be the first — biggest hitter earns a bonus cut.</div>
          ) : (
            <div className="space-y-1">
              {boss.topDamage.map((d, i) => (
                <div key={d.name + i} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
                  <span className={`w-5 font-display text-sm font-bold ${i === 0 ? "text-gold-light" : "text-parchment-300/50"}`}>{i + 1}</span>
                  <span className="h-6 w-6 shrink-0 rounded-md ring-1 ring-black/40" style={{ background: d.banner }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.name}</span>
                  <span className="text-sm font-semibold text-blood-light">{fmt(d.damage)}</span>
                </div>
              ))}
            </div>
          )}
          {boss.yourDamage > 0 && (
            <div className="mt-3 rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-sm">
              Your damage: <span className="font-semibold text-gold-light">{fmt(boss.yourDamage)}</span>
            </div>
          )}
          <p className="mt-3 px-1 text-[11px] text-parchment-300/45">
            When the boss falls, coins &amp; resources are split by damage dealt — top damage earns a bonus. (In-game spoils only.)
          </p>
        </div>
      </div>
    </div>
  );
}
