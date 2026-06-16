import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { AGE_META, fmt } from "../lib/format";
import { rankForPower } from "@shared/gamedata";
import EmpireCrest from "../components/EmpireCrest";

type Board = Awaited<ReturnType<typeof api.leaderboard>>;

export default function LeaderboardPage() {
  const [board, setBoard] = useState<Board | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => api.leaderboard().then((b) => alive && setBoard(b)).catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const rows = board?.rows ?? [];

  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      <div className="absolute inset-0 bg-grid opacity-15" />
      <div className="container-x relative py-16">
        <div className="text-center">
          <span className="kicker">👑 Global standings</span>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
            The <span className="text-gold-gradient">Leaderboard</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-parchment-300/70">
            Empires ranked by power across the living world. Rankings update live as realms rise and
            fall.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-parchment-300/10 bg-ink-800/60 shadow-panel">
          <div className="grid grid-cols-[3rem_1fr_auto_auto] gap-4 border-b border-parchment-300/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-parchment-300/55 sm:grid-cols-[3rem_1fr_6rem_5rem_5rem]">
            <div>#</div>
            <div>Empire</div>
            <div className="hidden text-right sm:block">Age</div>
            <div className="hidden text-right sm:block">Raids</div>
            <div className="text-right">Power</div>
          </div>

          {rows.length === 0 && (
            <div className="p-10 text-center text-sm text-parchment-300/60">Loading the realm…</div>
          )}

          {rows.map((r, i) => (
            <motion.div
              key={r.name + i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
              className="grid grid-cols-[3rem_1fr_auto_auto] items-center gap-4 border-b border-parchment-300/5 px-5 py-3.5 last:border-0 sm:grid-cols-[3rem_1fr_6rem_5rem_5rem]"
            >
              <div
                className={`font-display text-lg font-bold ${
                  i === 0
                    ? "text-gold-light"
                    : i < 3
                      ? "text-parchment-200"
                      : "text-parchment-300/50"
                }`}
              >
                {i + 1}
              </div>
              <div className="flex min-w-0 items-center gap-3">
                <EmpireCrest color={r.banner} name={r.name} size={30} />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-parchment-100">
                    {r.name}{" "}
                    {r.online && (
                      <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
                    )}
                  </div>
                  <div className="text-xs text-parchment-300/55">⚜ {rankForPower(r.power).name}</div>
                </div>
              </div>
              <div
                className="hidden text-right text-sm font-medium sm:block"
                style={{ color: AGE_META[r.age as keyof typeof AGE_META]?.color }}
              >
                {AGE_META[r.age as keyof typeof AGE_META]?.short ?? r.age}
              </div>
              <div className="hidden text-right text-sm text-parchment-300/70 sm:block">{r.raidsWon}</div>
              <div className="text-right font-display font-bold text-gold-light">{fmt(r.power)}</div>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link to="/register" className="btn-gold">
            ⚔ Claim your place
          </Link>
        </div>
      </div>
    </div>
  );
}
