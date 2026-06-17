import type { Empire } from "@shared/types";
import { ACHIEVEMENTS } from "@shared/gamedata";

export default function AchievementsView({ empire }: { empire: Empire }) {
  const owned = new Set(empire.achievements ?? []);
  const unlockedCount = ACHIEVEMENTS.filter((a) => owned.has(a.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-gold/20 bg-gold/5 px-4 py-3">
        <div>
          <div className="font-display text-base font-semibold text-parchment-100">Achievements</div>
          <div className="text-xs text-parchment-300/60">Milestones earned across your reign</div>
        </div>
        <div className="text-right">
          <div className="font-display text-xl font-bold text-gold-light">
            {unlockedCount}/{ACHIEVEMENTS.length}
          </div>
          <div className="text-[11px] text-parchment-300/50">unlocked</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const have = owned.has(a.id);
          return (
            <div
              key={a.id}
              className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
                have
                  ? "border-gold/35 bg-gold/5"
                  : "border-parchment-300/10 bg-black/20 opacity-60"
              }`}
            >
              <span className={`text-3xl ${have ? "" : "grayscale"}`}>{a.icon}</span>
              <div className="min-w-0 flex-1">
                <div className={`font-semibold ${have ? "text-gold-light" : "text-parchment-200"}`}>
                  {a.name} {have && <span className="text-emerald-400">✓</span>}
                </div>
                <div className="text-xs text-parchment-300/65">{a.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
