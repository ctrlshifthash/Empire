import type { Empire, ResourceKind } from "@shared/types";
import { rankForPower } from "@shared/gamedata";
import { RESOURCE_META, RESOURCE_ORDER, AGE_META, fmt } from "../lib/format";
import { populationCap, productionPerMin, usedPopulation, warehouseCapacity } from "./derive";

export default function ResourceBar({ empire, onLocate }: { empire: Empire; onLocate?: (kind: ResourceKind) => void }) {
  const cap = warehouseCapacity(empire);
  const rates = productionPerMin(empire);
  const popUsed = usedPopulation(empire);
  const popCap = populationCap(empire);
  const popFull = popUsed >= popCap;
  // active Harvest Surge (token-shop gather buff) — show it so buyers can see what they bought
  const boostMs = empire.boosts?.gatherUntil ? empire.boosts.gatherUntil - Date.now() : 0;
  const boostActive = boostMs > 0;
  const boostLeft =
    boostMs >= 3_600_000
      ? `${Math.floor(boostMs / 3_600_000)}h ${Math.round((boostMs % 3_600_000) / 60_000)}m`
      : `${Math.max(1, Math.round(boostMs / 60_000))}m`;

  return (
    <div className="sticky top-16 z-30 border-b border-parchment-300/10 bg-ink-800/90 backdrop-blur-md">
      <div className="container-x flex items-center gap-3 overflow-x-auto py-2.5">
        {RESOURCE_ORDER.map((k) => {
          const amount = Math.floor(empire.resources[k]);
          const near = amount >= cap * 0.97;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onLocate?.(k)}
              className="group flex shrink-0 items-center gap-2 rounded-lg border border-parchment-300/10 bg-black/30 px-3 py-1.5 text-left transition-colors hover:border-gold/40 hover:bg-white/5"
              title={`${RESOURCE_META[k].label} — capacity ${fmt(cap)}. Click to send your hero to the nearest source.`}
            >
              <span className="text-lg leading-none">{RESOURCE_META[k].icon}</span>
              <div className="leading-tight">
                <div className={`font-semibold tabular-nums ${near ? "text-blood-light" : "text-parchment-100"}`}>
                  {fmt(amount)}
                  <span className="text-parchment-300/40">/{fmt(cap)}</span>
                </div>
                <div className="text-[10px] font-medium text-emerald-400/80">
                  +{Math.round(rates[k])}/min
                  <span className="ml-1 text-parchment-300/40 opacity-0 transition-opacity group-hover:opacity-100">📍 find</span>
                </div>
              </div>
            </button>
          );
        })}

        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-gold/25 bg-black/30 px-3 py-1.5" title="Coins — earned from quests, spent to rush">
          <span className="text-lg leading-none">🪙</span>
          <div className="font-semibold tabular-nums text-gold-light">{fmt(empire.coins)}</div>
        </div>

        {boostActive && (
          <div
            className="flex shrink-0 items-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-3 py-1.5 shadow-[0_0_12px_rgba(52,211,153,0.25)]"
            title={`Harvest Surge active — ${empire.boosts?.gatherMult ?? 2}× gather yield (from the token shop).`}
          >
            <span className="text-lg leading-none">🌾</span>
            <div className="leading-tight">
              <div className="font-semibold tabular-nums text-emerald-300">{empire.boosts?.gatherMult ?? 2}× Harvest</div>
              <div className="text-[10px] font-medium text-emerald-400/80">{boostLeft} left</div>
            </div>
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${
              popFull ? "border-blood-light/40 bg-blood/15" : "border-parchment-300/10 bg-black/30"
            }`}
            title="Population (used / capacity). Build Houses to raise the cap."
          >
            <span>👥</span>
            <span className="font-semibold tabular-nums">
              {popUsed}
              <span className="text-parchment-300/40">/{popCap}</span>
            </span>
          </div>

          <div
            className="hidden items-center gap-1.5 rounded-lg border px-3 py-1.5 sm:flex"
            style={{ borderColor: `${AGE_META[empire.age].color}55`, background: `${AGE_META[empire.age].color}18` }}
            title="Current age"
          >
            <span>🏛️</span>
            <span className="font-semibold" style={{ color: AGE_META[empire.age].color }}>
              {AGE_META[empire.age].short}
            </span>
          </div>

          <div
            className="hidden items-center gap-1.5 rounded-lg border border-gold/25 bg-black/30 px-3 py-1.5 sm:flex"
            title={`Rank — +${Math.round((rankForPower(empire.power).gatherMult - 1) * 100)}% harvest yield. Rise by gaining power.`}
          >
            <span>🏅</span>
            <span className="font-semibold text-gold-light">{rankForPower(empire.power).name}</span>
          </div>

          <div className="hidden items-center gap-1.5 rounded-lg border border-parchment-300/10 bg-black/30 px-3 py-1.5 md:flex" title="Empire power (leaderboard score)">
            <span>⚡</span>
            <span className="font-semibold tabular-nums text-gold-light">{fmt(empire.power)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
