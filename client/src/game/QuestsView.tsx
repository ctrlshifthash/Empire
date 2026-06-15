import type { Empire } from "@shared/types";
import { QUESTS } from "@shared/gamedata";
import { RESOURCE_META, RESOURCE_ORDER, fmt } from "../lib/format";
import { useGame } from "../lib/store";
import { ProgressBar } from "./ui";

export default function QuestsView({ empire }: { empire: Empire }) {
  const claim = useGame((s) => s.claimQuest);

  const rows = QUESTS.map((def) => {
    const qp = empire.quests.find((q) => q.questId === def.id) ?? {
      questId: def.id,
      progress: 0,
      goal: def.goal,
      completed: false,
      claimed: false,
    };
    return { def, qp };
  }).sort((a, b) => {
    const rank = (x: typeof a) =>
      x.qp.completed && !x.qp.claimed ? 0 : !x.qp.claimed ? 1 : 2;
    return rank(a) - rank(b);
  });

  const claimable = rows.filter((r) => r.qp.completed && !r.qp.claimed).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Quests</h3>
        {claimable > 0 && (
          <span className="chip border-gold/40 text-gold-light">
            🎁 {claimable} reward{claimable === 1 ? "" : "s"} to claim
          </span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map(({ def, qp }) => {
          const ready = qp.completed && !qp.claimed;
          return (
            <div
              key={def.id}
              className={`panel p-4 transition-colors ${
                ready ? "border-gold/40 shadow-gold" : qp.claimed ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-parchment-100">{def.title}</span>
                    {qp.claimed && <span className="text-xs text-emerald-400">✓ done</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-parchment-300/65">{def.description}</p>
                </div>
                <span className="text-xl">{ready ? "🎁" : qp.claimed ? "✅" : "📜"}</span>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-parchment-300/60">
                  <span>Progress</span>
                  <span className="tabular-nums">
                    {fmt(qp.progress)} / {fmt(def.goal)}
                  </span>
                </div>
                <ProgressBar
                  value={qp.progress}
                  max={def.goal}
                  color={ready ? "#e8c75a" : "#3f7a4d"}
                />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-parchment-300/55">Reward:</span>
                  {def.reward.coins && (
                    <span className="font-medium text-gold-light">🪙 {def.reward.coins}</span>
                  )}
                  {RESOURCE_ORDER.filter((k) => def.reward[k]).map((k) => (
                    <span key={k} className="font-medium text-parchment-200">
                      {RESOURCE_META[k].icon} {def.reward[k]}
                    </span>
                  ))}
                </div>
                {ready && (
                  <button className="btn-gold btn-sm" onClick={() => claim(def.id)}>
                    Claim
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
