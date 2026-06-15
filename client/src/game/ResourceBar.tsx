import type { Empire } from "@shared/types";
import { RESOURCE_META, RESOURCE_ORDER, AGE_META, fmt } from "../lib/format";
import { populationCap, productionPerMin, usedPopulation, warehouseCapacity } from "./derive";

export default function ResourceBar({ empire }: { empire: Empire }) {
  const cap = warehouseCapacity(empire);
  const rates = productionPerMin(empire);
  const popUsed = usedPopulation(empire);
  const popCap = populationCap(empire);
  const popFull = popUsed >= popCap;

  return (
    <div className="sticky top-16 z-30 border-b border-parchment-300/10 bg-ink-800/90 backdrop-blur-md">
      <div className="container-x flex items-center gap-3 overflow-x-auto py-2.5">
        {RESOURCE_ORDER.map((k) => {
          const amount = Math.floor(empire.resources[k]);
          const near = amount >= cap * 0.97;
          return (
            <div
              key={k}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-parchment-300/10 bg-black/30 px-3 py-1.5"
              title={`${RESOURCE_META[k].label} — capacity ${fmt(cap)}`}
            >
              <span className="text-lg leading-none">{RESOURCE_META[k].icon}</span>
              <div className="leading-tight">
                <div className={`font-semibold tabular-nums ${near ? "text-blood-light" : "text-parchment-100"}`}>
                  {fmt(amount)}
                  <span className="text-parchment-300/40">/{fmt(cap)}</span>
                </div>
                <div className="text-[10px] font-medium text-emerald-400/80">
                  +{Math.round(rates[k])}/min
                </div>
              </div>
            </div>
          );
        })}

        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-gold/25 bg-black/30 px-3 py-1.5" title="Coins — earned from quests, spent to rush">
          <span className="text-lg leading-none">🪙</span>
          <div className="font-semibold tabular-nums text-gold-light">{fmt(empire.coins)}</div>
        </div>

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

          <div className="hidden items-center gap-1.5 rounded-lg border border-parchment-300/10 bg-black/30 px-3 py-1.5 md:flex" title="Empire power (leaderboard score)">
            <span>⚡</span>
            <span className="font-semibold tabular-nums text-gold-light">{fmt(empire.power)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
