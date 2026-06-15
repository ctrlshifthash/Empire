import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BattleReport, UnitType } from "@shared/types";
import { UNITS, UNIT_TYPES } from "@shared/gamedata";
import { RESOURCE_META, RESOURCE_ORDER, fmt } from "../lib/format";

type Army = Partial<Record<UnitType, number>>;
const size = (a: Army) => UNIT_TYPES.reduce((s, u) => s + (a[u] ?? 0), 0);

function ArmyColumn({
  army,
  losses,
  phase,
  align,
  color,
}: {
  army: Army;
  losses: Army;
  phase: number;
  align: "left" | "right";
  color: string;
}) {
  const rows = UNIT_TYPES.filter((u) => (army[u] ?? 0) > 0);
  return (
    <div className={`flex flex-col gap-1.5 ${align === "right" ? "items-end" : "items-start"}`}>
      {rows.length === 0 && <div className="text-xs text-parchment-300/50">no army</div>}
      {rows.map((u) => {
        const start = army[u] ?? 0;
        const lost = losses[u] ?? 0;
        const now = phase >= 3 ? Math.max(0, start - lost) : start;
        return (
          <div key={u} className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg ring-1"
              style={{ background: `${color}22`, borderColor: color, color }}
            >
              {UNITS[u].icon}
            </span>
            <div className={align === "right" ? "text-right" : ""}>
              <div className="text-sm font-semibold text-parchment-100">
                {now}
                {phase >= 3 && lost > 0 && <span className="ml-1 text-xs text-blood-light">−{lost}</span>}
              </div>
              <div className="text-[10px] text-parchment-300/55">{UNITS[u].name}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function BattleReplay({ report, onClose }: { report: BattleReport; onClose: () => void }) {
  const [phase, setPhase] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    setPhase(0);
    const t = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2200),
      setTimeout(() => setPhase(4), 3100),
    ];
    return () => t.forEach(clearTimeout);
  }, [run]);

  const youAttacker = report.role === "attacker";
  const yourArmy = youAttacker ? report.attackerArmy : report.defenderArmy;
  const enemyArmy = youAttacker ? report.defenderArmy : report.attackerArmy;
  const yourLosses = youAttacker ? report.attackerLosses : report.defenderLosses;
  const enemyLosses = youAttacker ? report.defenderLosses : report.attackerLosses;
  const youWon = youAttacker ? report.attackerWon : !report.attackerWon;
  const yourName = youAttacker ? report.attackerName : report.defenderName;
  const enemyName = youAttacker ? report.defenderName : report.attackerName;
  const lootTotal = report.loot.wood + report.loot.food + report.loot.gold + report.loot.stone;

  const charge = phase >= 1;
  const clash = phase === 2;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-gold/40 bg-ink-800/95 shadow-deep"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-parchment-300/10 px-5 py-3">
          <div className="font-display text-lg font-bold">
            {youAttacker ? `Your raid on ${enemyName}` : `${enemyName} invaded you`}
          </div>
          <button className="text-parchment-300/60 hover:text-parchment-100" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* battlefield */}
        <div className="relative overflow-hidden bg-gradient-to-b from-[#2c3a1e] to-[#1a230f] px-6 py-8">
          <motion.div
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-4"
            animate={clash ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div animate={{ x: charge ? 24 : 0 }} transition={{ type: "spring", stiffness: 120, damping: 14 }}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                {yourName} (you)
              </div>
              <ArmyColumn army={yourArmy} losses={yourLosses} phase={phase} align="left" color="#5fd16a" />
            </motion.div>

            <div className="flex flex-col items-center">
              <AnimatePresence>
                {clash && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0, rotate: -30 }}
                    animate={{ scale: [0, 1.6, 1], opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-5xl"
                  >
                    ⚔️
                  </motion.div>
                )}
              </AnimatePresence>
              {!clash && <div className="font-display text-2xl text-parchment-300/40">VS</div>}
            </div>

            <motion.div animate={{ x: charge ? -24 : 0 }} transition={{ type: "spring", stiffness: 120, damping: 14 }}>
              <div className="mb-2 text-right text-xs font-semibold uppercase tracking-wider text-blood-light">
                {enemyName}
              </div>
              <ArmyColumn army={enemyArmy} losses={enemyLosses} phase={phase} align="right" color="#e0533f" />
            </motion.div>
          </motion.div>

          {/* power readout */}
          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-parchment-300/60">
            <span>⚔ atk power {fmt(report.attackPower)}</span>
            <span className="text-parchment-300/30">vs</span>
            <span>🛡 def power {fmt(report.defendPower)}</span>
          </div>
        </div>

        {/* result */}
        <AnimatePresence>
          {phase >= 4 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-t border-parchment-300/10 px-6 py-5"
            >
              <div
                className={`text-center font-display text-3xl font-extrabold ${
                  youWon ? "text-gold-gradient" : "text-blood-light"
                }`}
              >
                {youWon ? "⚑ VICTORY!" : "☠ DEFEAT"}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                <div className="rounded-lg bg-black/25 px-3 py-2 text-center">
                  <div className="text-xs text-parchment-300/55">Your losses</div>
                  <div className="font-semibold text-blood-light">{size(yourLosses)} units</div>
                </div>
                <div className="rounded-lg bg-black/25 px-3 py-2 text-center">
                  <div className="text-xs text-parchment-300/55">Enemy losses</div>
                  <div className="font-semibold text-emerald-300">{size(enemyLosses)} units</div>
                </div>
                <div className="rounded-lg bg-black/25 px-3 py-2 text-center">
                  <div className="text-xs text-parchment-300/55">{youAttacker ? "Plundered" : "Lost to raider"}</div>
                  <div className="font-semibold text-gold-light">{fmt(lootTotal)}</div>
                </div>
              </div>

              {lootTotal > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm">
                  {RESOURCE_ORDER.filter((k) => report.loot[k] > 0).map((k) => (
                    <span key={k} className="text-parchment-200">
                      {RESOURCE_META[k].icon} {fmt(report.loot[k])}
                    </span>
                  ))}
                </div>
              )}

              {report.razed && (
                <div className="mt-3 text-center text-sm font-semibold text-orange-300">
                  🔥 {youAttacker ? `You razed their ${report.razed}!` : `They razed your ${report.razed}!`}
                </div>
              )}

              <div className="mt-5 flex justify-center gap-3">
                <button className="btn-ghost btn-sm" onClick={() => setRun((r) => r + 1)}>
                  ↻ Replay
                </button>
                <button className="btn-gold btn-sm" onClick={onClose}>
                  Close
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
