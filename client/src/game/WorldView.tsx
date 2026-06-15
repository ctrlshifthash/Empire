import { useEffect, useMemo, useState } from "react";
import type { GameSnapshot, UnitType } from "@shared/types";
import { UNITS, UNIT_TYPES } from "@shared/gamedata";
import { AGE_META, fmt, fmtTime } from "../lib/format";
import { useGame } from "../lib/store";
import WorldCanvas, { type MarchLine } from "./WorldCanvas";
import type { WorldMarker } from "./renderer";

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.round(Math.hypot(ax - bx, ay - by));
}
function travelSeconds(d: number): number {
  return Math.max(6, Math.min(40, 6 + d * 2));
}

export default function WorldView({ snapshot }: { snapshot: GameSnapshot }) {
  const { empire, world, others, outgoingMarches, incomingMarches } = snapshot;
  const attack = useGame((s) => s.attack);
  const pushToast = useGame((s) => s.pushToast);
  const invadeTarget = useGame((s) => s.invadeTarget);
  const clearInvade = useGame((s) => s.clearInvade);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // preselect a target requested from the Empires page (then consume it)
  useEffect(() => {
    if (invadeTarget && others.some((o) => o.id === invadeTarget)) {
      setSelectedId(invadeTarget);
      clearInvade();
    } else if (invadeTarget) {
      clearInvade();
    }
  }, [invadeTarget, others, clearInvade]);

  const markers: WorldMarker[] = useMemo(() => {
    const self: WorldMarker = {
      id: empire.id,
      x: empire.tileX,
      y: empire.tileY,
      banner: empire.banner,
      isBot: false,
      online: true,
      power: empire.power,
      name: empire.name,
      self: true,
    };
    const rest = others.map((o) => ({
      id: o.id,
      x: o.tileX,
      y: o.tileY,
      banner: o.banner,
      isBot: o.isBot,
      online: o.online,
      power: o.power,
      name: o.name,
      self: false,
      rank: o.rank,
      armySize: o.armySize,
      age: o.age,
    }));
    return [self, ...rest];
  }, [empire, others]);

  const coord = useMemo(() => {
    const m = new Map<string, WorldMarker>();
    for (const k of markers) m.set(k.id, k);
    return m;
  }, [markers]);

  const marchLines: MarchLine[] = useMemo(() => {
    const now = Date.now();
    const all = [...outgoingMarches, ...incomingMarches];
    const seen = new Set<string>();
    const lines: MarchLine[] = [];
    for (const mar of all) {
      if (seen.has(mar.id)) continue;
      seen.add(mar.id);
      const from = coord.get(mar.fromEmpireId);
      const to = coord.get(mar.toEmpireId);
      if (!from || !to) continue;
      const progress = Math.min(1, Math.max(0, (now - mar.departsAt) / (mar.arrivesAt - mar.departsAt)));
      lines.push({
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        progress: mar.kind === "return" ? 1 - progress : progress,
        attack: mar.kind === "attack",
      });
    }
    return lines;
  }, [outgoingMarches, incomingMarches, coord]);

  const rivals = useMemo(
    () =>
      others
        .map((o) => ({ ...o, d: dist(empire.tileX, empire.tileY, o.tileX, o.tileY) }))
        .sort((a, b) => a.d - b.d),
    [others, empire.tileX, empire.tileY],
  );

  const selected = selectedId ? coord.get(selectedId) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="panel relative h-[340px] overflow-hidden sm:h-[460px]">
          <div className="pointer-events-none absolute left-3 top-3 z-10 chip">
            🗺️ World map · {world.width}×{world.height}
          </div>
          <WorldCanvas
            world={world}
            markers={markers}
            marches={marchLines}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-center text-xs text-parchment-300/50">
            Gold ring = you · Click any empire to scout & raid
          </div>
        </div>

        {/* incoming raid warning */}
        {incomingMarches.length > 0 && (
          <div className="mt-3 rounded-xl border border-blood-light/40 bg-blood/15 p-3">
            <div className="flex items-center gap-2 font-semibold text-blood-light">
              ⚠️ Incoming attack{incomingMarches.length > 1 ? "s" : ""}!
            </div>
            <div className="mt-1 space-y-1 text-sm text-parchment-200">
              {incomingMarches.map((m) => (
                <div key={m.id} className="flex items-center justify-between">
                  <span>{m.fromName} is marching on you</span>
                  <span className="font-medium text-blood-light">
                    {fmtTime((m.arrivesAt - Date.now()) / 1000)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* side: selected target or rivals list */}
      <div className="lg:col-span-2">
        {selected && !selected.self ? (
          <TargetPanel
            target={selected}
            empire={empire}
            distance={dist(empire.tileX, empire.tileY, selected.x, selected.y)}
            onClose={() => setSelectedId(null)}
            onAttack={(units) => {
              attack(selected.id, units);
              const eta = travelSeconds(dist(empire.tileX, empire.tileY, selected.x, selected.y));
              pushToast({
                kind: "info",
                text: `⚔ Your army marches on ${selected.name} — the live battle opens in ~${eta}s.`,
              });
              setSelectedId(null);
            }}
          />
        ) : selected?.self ? (
          <div className="panel p-5 text-sm text-parchment-300/75">
            <div className="font-display text-base font-semibold text-parchment-100">{empire.name}</div>
            This is your empire. Select a rival to plan a raid.
          </div>
        ) : (
          <div className="panel p-4">
            <div className="mb-2 px-1 font-display text-base font-semibold">
              🗡️ Pick an empire to invade
            </div>
            <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
              {rivals.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-gold/25 hover:bg-white/5"
                >
                  <span
                    className="h-7 w-7 shrink-0 rounded-md ring-1 ring-black/40"
                    style={{ background: r.banner }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {r.name} {r.online && !r.isBot && <span className="text-emerald-400">●</span>}
                    </div>
                    <div className="text-xs text-parchment-300/55">
                      {AGE_META[r.age].short} · {r.isBot ? (r.rank ?? "AI") : "Ruler"} · {r.d} tiles
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gold-light">{fmt(r.power)}</div>
                    <div className="text-[10px] text-parchment-300/50">⚔ {r.armySize}</div>
                  </div>
                  <span className="shrink-0 rounded-md bg-blood/30 px-2 py-1 text-[11px] font-semibold text-blood-light">
                    Invade →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TargetPanel({
  target,
  empire,
  distance,
  onAttack,
  onClose,
}: {
  target: WorldMarker;
  empire: GameSnapshot["empire"];
  distance: number;
  onAttack: (units: Partial<Record<UnitType, number>>) => void;
  onClose: () => void;
}) {
  const [units, setUnits] = useState<Partial<Record<UnitType, number>>>({});
  const total = UNIT_TYPES.reduce((s, u) => s + (units[u] ?? 0), 0);
  const eta = travelSeconds(distance);

  const setUnit = (u: UnitType, v: number) =>
    setUnits((prev) => ({ ...prev, [u]: Math.max(0, Math.min(empire.army[u], v)) }));

  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="h-8 w-8 rounded-md ring-1 ring-black/40" style={{ background: target.banner }} />
          <div>
            <div className="font-display text-lg font-bold text-parchment-100">{target.name}</div>
            <div className="text-xs text-parchment-300/55">
              {target.isBot ? "AI empire" : "Rival ruler"}
              {target.age ? ` · ${AGE_META[target.age as keyof typeof AGE_META].short}` : ""} · {distance} tiles away
            </div>
          </div>
        </div>
        <button className="text-parchment-300/50 hover:text-parchment-100" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-black/25 px-3 py-2">
          <div className="text-xs text-parchment-300/55">🏅 Rank</div>
          <div className="font-semibold text-gold-light">{target.rank ?? (target.isBot ? "AI" : "Ruler")}</div>
        </div>
        <div className="rounded-lg bg-black/25 px-3 py-2">
          <div className="text-xs text-parchment-300/55">⚡ Power</div>
          <div className="font-semibold text-gold-light">{fmt(target.power)}</div>
        </div>
        <div className="rounded-lg bg-black/25 px-3 py-2">
          <div className="text-xs text-parchment-300/55">⚔ Their army</div>
          <div className="font-semibold">{target.armySize != null ? `${target.armySize} units` : "—"}</div>
        </div>
        <div className="rounded-lg bg-black/25 px-3 py-2">
          <div className="text-xs text-parchment-300/55">🕑 March time</div>
          <div className="font-semibold">{fmtTime(eta)}</div>
        </div>
      </div>

      {/* strength verdict: your power vs theirs */}
      {(() => {
        const ratio = target.power > 0 ? empire.power / target.power : 2;
        const cls =
          ratio >= 1.1
            ? "bg-emerald-500/15 text-emerald-300"
            : ratio >= 0.9
              ? "bg-gold/15 text-gold-light"
              : "bg-blood/15 text-blood-light";
        const msg =
          ratio >= 1.1
            ? "✅ You outmatch them — a favourable raid"
            : ratio >= 0.9
              ? "⚖️ Evenly matched — send your best troops"
              : "⚠️ They're stronger than you — risky";
        return (
          <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold ${cls}`}>
            {msg}
            <span className="ml-1 font-normal opacity-70">
              (you {fmt(empire.power)} vs them {fmt(target.power)})
            </span>
          </div>
        );
      })()}

      <div className="mt-3 rounded-lg border border-gold/20 bg-gold/5 p-2.5 text-xs leading-relaxed text-parchment-200">
        <div className="mb-0.5 font-semibold text-gold-light">⚔ Spoils of invasion</div>
        Win to <strong>plunder their resources</strong> and earn <strong>Combat XP</strong> + coins. A{" "}
        <strong>decisive</strong> victory <strong>razes one of their buildings</strong>, cutting their power and
        lifting you up the leaderboard.
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-parchment-300/60">
          Choose your raiding force
        </div>
        <div className="space-y-2">
          {UNIT_TYPES.map((u) => {
            const have = empire.army[u];
            return (
              <div key={u} className="flex items-center gap-3">
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
                    className="w-10 bg-transparent text-center text-sm font-semibold focus:outline-none"
                  />
                  <button className="px-2 py-1 text-parchment-300/70 hover:text-gold-light" onClick={() => setUnit(u, (units[u] ?? 0) + 1)}>+</button>
                </div>
                <button
                  className="chip py-0.5 text-[10px] hover:border-gold/40"
                  onClick={() => setUnit(u, have)}
                  disabled={have === 0}
                >
                  All
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <button
        className="btn-blood mt-4 w-full py-2.5"
        disabled={total === 0}
        onClick={() => onAttack(units)}
      >
        ⚔ Invade {target.name} ({total} unit{total === 1 ? "" : "s"})
      </button>
      <p className="mt-2 text-center text-[11px] text-parchment-300/45">
        Survivors return home with any plunder. Villagers fight poorly — send soldiers.
      </p>
    </div>
  );
}
