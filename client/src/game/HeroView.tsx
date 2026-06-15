import type { Empire, ResourceKind } from "@shared/types";
import {
  MAX_TIER,
  SKILLS,
  SKILL_ORDER,
  TIER_NAMES,
  TOOLS,
  TOOL_ORDER,
  gatherYield,
  heroDamage,
  heroLevel,
  heroMaxHp,
  levelForXp,
  levelProgress,
  toolUpgradeCost,
} from "@shared/progression";
import { RESOURCE_META, RESOURCE_ORDER, fmt } from "../lib/format";
import { useGame } from "../lib/store";
import { ProgressBar } from "./ui";

export default function HeroView({ empire }: { empire: Empire }) {
  const upgradeTool = useGame((s) => s.upgradeTool);
  const hero = empire.hero;
  if (!hero) return null;

  const combatLvl = levelForXp(hero.skills.combat ?? 0);

  return (
    <div className="space-y-6">
      {/* hero summary */}
      <div className="panel flex flex-wrap items-center gap-6 p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-gold/30 to-transparent text-4xl ring-1 ring-gold/30">
            🦸
          </div>
          <div>
            <div className="font-display text-xl font-bold">{empire.name}'s Champion</div>
            <div className="text-sm text-parchment-300/70">Total level {heroLevel(hero)}</div>
          </div>
        </div>
        <div className="flex gap-6 text-sm">
          <Stat label="Combat lvl" value={combatLvl} />
          <Stat label="Hero damage" value={heroDamage(combatLvl, hero.tools.sword ?? 1)} />
          <Stat label="Max HP" value={heroMaxHp(combatLvl)} />
        </div>
      </div>

      {/* skills */}
      <div>
        <h3 className="mb-3 font-display text-lg font-semibold">Skills</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {SKILL_ORDER.map((s) => {
            const def = SKILLS[s];
            const xp = hero.skills[s] ?? 0;
            const prog = levelProgress(xp);
            return (
              <div key={s} className="panel p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="text-2xl">{def.icon}</span>
                    <span className="font-semibold text-parchment-100">{def.name}</span>
                  </span>
                  <span className="font-display text-xl font-bold text-gold-light">{prog.level}</span>
                </div>
                <p className="mt-1 text-xs text-parchment-300/60">{def.blurb}</p>
                <div className="mt-3">
                  <ProgressBar value={prog.frac * 100} max={100} color="#3f7a4d" />
                  <div className="mt-1 flex justify-between text-[10px] text-parchment-300/50">
                    <span>{fmt(xp)} XP total</span>
                    <span>{prog.need > 0 ? `${fmt(prog.into)} / ${fmt(prog.need)} to lvl ${prog.level + 1}` : "MAX"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* tools */}
      <div>
        <h3 className="mb-1 font-display text-lg font-semibold">Tools</h3>
        <p className="mb-3 text-sm text-parchment-300/60">
          Better tools gather more per swing and hit harder. Upgrade them with resources and coins.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TOOL_ORDER.map((t) => {
            const def = TOOLS[t];
            const tier = hero.tools[t] ?? 1;
            const maxed = tier >= MAX_TIER;
            const cost = toolUpgradeCost(tier);
            const affordable =
              empire.coins >= (cost.coins ?? 0) &&
              RESOURCE_ORDER.every((k) => empire.resources[k] >= (cost[k] ?? 0));
            const bonusPct = Math.round((tier - 1) * 30);
            return (
              <div key={t} className="panel p-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{def.icon}</span>
                  <div>
                    <div className="font-semibold text-parchment-100">{def.name}</div>
                    <div className="text-xs" style={{ color: tier >= 4 ? "#e8c75a" : "#9b9384" }}>
                      {TIER_NAMES[tier]} · tier {tier}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-parchment-300/65">
                  {t === "sword" ? `+${bonusPct}% hero damage` : `+${bonusPct}% gather yield`} ·{" "}
                  {SKILLS[def.skill].name}
                </div>

                {maxed ? (
                  <div className="mt-3 rounded-lg bg-black/20 py-2 text-center text-xs text-gold-light">
                    ★ Finest tier ({TIER_NAMES[MAX_TIER]})
                  </div>
                ) : (
                  <>
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                      {RESOURCE_ORDER.filter((k) => cost[k]).map((k) => (
                        <span
                          key={k}
                          className={empire.resources[k] >= (cost[k] ?? 0) ? "text-parchment-200" : "text-blood-light"}
                        >
                          {RESOURCE_META[k].icon} {cost[k]}
                        </span>
                      ))}
                      <span className={empire.coins >= (cost.coins ?? 0) ? "text-gold-light" : "text-blood-light"}>
                        🪙 {cost.coins}
                      </span>
                    </div>
                    <button
                      className="btn-gold btn-sm mt-3 w-full"
                      disabled={!affordable}
                      onClick={() => upgradeTool(t)}
                    >
                      ⬆ Upgrade to {TIER_NAMES[tier + 1]}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* current gather rates */}
      <div>
        <h3 className="mb-3 font-display text-lg font-semibold">Current gather yield</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RESOURCE_ORDER.map((k) => {
            const skillId = k === "wood" ? "woodcutting" : k === "food" ? "foraging" : "mining";
            const toolId = k === "wood" ? "axe" : k === "food" ? "sickle" : "pickaxe";
            const y = gatherYield(levelForXp(hero.skills[skillId] ?? 0), hero.tools[toolId as keyof typeof hero.tools] ?? 1);
            return (
              <div key={k} className="panel flex items-center justify-between p-3">
                <span>{RESOURCE_META[k as ResourceKind].icon} {RESOURCE_META[k as ResourceKind].label}</span>
                <span className="font-semibold text-emerald-300">+{y}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold text-gold-light">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-parchment-300/55">{label}</div>
    </div>
  );
}
