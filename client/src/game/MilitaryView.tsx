import { useState } from "react";
import type { Empire, UnitType } from "@shared/types";
import { UNITS, UNIT_TYPES, ageAtLeast, rushCost } from "@shared/gamedata";
import { AGE_META, RESOURCE_META, RESOURCE_ORDER, fmt } from "../lib/format";
import { useGame } from "../lib/store";
import { CostBadge, Countdown, TimedBar } from "./ui";
import { isActive, populationCap, usedPopulation } from "./derive";

export default function MilitaryView({ empire }: { empire: Empire }) {
  const train = useGame((s) => s.train);
  const rush = useGame((s) => s.rush);
  const popLeft = populationCap(empire) - usedPopulation(empire);

  return (
    <div className="space-y-6">
      {/* army overview */}
      <div>
        <h3 className="mb-3 font-display text-lg font-semibold">Your Army</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {UNIT_TYPES.map((t) => {
            const u = UNITS[t];
            return (
              <div key={t} className="panel p-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{u.icon}</span>
                  <span className="font-display text-2xl font-bold text-gold-light tabular-nums">
                    {fmt(empire.army[t])}
                  </span>
                </div>
                <div className="mt-1 font-semibold text-parchment-100">{u.name}</div>
                <div className="mt-2 flex gap-3 text-xs text-parchment-300/70">
                  <span className="text-blood-light">⚔ {u.attack}</span>
                  <span className="text-royal-light">🛡 {u.defense}</span>
                  <span className="text-emerald-300">❤ {u.hp}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* training */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Train Troops</h3>
          <span className="chip">👥 {popLeft} population free</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {UNIT_TYPES.map((t) => (
            <Trainer key={t} empire={empire} unit={t} onTrain={train} />
          ))}
        </div>
      </div>

      {/* training queue */}
      {empire.trainQueue.length > 0 && (
        <div>
          <h3 className="mb-3 font-display text-lg font-semibold">Training Queue</h3>
          <div className="space-y-2">
            {empire.trainQueue.map((o) => (
              <div key={o.id} className="panel flex items-center gap-3 p-3">
                <span className="text-xl">{UNITS[o.unit].icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {o.quantity}× {UNITS[o.unit].name}
                    </span>
                    <Countdown to={o.completesAt} className="text-gold-light" />
                  </div>
                  <div className="mt-1.5">
                    <TimedBar startedAt={o.startedAt} completesAt={o.completesAt} />
                  </div>
                </div>
                <button className="btn-gold btn-sm" onClick={() => rush("train", o.id)}>
                  🪙 {rushCost(Math.max(0, (o.completesAt - Date.now()) / 1000))}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Trainer({
  empire,
  unit,
  onTrain,
}: {
  empire: Empire;
  unit: UnitType;
  onTrain: (building: any, unit: UnitType, qty: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const u = UNITS[unit];
  const locked = !ageAtLeast(empire.age, u.requiresAge);
  const hasBuilding = empire.buildings.some((b) => b.type === u.trainedAt && isActive(b));
  const totalCost: Record<string, number> = {};
  for (const [k, v] of Object.entries(u.cost)) totalCost[k] = (v as number) * qty;
  const affordable = RESOURCE_ORDER.every((k) => empire.resources[k] >= (totalCost[k] ?? 0));

  const blockedReason = locked
    ? `Requires ${AGE_META[u.requiresAge].name}`
    : !hasBuilding
      ? `Build a ${u.trainedAt.replace("_", " ")}`
      : null;

  return (
    <div className={`panel p-4 ${blockedReason ? "opacity-70" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{u.icon}</span>
        <div className="font-semibold text-parchment-100">{u.name}</div>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-parchment-300/60">{u.description}</p>

      {blockedReason ? (
        <button className="btn-ghost btn-sm mt-3 w-full" disabled>
          🔒 {blockedReason}
        </button>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-parchment-300/15 bg-black/30">
              <button
                className="px-2.5 py-1 text-parchment-300/70 hover:text-gold-light"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <input
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                className="w-10 bg-transparent text-center text-sm font-semibold focus:outline-none"
              />
              <button
                className="px-2.5 py-1 text-parchment-300/70 hover:text-gold-light"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
              >
                +
              </button>
            </div>
            <div className="flex gap-2">
              {[5, 10].map((n) => (
                <button key={n} className="chip py-0.5 hover:border-gold/40" onClick={() => setQty(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <CostBadge cost={totalCost} have={empire.resources} />
          </div>

          <button
            className="btn-gold btn-sm mt-3 w-full"
            disabled={!affordable}
            onClick={() => onTrain(u.trainedAt, unit, qty)}
          >
            ⚔ Train {qty}
          </button>
        </>
      )}
    </div>
  );
}
