import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import EmberCanvas from "./EmberCanvas";
import BurnStat from "./BurnStat";
import { fmt } from "../../lib/format";

interface Stats {
  players: number;
  totalEmpires: number;
  totalArmies: number;
  online: number;
  worldTick: number;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-2xl font-bold text-gold-light sm:text-3xl">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-parchment-300/60">{label}</div>
    </div>
  );
}

export default function Hero({ stats }: { stats: Stats | null }) {
  return (
    <section className="relative overflow-hidden">
      {/* layered backdrop */}
      <img src="/sections/sky.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-ink/60" />
      <div className="absolute inset-0 bg-hero-radial opacity-70" />
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="pointer-events-none absolute inset-0">
        <EmberCanvas />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />

      <div className="container-x relative flex flex-col items-center pt-20 pb-24 text-center sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="kicker mb-5 rounded-full border border-gold/25 bg-black/30 px-4 py-1.5"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulseGlow" />
          An always-on strategy game with Solana rewards
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="max-w-4xl text-balance text-4xl font-extrabold leading-[1.05] sm:text-6xl md:text-7xl"
        >
          Build an Empire <br className="hidden sm:block" />
          That <span className="text-gold-gradient">Never Sleeps</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-6 max-w-2xl text-balance text-lg leading-relaxed text-parchment-300/80"
        >
          An always-on strategy game on Solana. Build and defend your empire, train armies and raid
          rival players in live battles, and earn SOL just for holding the token — or play free in demo
          mode.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-7 flex max-w-2xl flex-wrap justify-center gap-2"
        >
          {[
            "Build & fortify",
            "Four ages",
            "Train armies",
            "Live raids",
            "Real-player PvP",
            "Heroes & ranks",
            "Quests & loot",
            "SOL rewards",
            "Free demo",
          ].map((f) => (
            <span
              key={f}
              className="rounded-full border border-parchment-300/15 bg-black/30 px-3 py-1 text-xs text-parchment-200/90"
            >
              {f}
            </span>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link to="/register" className="btn-gold px-7 py-3 text-base">
            ⚔ Found Your Empire
          </Link>
          <Link to="/spectate" className="btn-ghost px-7 py-3 text-base">
            👁 Spectate live
          </Link>
          <Link to="/guide" className="btn-ghost px-7 py-3 text-base">
            How it works →
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mt-14 grid w-full max-w-2xl grid-cols-2 gap-6 rounded-2xl border border-parchment-300/10 bg-black/30 px-6 py-6 backdrop-blur-sm sm:grid-cols-4"
        >
          <BurnStat />
          <Stat value={stats ? fmt(stats.totalEmpires) : "—"} label="Empires" />
          <Stat value={stats ? fmt(stats.players) : "—"} label="Rulers" />
          <Stat value={stats ? fmt(stats.totalArmies) : "—"} label="Units afield" />
        </motion.div>

        <div className="mt-12 flex items-center gap-2 text-xs text-parchment-300/50">
          <span className="inline-block h-4 w-px bg-parchment-300/30" />
          Scroll to explore the realm
        </div>
      </div>
    </section>
  );
}
