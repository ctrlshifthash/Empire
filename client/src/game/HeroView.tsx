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
import { HELMET_HP, HERO_ARMOUR_HP, MAX_HERO_GEAR, TRAITS, heroGearCost, traitBonuses } from "@shared/gamedata";
import { RESOURCE_META, RESOURCE_ORDER, fmt } from "../lib/format";
import { useGame } from "../lib/store";
import { ProgressBar } from "./ui";
import HeroPreview from "./HeroPreview";

export default function HeroView({ empire }: { empire: Empire }) {
  const upgradeTool = useGame((s) => s.upgradeTool);
  const buyArmoury = useGame((s) => s.buyArmoury);
  const buyTrait = useGame((s) => s.buyTrait);
  const hero = empire.hero;
  if (!hero) return null;

  const combatLvl = levelForXp(hero.skills.combat ?? 0);
  const helmet = empire.armoury?.helmet ?? 0;
  const heroArmour = empire.armoury?.heroArmour ?? 0;
  const gearHp = helmet * HELMET_HP + heroArmour * HERO_ARMOUR_HP;
  const tb = traitBonuses(empire.traits);
  const owned = new Set(empire.traits ?? []);
  const baseHp = heroMaxHp(combatLvl);
  const maxHp = baseHp + gearHp + tb.hp;
  const dmg = Math.round((heroDamage(combatLvl, hero.tools.sword ?? 1) + tb.dmg) * (1 + tb.dmgPct));

  return (
    <div className="space-y-6">
      {/* hero summary — with a live portrait of your character */}
      <div className="panel flex flex-wrap items-center gap-6 p-5">
        <div className="flex items-center gap-4">
          <div className="h-28 w-24 overflow-hidden rounded-xl bg-gradient-to-br from-gold/20 to-black/30 ring-1 ring-gold/30">
            <HeroPreview helmet={helmet} armour={heroArmour} />
          </div>
          <div>
            <div className="font-display text-xl font-bold">{empire.name}'s Champion</div>
            <div className="text-sm text-parchment-300/70">Total level {heroLevel(hero)}</div>
            <div className="mt-1 text-xs text-parchment-300/55">
              🗡️ Sword {hero.tools.sword ?? 1} · ⛑️ Helmet {helmet} · 🦺 Armour {heroArmour}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <Stat label="Combat lvl" value={combatLvl} />
          <Stat label="Hero damage" value={dmg} />
          <div>
            <div className="font-display text-2xl font-bold text-gold-light">{maxHp}</div>
            <div className="text-[11px] uppercase tracking-wider text-parchment-300/55">Max HP</div>
            <div className="text-[10px] text-parchment-300/45">
              {baseHp} base{gearHp ? ` +${gearHp} gear` : ""}{tb.hp ? ` +${tb.hp} traits` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* hero equipment — customise your character with coins */}
      <div>
        <h3 className="mb-1 font-display text-lg font-semibold">🛡️ Equipment</h3>
        <p className="mb-3 text-sm text-parchment-300/60">
          Outfit your champion with coins. Your sword is below in Tools; a helmet and armour raise your max HP and
          change how your hero looks in the world.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <GearCard
            icon="⛑️"
            name="Helmet"
            level={helmet}
            bonus={`+${helmet * HELMET_HP} max HP`}
            cost={heroGearCost(helmet)}
            coins={empire.coins}
            maxed={helmet >= MAX_HERO_GEAR}
            onBuy={() => buyArmoury("helmet")}
          />
          <GearCard
            icon="🦺"
            name="Body Armour"
            level={heroArmour}
            bonus={`+${heroArmour * HERO_ARMOUR_HP} max HP`}
            cost={heroGearCost(heroArmour)}
            coins={empire.coins}
            maxed={heroArmour >= MAX_HERO_GEAR}
            onBuy={() => buyArmoury("heroArmour")}
          />
        </div>
      </div>

      {/* traits / perks — free & paid */}
      <div>
        <h3 className="mb-1 font-display text-lg font-semibold">✨ Traits</h3>
        <p className="mb-3 text-sm text-parchment-300/60">
          Permanent perks for your champion. Some are free to learn; stronger ones cost coins.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TRAITS.map((t) => {
            const have = owned.has(t.id);
            const free = t.cost === 0;
            const afford = empire.coins >= t.cost;
            return (
              <div key={t.id} className={`panel p-3 ${have ? "ring-1 ring-emerald-500/40" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-parchment-100">{t.name}</div>
                    <div className="text-xs text-emerald-300/85">{t.desc}</div>
                  </div>
                </div>
                {have ? (
                  <div className="mt-2 rounded-md bg-emerald-500/10 py-1.5 text-center text-xs font-semibold text-emerald-300">
                    ✓ Active
                  </div>
                ) : (
                  <button
                    className={`mt-2 w-full rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${
                      free
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                        : afford
                          ? "border-gold/40 bg-gold/10 text-gold-light hover:bg-gold/20"
                          : "border-parchment-300/10 text-parchment-300/40"
                    }`}
                    disabled={!free && !afford}
                    onClick={() => buyTrait(t.id)}
                  >
                    {free ? "Learn — Free" : `Learn — 🪙 ${t.cost}`}
                  </button>
                )}
              </div>
            );
          })}
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

function GearCard({
  icon,
  name,
  level,
  bonus,
  cost,
  coins,
  maxed,
  onBuy,
}: {
  icon: string;
  name: string;
  level: number;
  bonus: string;
  cost: number;
  coins: number;
  maxed: boolean;
  onBuy: () => void;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="font-semibold text-parchment-100">{name}</div>
          <div className="text-xs text-gold-light">
            Level {level}/{MAX_HERO_GEAR}
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs text-emerald-300">{bonus}</div>
      {maxed ? (
        <div className="mt-3 rounded-lg bg-black/20 py-2 text-center text-xs text-gold-light">★ Maxed out</div>
      ) : (
        <button className="btn-gold btn-sm mt-3 w-full" disabled={coins < cost} onClick={onBuy}>
          ⬆ Upgrade — 🪙 {cost}
        </button>
      )}
    </div>
  );
}
