// The Armoury — spend coins to equip your army (weapons = attack, armour =
// defense, per unit type) and your hero (vigor = HP), and track your rank.
import type { Empire } from "@shared/types";
import {
  GEAR_BONUS,
  MAX_GEAR,
  MAX_ARMOUR,
  UNITS,
  UNIT_TYPES,
  armourTier,
  gearCost,
  nextRank,
  rankForPower,
} from "@shared/gamedata";
import { useGame } from "../lib/store";

function GearBtn({
  label,
  cost,
  maxed,
  afford,
  onClick,
}: {
  label: string;
  cost: number;
  maxed: boolean;
  afford: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={maxed || !afford}
      onClick={onClick}
      className={`shrink-0 rounded-lg border px-3 py-1.5 text-center text-xs font-semibold transition-colors ${
        maxed
          ? "border-emerald-500/30 text-emerald-300/70"
          : afford
            ? "border-gold/40 bg-gold/10 text-gold-light hover:bg-gold/20"
            : "border-parchment-300/10 text-parchment-300/40"
      }`}
    >
      <div>{label}</div>
      <div className="text-[10px] opacity-80">{maxed ? "MAX" : `🪙 ${cost}`}</div>
    </button>
  );
}

export default function ArmouryView({ empire }: { empire: Empire }) {
  const buy = useGame((s) => s.buyArmoury);
  const coins = empire.coins;
  const armoury = empire.armoury ?? { weapon: {}, armour: {} };
  const rank = rankForPower(empire.power);
  const nx = nextRank(empire.power);

  return (
    <div className="max-w-3xl space-y-6">
      {/* rank banner */}
      <div className="rounded-xl border border-gold/25 bg-gradient-to-b from-gold/10 to-transparent p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-parchment-300/60">Your rank</div>
            <div className="font-display text-2xl font-bold text-gold-light">🏅 {rank.name}</div>
            <div className="text-xs text-emerald-300">
              +{Math.round((rank.gatherMult - 1) * 100)}% harvest yield
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="text-parchment-300/70">⚡ Power {empire.power}</div>
            {nx ? (
              <div className="text-xs text-parchment-300/50">
                Next: {nx.name} @ {nx.minPower}
              </div>
            ) : (
              <div className="text-xs text-gold-light">Highest rank!</div>
            )}
          </div>
        </div>
        {nx && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, (empire.power / nx.minPower) * 100)}%` }} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-lg">🪙</span>
        <span className="font-semibold text-gold-light">{coins} coins</span>
        <span className="text-parchment-300/50">— earned from quests, raids & decisive victories</span>
      </div>

      {/* army equipment */}
      <div>
        <h3 className="mb-1 font-display text-lg font-semibold">⚔ Army Equipment</h3>
        <p className="mb-3 text-xs text-parchment-300/55">
          Better weapons and armour make every soldier of that type hit harder and survive longer in battle.
        </p>
        <div className="space-y-2">
          {UNIT_TYPES.map((u) => {
            const w = armoury.weapon[u] ?? 0;
            const a = armoury.armour[u] ?? 0;
            const wCost = gearCost(w);
            const aCost = gearCost(a);
            return (
              <div key={u} className="flex items-center gap-3 rounded-lg border border-parchment-300/10 bg-black/20 p-3">
                <span className="text-2xl">{UNITS[u].icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{UNITS[u].name}</div>
                  <div className="text-xs text-parchment-300/65">
                    ⚔ Attack <b className="text-parchment-100">{Math.round(UNITS[u].attack * (1 + w * GEAR_BONUS) * 10) / 10}</b>
                    {w > 0 && <span className="text-emerald-300/80"> (+{Math.round(w * GEAR_BONUS * 100)}%)</span>}
                    {" · "}🛡 Defense <b className="text-parchment-100">{Math.round(UNITS[u].defense * (1 + a * GEAR_BONUS) * 10) / 10}</b>
                    {a > 0 && <span className="text-emerald-300/80"> (+{Math.round(a * GEAR_BONUS * 100)}%)</span>}
                    <span className="text-gold-light/80"> · {armourTier(a)}</span>
                  </div>
                  <div className="text-[10px] text-parchment-300/45">
                    next weapon → +{Math.round((w + 1) * GEAR_BONUS * 100)}% atk · next armour → {a >= MAX_ARMOUR ? "maxed" : `${armourTier(a + 1)} (+${Math.round((a + 1) * GEAR_BONUS * 100)}% def)`}
                  </div>
                </div>
                <GearBtn label={`⚔ Wpn ${w}/${MAX_GEAR}`} cost={wCost} maxed={w >= MAX_GEAR} afford={coins >= wCost} onClick={() => buy("weapon", u)} />
                <GearBtn label={`🛡 Arm ${a}/${MAX_ARMOUR}`} cost={aCost} maxed={a >= MAX_ARMOUR} afford={coins >= aCost} onClick={() => buy("armour", u)} />
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-parchment-300/50">
        🦸 Upgrade your own hero's sword, helmet and armour on the <span className="text-gold-light">Hero</span> page.
      </p>
    </div>
  );
}
