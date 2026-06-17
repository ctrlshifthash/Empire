import { useMemo, useState } from "react";
import type { BuildingType, Empire } from "@shared/types";
import {
  AGES,
  BUILDING_TYPES,
  BUILDINGS,
  ageAtLeast,
  buildSecondsFor,
  nextAge,
  nextLevelCost,
  productionPerMinute,
  rushCost,
} from "@shared/gamedata";
import { AGE_META, RESOURCE_META, fmtTime } from "../lib/format";
import { useGame } from "../lib/store";
import EmpireCanvas from "./EmpireCanvas";
import { CostBadge, Countdown } from "./ui";
import { isActive } from "./derive";

function canAfford(empire: Empire, cost: Partial<Record<string, number>>): boolean {
  return (["wood", "food", "gold", "stone"] as const).every(
    (k) => empire.resources[k] >= (cost[k] ?? 0),
  );
}

export default function EmpireView({ empire }: { empire: Empire }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const build = useGame((s) => s.build);
  const upgrade = useGame((s) => s.upgrade);
  const demolish = useGame((s) => s.demolish);
  const rush = useGame((s) => s.rush);
  const advanceAge = useGame((s) => s.advanceAge);

  const selected = empire.buildings.find((b) => b.id === selectedId) ?? null;

  const buildable = useMemo(
    () =>
      BUILDING_TYPES.filter((t) => {
        const def = BUILDINGS[t];
        if (def.unique && empire.buildings.some((b) => b.type === t)) return false;
        return true;
      }),
    [empire.buildings],
  );

  const next = nextAge(empire.age);
  const ageResearching = empire.ageUpCompletesAt != null;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* base canvas */}
      <div className="lg:col-span-3">
        <div className="panel relative h-[320px] overflow-hidden sm:h-[420px]">
          <div className="pointer-events-none absolute left-3 top-3 z-10 chip">
            🏰 {empire.name}
          </div>
          <EmpireCanvas empire={empire} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-center text-xs text-parchment-300/50">
            Click a building to inspect & upgrade it
          </div>
        </div>
      </div>

      {/* side panel: selected building + age */}
      <div className="space-y-4 lg:col-span-2">
        {selected ? (
          <SelectedBuilding
            empire={empire}
            buildingId={selected.id}
            onUpgrade={() => upgrade(selected.id)}
            onRush={() => rush("building", selected.id)}
            onDemolish={() => {
              if (confirm("Demolish this building? You'll recover half of what you spent.")) {
                demolish(selected.id);
                setSelectedId(null);
              }
            }}
          />
        ) : (
          <div className="panel p-5 text-sm text-parchment-300/70">
            <div className="mb-1 font-display text-base font-semibold text-parchment-100">
              Your settlement
            </div>
            Select a building on the map to inspect it, or construct a new one below.
          </div>
        )}

        {/* age advancement */}
        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-parchment-300/55">Current age</div>
              <div className="font-display text-lg font-bold" style={{ color: AGE_META[empire.age].color }}>
                {AGES[empire.age].name}
              </div>
            </div>
            <span className="text-3xl">🏛️</span>
          </div>

          {next ? (
            ageResearching ? (
              <div className="mt-4 rounded-lg border border-gold/25 bg-black/25 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Researching {AGES[next].name}…</span>
                  <Countdown to={empire.ageUpCompletesAt!} className="font-semibold text-gold-light" />
                </div>
                <button
                  className="btn-gold btn-sm mt-3 w-full"
                  onClick={() => rush("age")}
                  title="Spend coins to finish instantly"
                >
                  🪙 Rush ({rushCost(Math.max(0, (empire.ageUpCompletesAt! - Date.now()) / 1000))} coins)
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <div className="text-sm text-parchment-300/75">
                  Advance to <strong style={{ color: AGE_META[next].color }}>{AGES[next].name}</strong> to
                  unlock new buildings and units.
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <CostBadge cost={AGES[next].cost} have={empire.resources} />
                  <span className="text-xs text-parchment-300/55">⏱ {fmtTime(AGES[next].researchSeconds)}</span>
                </div>
                <button
                  className="btn-gold btn-sm mt-3 w-full"
                  disabled={!canAfford(empire, AGES[next].cost)}
                  onClick={advanceAge}
                >
                  ⬆ Advance to {AGES[next].name}
                </button>
              </div>
            )
          ) : (
            <div className="mt-4 rounded-lg border border-gold/25 bg-black/20 p-3 text-center text-sm text-gold-light">
              👑 You have reached the Imperial Age — the pinnacle of power.
            </div>
          )}
        </div>
      </div>

      {/* build menu */}
      <div className="lg:col-span-5">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-display text-lg font-semibold">Construct</h3>
          <span className="text-xs text-parchment-300/50">Place new buildings in your settlement</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {buildable.map((t) => {
            const def = BUILDINGS[t];
            const locked = !ageAtLeast(empire.age, def.requiresAge);
            const cost = nextLevelCost(t, 0);
            const affordable = canAfford(empire, cost);
            const count = empire.buildings.filter((b) => b.type === t).length;
            return (
              <div
                key={t}
                className={`rounded-xl border bg-ink-800/60 p-4 transition-colors ${
                  locked ? "border-parchment-300/5 opacity-60" : "border-parchment-300/10 hover:border-gold/25"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{def.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-parchment-100">{def.name}</span>
                      {count > 0 && <span className="chip py-0.5 text-[10px]">×{count}</span>}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-parchment-300/60">{def.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <CostBadge cost={cost} have={empire.resources} />
                  <span className="text-[11px] text-parchment-300/50">⏱ {fmtTime(buildSecondsFor(t, 0))}</span>
                </div>
                {locked ? (
                  <button className="btn-ghost btn-sm mt-3 w-full" disabled>
                    🔒 {AGES[def.requiresAge].name}
                  </button>
                ) : (
                  <button
                    className="btn-gold btn-sm mt-3 w-full"
                    disabled={!affordable}
                    onClick={() => build(t)}
                  >
                    🔨 Build
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SelectedBuilding({
  empire,
  buildingId,
  onUpgrade,
  onRush,
  onDemolish,
}: {
  empire: Empire;
  buildingId: string;
  onUpgrade: () => void;
  onRush: () => void;
  onDemolish: () => void;
}) {
  const b = empire.buildings.find((x) => x.id === buildingId);
  if (!b) return null;
  const def = BUILDINGS[b.type];
  const busy = b.completesAt != null;
  const maxed = b.level >= def.maxLevel;
  const upgradeCost = nextLevelCost(b.type, b.level);
  const affordable = canAfford(empire, upgradeCost);

  return (
    <div className="panel p-5">
      <div className="flex items-start gap-3">
        <span className="text-3xl">{def.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-bold text-parchment-100">{def.name}</span>
            <span className="chip py-0.5 text-[10px]">Lv {b.level}</span>
          </div>
          <p className="mt-1 text-xs text-parchment-300/65">{def.description}</p>
        </div>
      </div>

      {/* current effect */}
      <div className="mt-3 rounded-lg bg-black/25 p-3 text-sm">
        {def.produces && isActive(b) && (
          <div className="flex items-center justify-between">
            <span className="text-parchment-300/70">Producing</span>
            <span className="font-semibold text-emerald-400">
              {RESOURCE_META[def.produces.kind].icon} +{Math.round(productionPerMinute(b.type, b.level))}/min
            </span>
          </div>
        )}
        {def.populationProvided && isActive(b) && (
          <div className="flex items-center justify-between">
            <span className="text-parchment-300/70">Population</span>
            <span className="font-semibold text-parchment-100">+{def.populationProvided}</span>
          </div>
        )}
        {def.trains && (
          <div className="flex items-center justify-between">
            <span className="text-parchment-300/70">Trains</span>
            <span className="font-semibold text-parchment-100">
              {def.trains.map((u) => u).join(", ")}
            </span>
          </div>
        )}
        {!isActive(b) && !busy && (
          <div className="text-parchment-300/60">Newly placed.</div>
        )}
      </div>

      {/* actions */}
      {busy ? (
        <div className="mt-4 rounded-lg border border-gold/25 bg-black/25 p-3">
          <div className="flex items-center justify-between text-sm">
            <span>{b.job === "upgrade" ? "Upgrading…" : "Building…"}</span>
            <Countdown to={b.completesAt!} className="font-semibold text-gold-light" />
          </div>
          <button className="btn-gold btn-sm mt-3 w-full" onClick={onRush}>
            🪙 Rush ({rushCost(Math.max(0, (b.completesAt! - Date.now()) / 1000))} coins)
          </button>
        </div>
      ) : maxed ? (
        <div className="mt-4 rounded-lg bg-black/20 p-2.5 text-center text-sm text-gold-light">
          ★ Maximum level reached
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-parchment-300/70">Upgrade to Lv {b.level + 1}</span>
            <CostBadge cost={upgradeCost} have={empire.resources} />
          </div>
          <button className="btn-gold btn-sm w-full" disabled={!affordable} onClick={onUpgrade}>
            ⬆ Upgrade ({fmtTime(buildSecondsFor(b.type, b.level))})
          </button>
        </div>
      )}

      {/* demolish — the Town Centre is the empire's core and can't be torn down.
          Works mid-construction too, so a mis-placed build can be cancelled. */}
      {b.type !== "town_center" && (
        <button
          className="mt-3 w-full rounded-lg border border-blood/30 py-1.5 text-xs font-semibold text-blood-light transition-colors hover:border-blood/60 hover:bg-blood/10"
          onClick={onDemolish}
        >
          🔨 {busy ? "Cancel & demolish" : "Demolish"} · recover 50%
        </button>
      )}
    </div>
  );
}
