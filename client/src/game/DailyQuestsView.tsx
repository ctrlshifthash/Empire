import { useEffect } from "react";
import { useGame } from "../lib/store";

// Daily Quests (beta). Daily-resetting objectives with live progress; claim for
// resource rewards. Locked behind the `dailyQuests` beta flag.
export default function DailyQuestsView() {
  const daily = useGame((s) => s.dailyState);
  const getDaily = useGame((s) => s.getDaily);
  const claimDaily = useGame((s) => s.claimDaily);

  // fetch on open + poll so progress stays live as you play
  useEffect(() => {
    getDaily();
    const t = setInterval(getDaily, 4000);
    return () => clearInterval(t);
  }, [getDaily]);

  const locked = daily?.locked;
  const quests = daily?.quests ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-display text-2xl font-bold text-gold-gradient">Daily Quests</h2>
        <span className="rounded-full border border-purple-400/40 bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-200">Beta</span>
      </div>
      <p className="mb-5 text-sm text-parchment-300/65">Fresh objectives every day (resets at midnight UTC). Complete them for resource rewards.</p>

      {locked ? (
        <div className="panel grid place-items-center gap-2 p-10 text-center">
          <div className="text-4xl">🔒</div>
          <div className="font-semibold text-parchment-100">In beta — coming soon</div>
          <p className="max-w-sm text-sm text-parchment-300/55">Daily Quests are built and on the way. They'll switch on shortly.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quests.map((q) => {
            const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
            const done = q.progress >= q.target;
            return (
              <div key={q.id} className="panel flex items-center gap-4 p-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-black/30 text-2xl">{q.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-parchment-100">{q.label}</span>
                    <span className="text-xs text-parchment-300/55">{Math.min(q.progress, q.target)}/{q.target}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/40">
                    <div className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-gold/70"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 text-[11px] text-parchment-300/50">Reward: {q.rewardText}</div>
                </div>
                <button
                  className="btn-gold btn-sm shrink-0"
                  disabled={!done || q.claimed}
                  onClick={() => claimDaily(q.id)}
                >
                  {q.claimed ? "Claimed" : done ? "Claim" : "Locked"}
                </button>
              </div>
            );
          })}
          {quests.length === 0 && <p className="text-sm text-parchment-300/55">Loading today's quests…</p>}
        </div>
      )}
    </div>
  );
}
