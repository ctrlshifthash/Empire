import { useEffect, useState } from "react";
import type { Empire } from "@shared/types";
import { UNITS, UNIT_TYPES, ARENA_MIN_STAKE, ARENA_DAILY_BONUS, TOURNEY_SIZE, TOMBSTONE_RECOVER_PCT } from "@shared/gamedata";
import { useGame } from "../lib/store";
import { SERVER_URL } from "../lib/config";
import { fetchFeatureLocks } from "../lib/features";
import { fmt } from "../lib/format";

type Army = Partial<Record<(typeof UNIT_TYPES)[number], number>>;
type Mode = "duels" | "tournament" | "rankings";

const armyTotal = (a: Army) => UNIT_TYPES.reduce((s, u) => s + (a[u] ?? 0), 0);
const todayIdx = () => Math.floor(Date.now() / 86_400_000);

function ArmyPicker({ empire, army, setArmy }: { empire: Empire; army: Army; setArmy: (a: Army) => void }) {
  const set = (u: (typeof UNIT_TYPES)[number], v: number) =>
    setArmy({ ...army, [u]: Math.max(0, Math.min(empire.army[u] ?? 0, v)) });
  return (
    <div className="space-y-1.5">
      {UNIT_TYPES.map((u) => {
        const have = empire.army[u] ?? 0;
        return (
          <div key={u} className="flex items-center gap-2 rounded-lg border border-parchment-300/10 bg-black/20 px-2.5 py-1.5">
            <span className="text-base">{UNITS[u].icon}</span>
            <div className="flex-1 text-xs">
              <span className="font-medium">{UNITS[u].name}</span>
              <span className="ml-1 text-parchment-300/50">({have})</span>
            </div>
            <div className="flex items-center rounded-md border border-parchment-300/15 bg-black/30">
              <button className="px-2 text-parchment-300/70 hover:text-gold-light" onClick={() => set(u, (army[u] ?? 0) - 1)}>−</button>
              <input value={army[u] ?? 0} onChange={(e) => set(u, parseInt(e.target.value) || 0)} className="w-9 bg-transparent text-center text-xs font-semibold focus:outline-none" />
              <button className="px-2 text-parchment-300/70 hover:text-gold-light" onClick={() => set(u, (army[u] ?? 0) + 1)}>+</button>
            </div>
            <button className="chip py-0 text-[10px]" disabled={have === 0} onClick={() => set(u, have)}>All</button>
          </div>
        );
      })}
    </div>
  );
}

