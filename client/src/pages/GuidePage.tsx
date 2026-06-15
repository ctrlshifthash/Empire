import { Link } from "react-router-dom";
import {
  AGES,
  AGE_ORDER,
  BUILDING_TYPES,
  BUILDINGS,
  RANKS,
  REWARD_TIERS,
  UNITS,
  UNIT_TYPES,
} from "@shared/gamedata";
import { AGE_META, RESOURCE_META, RESOURCE_ORDER } from "../lib/format";
import type { Resources } from "@shared/types";

function CostStr({ cost }: { cost: Partial<Resources> }) {
  const parts = RESOURCE_ORDER.filter((k) => cost[k]).map(
    (k) => `${RESOURCE_META[k].icon} ${cost[k]}`,
  );
  return <span>{parts.length ? parts.join("  ") : "—"}</span>;
}

export default function GuidePage() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-grid opacity-10" />
      <div className="container-x relative max-w-4xl py-16">
        <div className="text-center">
          <span className="kicker">📖 The strategist’s handbook</span>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
            How to Play <span className="text-gold-gradient">Empires Eternal</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-parchment-300/70">
            Everything you need to rise from a lone settlement to a world-spanning empire.
          </p>
        </div>

        <Section title="The world & the project" icon="🌍">
          <p>
            Empires Eternal is a persistent online strategy game inspired by the classic{" "}
            <em>Age of Empires</em>. Every player rules an empire placed on one shared world map.
            Unlike a match that ends, this world is <strong>always running</strong> — your buildings
            keep producing resources and your armies keep marching 24/7, whether you are online or
            not. Come back any time to find your realm has grown and your rivals have made their
            moves.
          </p>
        </Section>

        <Section title="Getting in: wallet, email or demo" icon="🔑">
          <p>There are no passwords — choose how you sign in:</p>
          <ul className="ml-5 list-disc space-y-2">
            <li><strong>Solana wallet</strong> (Phantom &amp; friends) — your empire is tied to your address, and your token holdings unlock real SOL rewards.</li>
            <li><strong>Email</strong> — get a full empire now, connect a wallet later from the dashboard to start earning.</li>
            <li><strong>Demo mode</strong> — one click, no wallet, worthless in-game coins. Perfect for learning the ropes.</li>
          </ul>
        </Section>

        <Section title="The core loop" icon="🔄">
          <ol className="ml-5 list-decimal space-y-2">
            <li><strong>Gather</strong> — build economy structures that produce wood, food, gold and stone over time.</li>
            <li><strong>Build</strong> — spend resources to raise and upgrade buildings in your settlement.</li>
            <li><strong>Advance</strong> — research the next age to unlock stronger buildings and units.</li>
            <li><strong>Train</strong> — raise an army of spearmen, archers and knights.</li>
            <li><strong>Raid</strong> — march on rival empires to plunder their resources, and defend your own.</li>
            <li><strong>Progress</strong> — complete quests for coins, then spend coins to rush construction and research.</li>
          </ol>
        </Section>

        <Section title="Resources" icon="💰">
          <div className="grid gap-3 sm:grid-cols-2">
            {RESOURCE_ORDER.map((k) => (
              <div key={k} className="flex items-center gap-3 rounded-lg border border-parchment-300/10 bg-black/20 px-4 py-3">
                <span className="text-2xl">{RESOURCE_META[k].icon}</span>
                <div>
                  <div className="font-semibold">{RESOURCE_META[k].label}</div>
                  <div className="text-xs text-parchment-300/60">
                    {k === "wood" && "Construction backbone — almost every building needs it."}
                    {k === "food" && "Feeds your population and trains most units."}
                    {k === "gold" && "Funds advanced units, research and trade."}
                    {k === "stone" && "Walls, keeps and advancing through the later ages."}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Buildings" icon="🏗️">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-parchment-300/55">
                <tr className="border-b border-parchment-300/10">
                  <th className="py-2 pr-3">Building</th>
                  <th className="py-2 pr-3">Base cost</th>
                  <th className="py-2 pr-3">Effect</th>
                  <th className="py-2">Age</th>
                </tr>
              </thead>
              <tbody>
                {BUILDING_TYPES.map((t) => {
                  const b = BUILDINGS[t];
                  return (
                    <tr key={t} className="border-b border-parchment-300/5">
                      <td className="py-2 pr-3 font-medium">
                        <span className="mr-1.5">{b.icon}</span>
                        {b.name}
                      </td>
                      <td className="py-2 pr-3 text-parchment-300/75">
                        <CostStr cost={b.baseCost} />
                      </td>
                      <td className="py-2 pr-3 text-parchment-300/70">
                        {b.produces
                          ? `+${b.produces.perMinute}/min ${b.produces.kind}`
                          : b.populationProvided
                            ? `+${b.populationProvided} population`
                            : b.trains
                              ? `Trains ${b.trains.map((u) => UNITS[u].name).join(", ")}`
                              : b.defenseBonus
                                ? `+${Math.round(b.defenseBonus * 100)}% defense / level`
                                : "—"}
                      </td>
                      <td className="py-2" style={{ color: AGE_META[b.requiresAge].color }}>
                        {AGE_META[b.requiresAge].short}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Units & combat" icon="⚔️">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-parchment-300/55">
                <tr className="border-b border-parchment-300/10">
                  <th className="py-2 pr-3">Unit</th>
                  <th className="py-2 pr-3">Cost</th>
                  <th className="py-2 pr-3">Atk</th>
                  <th className="py-2 pr-3">Def</th>
                  <th className="py-2 pr-3">HP</th>
                  <th className="py-2">Age</th>
                </tr>
              </thead>
              <tbody>
                {UNIT_TYPES.map((t) => {
                  const u = UNITS[t];
                  return (
                    <tr key={t} className="border-b border-parchment-300/5">
                      <td className="py-2 pr-3 font-medium">
                        <span className="mr-1.5">{u.icon}</span>
                        {u.name}
                      </td>
                      <td className="py-2 pr-3 text-parchment-300/75">
                        <CostStr cost={u.cost} />
                      </td>
                      <td className="py-2 pr-3 text-blood-light">{u.attack}</td>
                      <td className="py-2 pr-3 text-royal-light">{u.defense}</td>
                      <td className="py-2 pr-3 text-emerald-300">{u.hp}</td>
                      <td className="py-2" style={{ color: AGE_META[u.requiresAge].color }}>
                        {AGE_META[u.requiresAge].short}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-parchment-300/70">
            When you attack, the stronger side wins. Attackers use <strong>attack</strong> power;
            defenders fight with their <strong>defense</strong> power, boosted by walls and a home
            advantage. Winners take loot up to their army’s carry capacity; the losing army takes
            heavy casualties. Keep some troops and walls at home to defend against raids.
          </p>
        </Section>

        <Section title="Defend your realm" icon="🛡️">
          <p>
            Raids cut both ways — keep troops at home and barricade your territory with{" "}
            <strong>walls, towers and gates</strong>. Defenders fight with their defense power, boosted by your walls and
            a home-ground advantage, so a well-fortified base can turn back a much larger army. Buildings razed in a raid
            weaken the loser, so fortify before you over-extend.
          </p>
        </Section>

        <Section title="The four ages" icon="⏳">
          <div className="grid gap-3 sm:grid-cols-2">
            {AGE_ORDER.map((id) => (
              <div key={id} className="rounded-lg border border-parchment-300/10 bg-black/20 p-4">
                <div className="font-display font-bold" style={{ color: AGE_META[id].color }}>
                  {AGES[id].name}
                </div>
                <div className="mt-1 text-sm text-parchment-300/70">{AGES[id].blurb}</div>
                <div className="mt-2 text-xs text-parchment-300/55">
                  {AGES[id].order === 0 ? "Your starting age." : (
                    <>Research cost: <CostStr cost={AGES[id].cost} /></>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Quests & coins" icon="📜">
          <p>
            As your empire grows you will complete quests automatically — building your first lumber
            camp, fielding an army, reaching a new age and more. Claim each completed quest for{" "}
            <strong>coins</strong> and resource rewards. Coins are precious: spend them to{" "}
            <strong>rush</strong> any construction, training or age research to finish instantly.
          </p>
        </Section>

        <Section title="Hero, shop & traits" icon="🎖️">
          <p>
            Spend coins in the <strong>shop</strong> on weapons and armour for your units, plus a helmet and armour for
            your hero (extra HP) — gear shows on your hero’s portrait. Learn <strong>traits</strong> for lasting perks:
            some are free (Hardy, Keen Eye, Brawler), others cost coins and boost HP, harvest yield or hero damage.
          </p>
        </Section>

        <Section title="Renown ranks" icon="⚜️">
          <p>
            Your <strong>power</strong> places you on the renown ladder. Each rank grants a permanent{" "}
            <strong>harvest bonus</strong>, so winning and building pays off forever.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-parchment-300/55">
                <tr className="border-b border-parchment-300/10">
                  <th className="py-2 pr-3">Rank</th>
                  <th className="py-2 pr-3">Power</th>
                  <th className="py-2">Harvest bonus</th>
                </tr>
              </thead>
              <tbody>
                {RANKS.map((r) => (
                  <tr key={r.name} className="border-b border-parchment-300/5">
                    <td className="py-2 pr-3 font-medium">{r.name}</td>
                    <td className="py-2 pr-3 text-parchment-300/75">{r.minPower.toLocaleString()}</td>
                    <td className="py-2 text-gold-light">{r.gatherMult.toFixed(2)}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Token rewards & holder tiers" icon="💰">
          <p>
            A pool of <strong className="text-gold-light">1 SOL per day</strong> (one pool for everyone) is split{" "}
            <strong>pro-rata</strong> among token holders, then boosted by your <strong>holder tier</strong>. Holdings are
            read live on-chain; rewards accrue continuously and pay out in <strong>real SOL on Solana mainnet</strong>.
            Your first claim is available any time, then once every 6 hours.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-parchment-300/55">
                <tr className="border-b border-parchment-300/10">
                  <th className="py-2 pr-3">Tier</th>
                  <th className="py-2 pr-3">Supply share</th>
                  <th className="py-2">Multiplier</th>
                </tr>
              </thead>
              <tbody>
                {REWARD_TIERS.map((t) => (
                  <tr key={t.name} className="border-b border-parchment-300/5">
                    <td className="py-2 pr-3 font-semibold" style={{ color: t.color }}>
                      ● {t.name}
                    </td>
                    <td className="py-2 pr-3 text-parchment-300/75">
                      {t.minShare === 0 ? "any holder" : `≥ ${(t.minShare * 100).toFixed(t.minShare < 0.01 ? 1 : 0)}%`}
                    </td>
                    <td className="py-2 text-gold-light">{t.multiplier.toFixed(2)}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-parchment-300/70">
            Track your holdings, tier and claimable SOL on your{" "}
            <Link to="/dashboard" className="text-gold-light hover:underline">dashboard</Link>, and read the full
            breakdown in the <Link to="/docs" className="text-gold-light hover:underline">docs</Link>.
          </p>
        </Section>

        <div className="mt-14 rounded-2xl border border-gold/25 bg-gradient-to-br from-ink-700 to-ink-800 p-8 text-center shadow-deep">
          <h3 className="text-2xl font-bold">Ready to rule?</h3>
          <p className="mx-auto mt-3 max-w-md text-parchment-300/75">
            Found your empire and the world will remember your name.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/register" className="btn-gold px-7 py-3">
              ⚔ Found Your Empire
            </Link>
            <Link to="/play" className="btn-ghost px-7 py-3">
              Enter the world
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="flex items-center gap-3 text-2xl font-bold">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-gold/25 to-transparent text-xl ring-1 ring-gold/20">
          {icon}
        </span>
        {title}
      </h2>
      <div className="mt-4 space-y-3 leading-relaxed text-parchment-300/85">{children}</div>
    </section>
  );
}
