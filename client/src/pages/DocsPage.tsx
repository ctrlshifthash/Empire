import { Link } from "react-router-dom";
import { RANKS, BOT_TIERS, REWARD_TIERS } from "@shared/gamedata";

// A single documentation section with an anchor + icon header.
function Section({ id, title, icon, children }: { id: string; title: string; icon: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
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

const TOC = [
  ["overview", "What is Realm Rumble"],
  ["getin", "Getting in: wallet, email or demo"],
  ["loop", "The core game loop"],
  ["defend", "Defending your realm"],
  ["hero", "Hero, shop & traits"],
  ["ranks", "Renown ranks"],
  ["enemies", "Enemy empires & difficulty tiers"],
  ["rewards", "Token rewards & payouts"],
  ["tiers", "Holder tiers"],
  ["claim", "Claiming your SOL"],
  ["dashboard", "Your dashboard"],
  ["trust", "Mainnet, treasury & fairness"],
];

export default function DocsPage() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-grid opacity-10" />
      <div className="container-x relative max-w-4xl py-16">
        <div className="text-center">
          <span className="kicker">📚 Documentation</span>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
            The <span className="text-gold-gradient">Realm Rumble</span> docs
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-parchment-300/70">
            Everything about the project — how the game works, how the economy and combat play out, and exactly how the
            Solana token rewards, holder tiers and payouts are calculated.
          </p>
        </div>

        {/* table of contents */}
        <div className="mt-10 rounded-2xl border border-parchment-300/10 bg-ink-800/60 p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-parchment-300/55">Contents</div>
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {TOC.map(([id, label], i) => (
              <a key={id} href={`#${id}`} className="text-sm text-parchment-200 hover:text-gold-light">
                {String(i + 1).padStart(2, "0")} · {label}
              </a>
            ))}
          </div>
        </div>

        <Section id="overview" title="What is Realm Rumble" icon="🌍">
          <p>
            Realm Rumble is a persistent, browser-based strategy game. You rule
            one empire on a single shared world map. Unlike a match that ends, this world is <strong>always running</strong>{" "}
            — your buildings produce resources and your armies march around the clock, whether you are online or not.
          </p>
          <p>
            It is also <strong>token-gated with real rewards</strong>. Hold the game token and a slice of a daily{" "}
            <strong>1 SOL</strong> pool accrues to your wallet, claimable as Solana. Don’t hold the token? You can
            still play the full game in <strong>demo mode</strong> with worthless in-game coins.
          </p>
        </Section>

        <Section id="getin" title="Getting in: wallet, email or demo" icon="🔑">
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong>Solana wallet (Phantom etc.)</strong> — sign in with your wallet via Privy. Your empire is created
              automatically and tied to your address, and your holdings unlock token rewards.
            </li>
            <li>
              <strong>Email</strong> — sign in with email through Privy. You get a full empire; connect a wallet later on
              the dashboard to start earning.
            </li>
            <li>
              <strong>Demo mode</strong> — one click, no wallet. A throwaway empire with worthless in-game coins so you
              can learn the game. No real rewards.
            </li>
          </ul>
          <p>The same wallet or email always returns to the same empire — there are no passwords.</p>
        </Section>

        <Section id="loop" title="The core game loop" icon="🔄">
          <ol className="ml-5 list-decimal space-y-2">
            <li><strong>Gather</strong> — raise lumber camps, farms, mines and quarries that produce wood, food, gold and stone every second.</li>
            <li><strong>Build</strong> — spend resources to place and upgrade buildings in your settlement.</li>
            <li><strong>Advance</strong> — research through four ages (Dark → Feudal → Castle → Imperial) to unlock stronger buildings and units.</li>
            <li><strong>Train</strong> — field spearmen, archers and knights.</li>
            <li><strong>Raid</strong> — march on rival empires to plunder resources. You can <strong>spectate the battle live</strong> in the isometric world and watch buildings get razed.</li>
            <li><strong>Progress</strong> — complete quests for coins, climb the renown ranks, and earn harvest multipliers as you rise.</li>
          </ol>
          <p className="text-sm text-parchment-300/70">
            See the <Link to="/guide" className="text-gold-light hover:underline">full handbook</Link> for the building,
            unit and age tables.
          </p>
        </Section>

        <Section id="defend" title="Defending your realm" icon="🛡️">
          <p>
            Raids cut both ways — rivals will march on you. Barricade your territory with <strong>walls, towers and
            gates</strong>, and keep a standing army at home. Defenders fight with their defense power, boosted by your
            walls and a home-ground advantage. Buildings that get razed in a raid weaken the loser, so fortify before
            you expand.
          </p>
        </Section>

        <Section id="hero" title="Hero, shop & traits" icon="🎖️">
          <ul className="ml-5 list-disc space-y-2">
            <li><strong>Shop / Armoury</strong> — spend coins on weapons and armour for your units, and a helmet &amp; armour for your hero (extra HP). Gear shows on your hero’s portrait.</li>
            <li><strong>Traits</strong> — learn perks: some are free (Hardy, Keen Eye, Brawler), others cost coins. They boost HP, harvest yield and hero damage.</li>
            <li><strong>Hero customization</strong> — outfit the character you play as and see the look update live.</li>
          </ul>
        </Section>

        <Section id="ranks" title="Renown ranks" icon="⚜️">
          <p>
            Your <strong>power</strong> (a score from your buildings, army and conquests) places you on the renown ladder.
            Higher ranks grant a permanent <strong>harvest bonus</strong>, rewarding players who build, win and gather.
          </p>
          <Table head={["Rank", "Power required", "Harvest bonus"]}>
            {RANKS.map((r) => (
              <tr key={r.name} className="border-b border-parchment-300/5">
                <td className="py-2 pr-3 font-medium text-parchment-100">{r.name}</td>
                <td className="py-2 pr-3 text-parchment-300/75">{r.minPower.toLocaleString()}</td>
                <td className="py-2 text-gold-light">{r.gatherMult.toFixed(2)}×</td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section id="enemies" title="Enemy empires & difficulty tiers" icon="🤖">
          <p>
            The world is seeded with AI empires across difficulty tiers so there is always something to fight — from
            defenceless hamlets to fearsome conquerors. Weaker empires are far more common, so you always have someone to
            farm for loot and power, while the top tiers offer a real challenge.
          </p>
          <Table head={["Tier", "Name", "Strength (power cap)", "How common"]}>
            {BOT_TIERS.map((t) => {
              const total = BOT_TIERS.reduce((s, b) => s + b.weight, 0);
              return (
                <tr key={t.tier} className="border-b border-parchment-300/5">
                  <td className="py-2 pr-3 font-medium text-parchment-100">{t.tier}</td>
                  <td className="py-2 pr-3 text-parchment-200">{t.rank}</td>
                  <td className="py-2 pr-3 text-parchment-300/75">
                    {t.powerCap >= 99999 ? "Unlimited" : `up to ${t.powerCap.toLocaleString()}`}
                  </td>
                  <td className="py-2 text-parchment-300/75">{Math.round((t.weight / total) * 100)}%</td>
                </tr>
              );
            })}
          </Table>
        </Section>

        <Section id="rewards" title="Token rewards & payouts" icon="💰">
          <p>
            A total pool of <strong className="text-gold-light">1 SOL per day</strong> is shared among all token holders —
            this is one pool for everyone, not per player. Your slice is <strong>pro-rata</strong> to how much of the
            supply you hold, then boosted by your holder tier:
          </p>
          <div className="rounded-xl border border-gold/25 bg-black/30 p-4 text-center font-mono text-sm text-parchment-100">
            your&nbsp;daily&nbsp;SOL&nbsp;=&nbsp;(your&nbsp;tokens&nbsp;÷&nbsp;total&nbsp;supply)&nbsp;×&nbsp;1&nbsp;SOL&nbsp;×&nbsp;tier&nbsp;multiplier
          </div>
          <p>
            The total paid out is <strong>hard-capped at 1 SOL per day</strong> across everyone — the tier multiplier
            sets how fast you accrue (your claim priority), not extra SOL on top of the pool. Once the day’s pool is
            used up, claims resume the next day.
          </p>
          <p>
            Holdings are read directly <strong>on-chain</strong> from the connected wallet (your SPL-token balance vs. the
            circulating supply). Rewards <strong>accrue continuously</strong> from the moment you’re first seen holding —
            you don’t have to be online.
          </p>
        </Section>

        <Section id="tiers" title="Holder tiers" icon="◆">
          <p>
            Holders are sorted into tiers by their <strong>share of circulating supply</strong>. The tier sets the
            multiplier applied on top of your pro-rata slice — the more you hold, the higher the tier, the bigger the
            boost (up to 3×). Your current tier is shown on your dashboard.
          </p>
          <Table head={["Tier", "Supply share", "Multiplier", "Notes"]}>
            {REWARD_TIERS.map((t) => (
              <tr key={t.name} className="border-b border-parchment-300/5">
                <td className="py-2 pr-3 font-semibold" style={{ color: t.color }}>
                  ● {t.name}
                </td>
                <td className="py-2 pr-3 text-parchment-300/75">
                  {t.minShare === 0 ? "any holder" : `≥ ${(t.minShare * 100).toFixed(t.minShare < 0.01 ? 1 : 0)}%`}
                </td>
                <td className="py-2 pr-3 text-gold-light">{t.multiplier.toFixed(2)}×</td>
                <td className="py-2 text-parchment-300/70">{t.blurb}</td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section id="claim" title="Claiming your SOL" icon="💸">
          <ul className="ml-5 list-disc space-y-2">
            <li>Your <strong>first claim</strong> is available any time.</li>
            <li>After that, you can claim <strong>once every 6 hours</strong> (4× a day). The button shows a live countdown until your next claim unlocks.</li>
            <li>Rewards keep accruing between claims, so there’s no penalty for claiming less often.</li>
            <li>Claims pay <strong>SOL on Solana mainnet</strong>, sent straight from the treasury to your wallet.</li>
          </ul>
        </Section>

        <Section id="dashboard" title="Your dashboard" icon="📊">
          <p>
            The <Link to="/dashboard" className="text-gold-light hover:underline">dashboard</Link> brings your whole empire
            into one view: rank and progress, power, time played, army size, raids won/lost, win rate, buildings razed and
            more — alongside your reward cards (claimable, total earned, daily rate and boost tier), the full holder-tier
            ladder with your current tier highlighted, and the claim button.
          </p>
        </Section>

        <Section id="trust" title="Mainnet, treasury & fairness" icon="🔒">
          <ul className="ml-5 list-disc space-y-2">
            <li>Everything runs on <strong>Solana mainnet</strong> — clearly badged on the dashboard.</li>
            <li>Payouts come from a dedicated <strong>treasury wallet</strong> that funds the daily pool.</li>
            <li>The pool is fixed at 1 SOL/day total and split pro-rata, so rewards scale fairly with real on-chain holdings.</li>
            <li>Non-holders and demo players earn no SOL — the in-game economy stays separate from real rewards.</li>
          </ul>
        </Section>

        <div className="mt-14 rounded-2xl border border-gold/25 bg-gradient-to-br from-ink-700 to-ink-800 p-8 text-center shadow-deep">
          <h3 className="text-2xl font-bold">Ready to play &amp; earn?</h3>
          <p className="mx-auto mt-3 max-w-md text-parchment-300/75">
            Sign in with your wallet to start earning, or jump into demo mode to learn the ropes.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/login" className="btn-gold px-7 py-3">
              ⚔ Enter the World
            </Link>
            <Link to="/dashboard" className="btn-ghost px-7 py-3">
              Open dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-parchment-300/55">
          <tr className="border-b border-parchment-300/10">
            {head.map((h) => (
              <th key={h} className="py-2 pr-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