export default function ArenaView({ empire }: { empire: Empire }) {
  const [mode, setMode] = useState<Mode>("duels");
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-parchment-300/15 bg-ink-800/60 p-1">
        {([["duels", "⚔️ Duels"], ["tournament", "🏆 Tournament"], ["rankings", "📊 Rankings"]] as [Mode, string][]).map(
          ([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                mode === m ? "bg-gold/15 text-gold-light" : "text-parchment-300/60 hover:text-parchment-100"
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>
      {mode === "duels" && <Duels empire={empire} />}
      {mode === "tournament" && <TournamentPanel empire={empire} />}
      {mode === "rankings" && <Rankings empire={empire} />}
    </div>
  );
}

// ── Duels ────────────────────────────────────────────────────────────────────
function Duels({ empire }: { empire: Empire }) {
  const duels = useGame((s) => s.snapshot?.duels ?? []);
  const tombstones = useGame((s) => s.snapshot?.tombstones ?? []);
  const createDuel = useGame((s) => s.createDuel);
  const acceptDuel = useGame((s) => s.acceptDuel);
  const cancelDuel = useGame((s) => s.cancelDuel);
  const recoverTombstone = useGame((s) => s.recoverTombstone);
  const [stake, setStake] = useState(ARENA_MIN_STAKE);
  const [postArmy, setPostArmy] = useState<Army>({});
  const [accepting, setAccepting] = useState<string | null>(null);
  const [acceptArmy, setAcceptArmy] = useState<Army>({});
  const [tombstoneMode, setTombstoneMode] = useState(false);
  const [tombLocked, setTombLocked] = useState(true);
  const [clock, setClock] = useState(() => Date.now());
  const acceptTarget = duels.find((d) => d.id === accepting) ?? null;
  const bonusReady = empire.lastArenaBonusDay !== todayIdx();

  useEffect(() => {
    fetchFeatureLocks().then((l) => setTombLocked(l.wilderness !== false));
  }, []);
  useEffect(() => {
    if (!tombstones.length) return;
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, [tombstones.length]);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-3 lg:col-span-2">
        <div className={`rounded-xl border px-4 py-3 text-sm ${bonusReady ? "border-gold/30 bg-gold/5 text-parchment-200" : "border-parchment-300/12 bg-black/20 text-parchment-300/55"}`}>
          {bonusReady
            ? <>🎁 <b className="text-gold-light">Daily win bonus:</b> +{fmt(ARENA_DAILY_BONUS)} coins on your first win today.</>
            : <>✓ Daily win bonus claimed today. Resets tomorrow.</>}
        </div>
        <div className="panel p-4">
          <div className="font-display text-base font-semibold">⚔️ Post a wager</div>
          <p className="mt-1 text-xs text-parchment-300/60">
            Stake coins + commit an army. Winner takes the pot (5% rake burned). You have <b className="text-gold-light">{fmt(empire.coins)}</b> coins.
          </p>
          <label className="mt-3 block text-xs text-parchment-300/55">Stake (coins)</label>
          <input type="number" min={ARENA_MIN_STAKE} value={stake} onChange={(e) => setStake(Math.max(0, parseInt(e.target.value) || 0))} className="mt-1 w-full rounded-lg border border-parchment-300/15 bg-black/30 px-3 py-2 text-sm focus:border-gold/40 focus:outline-none" />
          <div className="mt-3 text-xs text-parchment-300/55">Commit your army</div>
          <div className="mt-1"><ArmyPicker empire={empire} army={postArmy} setArmy={setPostArmy} /></div>

          {/* tombstone mode (beta) */}
          <button
            type="button"
            disabled={tombLocked}
            onClick={() => setTombstoneMode((v) => !v)}
            className={`mt-3 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${tombLocked ? "cursor-not-allowed border-parchment-300/10 bg-black/20 text-parchment-300/40" : tombstoneMode ? "border-purple-400/50 bg-purple-500/15 text-purple-100" : "border-parchment-300/15 bg-black/20 text-parchment-300/70"}`}
          >
            <span>
              ☠️ <b>Tombstone duel</b>
              <span className="ml-1 rounded-full border border-purple-400/40 bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-purple-200">Beta</span>
              <span className="mt-0.5 block text-[10px] text-parchment-300/45">{tombLocked ? "Coming soon" : `Loser's stake drops into a tombstone — recover ${Math.round(TOMBSTONE_RECOVER_PCT * 100)}% within 5 min or the victor loots it.`}</span>
            </span>
            <span className={`grid h-5 w-9 shrink-0 items-center rounded-full px-0.5 ${tombstoneMode && !tombLocked ? "bg-purple-500/70" : "bg-parchment-300/15"}`}>
              <span className={`h-4 w-4 rounded-full bg-white transition-transform ${tombstoneMode && !tombLocked ? "translate-x-4" : ""}`} />
            </span>
          </button>

          <button className="btn-gold btn-sm mt-3 w-full justify-center" disabled={stake < ARENA_MIN_STAKE || empire.coins < stake || armyTotal(postArmy) === 0} onClick={() => { createDuel(stake, postArmy, tombstoneMode && !tombLocked ? "tombstone" : "normal"); setPostArmy({}); }}>
            {tombstoneMode && !tombLocked ? "☠️ " : ""}Post wager · {fmt(stake)} coins
          </button>
        </div>

        {/* recover your dropped tombstones before the victor loots them */}
        {tombstones.length > 0 && (
          <div className="panel border-purple-400/30 p-4">
            <div className="font-display text-base font-semibold text-purple-200">☠️ Your tombstones</div>
            <p className="mt-1 text-xs text-parchment-300/60">Recover your dropped stake before the victor loots it.</p>
            <div className="mt-2 space-y-2">
              {tombstones.map((t) => {
                const left = Math.max(0, t.expiresAt - clock);
                const secs = Math.ceil(left / 1000);
                const mm = Math.floor(secs / 60);
                const ss = secs % 60;
                return (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg border border-purple-400/20 bg-purple-500/5 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-parchment-100">{fmt(t.coins)} coins</div>
                      <div className="text-[11px] text-parchment-300/55">lost to {t.winnerName} · {mm}:{ss.toString().padStart(2, "0")} left</div>
                    </div>
                    <button className="btn-gold btn-sm shrink-0" disabled={left <= 0} onClick={() => recoverTombstone(t.id)}>
                      Recover {fmt(t.recoverable)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-3">
        <div className="panel p-4">
          <div className="mb-2 px-1 font-display text-base font-semibold">🏟️ Open wagers</div>
          <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {duels.length === 0 && <div className="px-2 py-8 text-center text-sm text-parchment-300/55">No open wagers. Post one and wait for a challenger.</div>}
            {duels.map((d) => {
              const mine = d.challengerId === empire.id;
              return (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 hover:bg-white/5">
                  <span className="h-7 w-7 shrink-0 rounded-md ring-1 ring-black/40" style={{ background: d.challengerBanner }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{d.challengerName} {d.mode === "tombstone" && <span title="Tombstone duel" className="text-purple-300">☠️</span>} {mine && <span className="text-parchment-300/45">(you)</span>}</div>
                    <div className="text-xs text-parchment-300/55">⚔ {d.armySize} units committed</div>
                  </div>
                  <div className="text-right"><div className="text-sm font-semibold text-gold-light">{fmt(d.stake)}</div><div className="text-[10px] text-parchment-300/50">coin stake</div></div>
                  {mine ? (
                    <button className="btn-ghost btn-sm" onClick={() => cancelDuel(d.id)}>Withdraw</button>
                  ) : (
                    <button className="btn-blood btn-sm" disabled={empire.coins < d.stake} onClick={() => { setAccepting(d.id); setAcceptArmy({}); }}>
                      {empire.coins < d.stake ? "Can't afford" : "Accept"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {acceptTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setAccepting(null)}>
          <div className="w-full max-w-md rounded-2xl border border-parchment-300/15 bg-ink-800 p-5 shadow-deep" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-parchment-100">Accept wager</h3>
              <button className="text-parchment-300/50 hover:text-parchment-100" onClick={() => setAccepting(null)}>✕</button>
            </div>
            <p className="mt-1 text-sm text-parchment-300/65">Match <b className="text-gold-light">{fmt(acceptTarget.stake)}</b> coins vs {acceptTarget.challengerName} ({acceptTarget.armySize} units). Commit your army.</p>
            <div className="mt-3"><ArmyPicker empire={empire} army={acceptArmy} setArmy={setAcceptArmy} /></div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost btn-sm" onClick={() => setAccepting(null)}>Cancel</button>
              <button className="btn-blood btn-sm" disabled={empire.coins < acceptTarget.stake || armyTotal(acceptArmy) === 0} onClick={() => { acceptDuel(acceptTarget.id, acceptArmy); setAccepting(null); }}>
                Fight · {fmt(acceptTarget.stake)} coins
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tournament ───────────────────────────────────────────────────────────────
function TournamentPanel({ empire }: { empire: Empire }) {
  const t = useGame((s) => s.snapshot?.tournament ?? null);
  const join = useGame((s) => s.joinTournament);
  const leave = useGame((s) => s.leaveTournament);
  if (!t) return <div className="panel p-8 text-center text-sm text-parchment-300/55">No tournament running.</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <div className="font-display text-lg font-bold text-gold-gradient">Rolling Tournament</div>
            <span className="chip text-xs">{t.count}/{t.size} entered</span>
          </div>
          <p className="mt-1 text-sm text-parchment-300/65">
            Pay <b className="text-gold-light">{fmt(t.entryFee)}</b> coins to enter. When it fills to {TOURNEY_SIZE},
            a single-elimination bracket runs instantly and the champion takes the pot (5% rake burned). Your committed
            strength is your current army + gear.
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-light transition-[width]" style={{ width: `${(t.count / t.size) * 100}%` }} />
          </div>
          <div className="mt-4">
            {t.joined ? (
              <button className="btn-ghost btn-sm w-full justify-center" onClick={() => leave()}>Leave (refund {fmt(t.entryFee)} coins)</button>
            ) : (
              <button className="btn-gold btn-sm w-full justify-center" disabled={empire.coins < t.entryFee} onClick={() => join()}>
                {empire.coins < t.entryFee ? `Need ${fmt(t.entryFee)} coins` : `Enter · ${fmt(t.entryFee)} coins`}
              </button>
            )}
          </div>
          {t.lastChampion && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-gold/20 bg-gold/5 p-3">
              <span className="text-2xl">🏆</span>
              <div className="text-sm">
                <div className="font-semibold text-gold-light">Last champion: {t.lastChampion.name}</div>
                <div className="text-xs text-parchment-300/60">won {fmt(t.lastChampion.prize)} coins · {t.lastChampion.size}-player bracket</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="lg:col-span-2">
        <div className="panel p-4">
          <div className="mb-2 px-1 font-display text-base font-semibold">Entrants</div>
          <div className="space-y-1">
            {t.entrants.length === 0 && <div className="px-2 py-6 text-center text-sm text-parchment-300/55">No one's entered yet. Be first.</div>}
            {t.entrants.map((e, i) => (
              <div key={e.name + i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <span className="h-5 w-5 shrink-0 rounded ring-1 ring-black/40" style={{ background: e.banner }} />
                <span className="truncate text-sm">{e.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Rankings ─────────────────────────────────────────────────────────────────
type Rank = { name: string; banner: string; duelsWon: number; bestStreak: number; power: number };
function Rankings({ empire }: { empire: Empire }) {
  const [rows, setRows] = useState<Rank[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${SERVER_URL}/api/arena/rankings`).then((r) => r.json()).then((d) => alive && d?.ok && setRows(d.rankings)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return (
    <div className="panel p-4">
      <div className="mb-3 grid grid-cols-[2rem_1fr_4rem_4rem] gap-3 border-b border-parchment-300/10 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-parchment-300/55">
        <div>#</div><div>Duelist</div><div className="text-right">Wins</div><div className="text-right">Best streak</div>
      </div>
      {rows === null && <div className="p-6 text-center text-sm text-parchment-300/55">Loading…</div>}
      {rows?.length === 0 && <div className="p-6 text-center text-sm text-parchment-300/55">No arena wins yet. Be the first champion.</div>}
      {rows?.map((r, i) => (
        <div key={r.name + i} className={`grid grid-cols-[2rem_1fr_4rem_4rem] items-center gap-3 rounded-lg px-2 py-2 ${r.name === empire.name ? "bg-gold/5" : ""}`}>
          <div className={`font-display font-bold ${i === 0 ? "text-gold-light" : "text-parchment-300/50"}`}>{i + 1}</div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-6 w-6 shrink-0 rounded ring-1 ring-black/40" style={{ background: r.banner }} />
            <span className="truncate text-sm font-medium">{r.name}</span>
          </div>
          <div className="text-right text-sm font-semibold text-gold-light">{r.duelsWon}</div>
          <div className="text-right text-sm text-parchment-300/75">{r.bestStreak}</div>
        </div>
      ))}
    </div>
  );
}
