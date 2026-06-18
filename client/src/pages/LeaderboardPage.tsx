import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { SERVER_URL } from "../lib/config";
import { AGE_META, fmt } from "../lib/format";
import { rankForPower } from "@shared/gamedata";
import EmpireCrest from "../components/EmpireCrest";

type Board = Awaited<ReturnType<typeof api.leaderboard>>;
type AllianceRow = {
  id: string;
  name: string;
  tag: string;
  banner: string;
  memberCount: number;
  totalPower: number;
};
type View = "players" | "alliances";

export default function LeaderboardPage() {
  const [view, setView] = useState<View>("players");
  const [board, setBoard] = useState<Board | null>(null);
  const [alliances, setAlliances] = useState<AllianceRow[] | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    let alive = true;
    const load = () => {
      api.leaderboard().then((b) => alive && setBoard(b)).catch(() => {});
      fetch(`${SERVER_URL}/api/alliances`)
        .then((r) => r.json())
        .then((d) => alive && d?.ok && setAlliances(d.alliances))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const rows = board?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  // a windowed set of page numbers around the current page
  const winFrom = Math.max(0, Math.min(safePage - 3, totalPages - 7));
  const pageWindow = Array.from({ length: Math.min(7, totalPages) }, (_, k) => winFrom + k);

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
          <div className="mt-6 inline-flex rounded-xl border border-parchment-300/15 bg-ink-800/60 p-1">
            {(["players", "alliances"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
                  view === v ? "bg-gold/15 text-gold-light" : "text-parchment-300/60 hover:text-parchment-100"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {view === "alliances" ? (
          <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-parchment-300/10 bg-ink-800/60 shadow-panel">
            <div className="grid grid-cols-[3rem_1fr_5rem_6rem] gap-4 border-b border-parchment-300/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-parchment-300/55">
              <div>#</div>
              <div>Alliance</div>
              <div className="text-right">Members</div>
              <div className="text-right">Power</div>
            </div>
            {(alliances?.length ?? 0) === 0 && (
              <div className="p-10 text-center text-sm text-parchment-300/60">
                No alliances yet — be the first to found one in-game.
              </div>
            )}
            {(alliances ?? []).map((a, i) => (
              <div
                key={a.id}
                className="grid grid-cols-[3rem_1fr_5rem_6rem] items-center gap-4 border-b border-parchment-300/5 px-5 py-3.5 last:border-0"
              >
                <div className={`font-display text-lg font-bold ${i === 0 ? "text-gold-light" : i < 3 ? "text-parchment-200" : "text-parchment-300/50"}`}>
                  {i + 1}
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-display text-[11px] font-bold text-ink ring-1 ring-black/40" style={{ background: a.banner }}>
                    {a.tag}
                  </span>
                  <div className="truncate font-semibold text-parchment-100">{a.name}</div>
                </div>
                <div className="text-right text-sm text-parchment-300/70">{a.memberCount}</div>
                <div className="text-right font-display font-bold text-gold-light">{fmt(a.totalPower)}</div>
              </div>
            ))}
          </div>
        ) : (
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

          {pageRows.map((r, i) => {
            const rank = safePage * PAGE_SIZE + i + 1;
            return (
            <motion.div
              key={r.name + rank}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
              className="grid grid-cols-[3rem_1fr_auto_auto] items-center gap-4 border-b border-parchment-300/5 px-5 py-3.5 last:border-0 sm:grid-cols-[3rem_1fr_6rem_5rem_5rem]"
            >
              <div
                className={`font-display text-lg font-bold ${
                  rank === 1
                    ? "text-gold-light"
                    : rank <= 3
                      ? "text-parchment-200"
                      : "text-parchment-300/50"
                }`}
              >
                {rank}
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
                  <div className="text-xs text-parchment-300/55">
                    ⚜ {rankForPower(r.power).name}
                    {r.solEarned > 0 && <span className="text-gold-light/80"> · ◎ {r.solEarned.toFixed(3)} SOL earned</span>}
                  </div>
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
            );
          })}
        </div>
        )}

        {/* pagination (players) */}
        {view === "players" && totalPages > 1 && (
          <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-1.5">
            <button
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              className="rounded-lg border border-parchment-300/15 bg-white/5 px-3 py-1.5 text-sm text-parchment-100/80 hover:border-gold/40 hover:text-gold-light disabled:opacity-30"
            >
              ‹ Prev
            </button>
            {winFrom > 0 && <span className="px-1 text-parchment-300/40">…</span>}
            {pageWindow.map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`min-w-9 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  p === safePage ? "bg-gold/15 text-gold-light" : "border border-parchment-300/10 bg-white/5 text-parchment-300/70 hover:text-parchment-100"
                }`}
              >
                {p + 1}
              </button>
            ))}
            {winFrom + 7 < totalPages && <span className="px-1 text-parchment-300/40">…</span>}
            <button
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(safePage + 1)}
              className="rounded-lg border border-parchment-300/15 bg-white/5 px-3 py-1.5 text-sm text-parchment-100/80 hover:border-gold/40 hover:text-gold-light disabled:opacity-30"
            >
              Next ›
            </button>
            <span className="ml-2 text-xs text-parchment-300/50">{rows.length} rulers</span>
          </div>
        )}

        <div className="mt-10 text-center">
          <Link to="/register" className="btn-gold">
            ⚔ Claim your place
          </Link>
        </div>
      </div>
    </div>
  );
}
