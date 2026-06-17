import { Link } from "react-router-dom";
import {
  RANKS,
  BOT_TIERS,
  REWARD_TIERS,
  ACHIEVEMENTS,
  SHOP_ITEMS,
  ALLIANCE_MAX_MEMBERS,
  ALLIANCE_CREATE_COST,
  MAX_ARMOUR,
  RAID_SHIELD_RATIO,
} from "@shared/gamedata";

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
  ["raids", "Raiding & matchmaking"],
  ["defend", "Defending your realm"],
  ["boss", "World Boss events"],
  ["alliances", "Alliances"],
  ["hero", "Hero, armoury & traits"],
  ["shop", "Token shop"],
  ["ranks", "Renown ranks"],
  ["titles", "Achievements & titles"],
  ["enemies", "Enemy empires & difficulty tiers"],
  ["rewards", "Token rewards & payouts"],
  ["tiers", "Holder tiers"],
  ["governance", "Governance: holders vote"],
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
          <p>
            Around that core sit the systems that make the world feel alive: <strong>fair-bracket raiding</strong>,{" "}
            server-wide <strong>World Boss</strong> events, <strong>alliances</strong> with a shared war room,{" "}
            a <strong>token shop</strong>, <strong>achievements</strong>, and <strong>token-holder governance</strong>{" "}
            where you vote on what gets built next. Each is covered below.
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

        <Section id="raids" title="Raiding & matchmaking" icon="🗡️">
          <p>
            You raid by marching armies on a rival empire and plundering their resources. But you can’t farm the
            helpless: the <strong>Attack</strong> tab only lists targets inside your <strong>bracket</strong>, and the
            rules are enforced on the server.
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong>The shield</strong> — a real player far weaker than you (below {Math.round(RAID_SHIELD_RATIO * 100)}% of
              your power) can’t be raided. This stops strong empires from bullying newcomers.
            </li>
            <li>
              <strong>Reach</strong> — empires far stronger than you are <strong>locked</strong> until you grow. Your
              reach widens as your renown rank climbs, so tougher targets unlock the more you play.
            </li>
            <li>
              <strong>Bots are always fair game</strong> — there’s always something to fight while you climb.
            </li>
            <li>
              <strong>Allies are off-limits</strong> — you can never raid a member of your own alliance.
            </li>
          </ul>
          <p className="text-sm text-parchment-300/70">
            You can <strong>spectate the battle live</strong> in the isometric world. Survivors march home with the loot.
          </p>
        </Section>

        <Section id="defend" title="Defending your realm" icon="🛡️">
          <p>
            Raids cut both ways — rivals within your bracket can march on you. Your defense comes from three places:
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong>A standing army at home</strong> — units left in your settlement fight as defenders, with a
              home-ground advantage.
            </li>
            <li>
              <strong>Armour</strong> — bought in the Armoury, armour now climbs to <strong>{MAX_ARMOUR} named tiers</strong>{" "}
              (Padded → Royal Plate), higher than weapons can reach, so a defender who invests can out-armour an
              attacker’s weapons and survive.
            </li>
            <li>
              <strong>The shield</strong> — being under-strength relative to a would-be attacker protects you outright.
            </li>
          </ul>
          <p className="text-sm text-parchment-300/70">
            Buildings can be <strong>demolished</strong> for a 50% refund (or to cancel a misplaced build) from the
            Buildings tab — the Town Centre is your core and can’t be torn down.
          </p>
        </Section>

        <Section id="boss" title="World Boss events" icon="👹">
          <p>
            A single <strong>World Boss</strong> rises for the entire server at once — one enemy, one shared health bar,
            the whole realm against it. Everyone fights the same boss from the <strong>World Boss</strong> tab.
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li><strong>Commit your army to strike it</strong> — your damage scales with your troops and weapon upgrades.</li>
            <li><strong>It costs you</strong> — you lose a share of every army you commit, and there’s a short cooldown between strikes.</li>
            <li><strong>Live damage board</strong> — every challenger’s damage is ranked in real time.</li>
            <li><strong>Spoils on the kill</strong> — when it falls, in-game coins &amp; resources are split by damage dealt, with a bonus for the top dealer. A tougher boss respawns a few minutes later.</li>
          </ul>
          <p className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-sm">
            World Boss spoils are <strong>in-game only</strong> (coins &amp; resources). No SOL is paid here — the 1 SOL/day
            token pool is never touched by the boss.
          </p>
        </Section>

        <Section id="alliances" title="Alliances" icon="🤝">
          <p>
            Band together with other rulers. Found an alliance for <strong>{ALLIANCE_CREATE_COST.toLocaleString()} coins</strong>{" "}
            (a unique 2–5 character tag), or join an open one — up to <strong>{ALLIANCE_MAX_MEMBERS} members</strong>.
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li><strong>Allies can’t raid each other</strong> — enforced in combat and hidden from each other’s target lists.</li>
            <li><strong>Shared war room</strong> — a live alliance chat to coordinate.</li>
            <li><strong>Roster</strong> — see every member’s rank, power and online status; the leader can remove members or disband.</li>
            <li><strong>Alliance leaderboard</strong> — crews compete by combined power on the <Link to="/leaderboard" className="text-gold-light hover:underline">Leaderboard</Link> (Players / Alliances toggle).</li>
          </ul>
        </Section>

        <Section id="hero" title="Hero, armoury & traits" icon="🎖️">
          <ul className="ml-5 list-disc space-y-2">
            <li><strong>Armoury</strong> — spend coins on weapons (attack) and armour (defense) for your units, plus a helmet &amp; armour for your hero. Armour climbs to {MAX_ARMOUR} named tiers, so investing in defense really pays off.</li>
            <li><strong>Traits</strong> — learn perks: some are free (Hardy, Keen Eye, Brawler), others cost coins. They boost HP, harvest yield and hero damage. A few elite traits are token-only (see the Token Shop).</li>
            <li><strong>Hero customization</strong> — outfit the character you play as and see the look update live.</li>
          </ul>
        </Section>

        <Section id="shop" title="Token shop" icon="💎">
          <p>
            The <strong>Token Shop</strong> lets you spend the project token on in-game items. Each purchase is a{" "}
            <strong>real on-chain transfer</strong> of the token to the treasury, verified by the server (correct mint,
            amount, recipient and signer; each payment is single-use) before the item is granted. You need a connected
            wallet that holds the token.
          </p>
          <Table head={["Item", "Category", "What it does"]}>
            {SHOP_ITEMS.map((it) => (
              <tr key={it.id} className="border-b border-parchment-300/5">
                <td className="py-2 pr-3 font-medium text-parchment-100">{it.icon} {it.name}</td>
                <td className="py-2 pr-3 capitalize text-parchment-300/70">{it.category}</td>
                <td className="py-2 text-parchment-300/75">{it.desc}</td>
              </tr>
            ))}
          </Table>
          <p className="text-sm text-parchment-300/70">
            Spent tokens go to the treasury, creating real buy-and-sink pressure on the token.
          </p>
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

        <Section id="titles" title="Achievements & titles" icon="🏅">
          <p>
            Milestones unlock automatically as your empire grows and are logged the moment you earn them. Track them on
            the <strong>Titles</strong> tab.
          </p>
          <Table head={["Title", "How to unlock"]}>
            {ACHIEVEMENTS.map((a) => (
              <tr key={a.id} className="border-b border-parchment-300/5">
                <td className="py-2 pr-3 font-medium text-parchment-100">{a.icon} {a.name}</td>
                <td className="py-2 text-parchment-300/75">{a.desc}</td>
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
            your&nbsp;daily&nbsp;SOL&nbsp;=&nbsp;(tokens&nbsp;÷&nbsp;supply)&nbsp;×&nbsp;1&nbsp;SOL&nbsp;×&nbsp;tier&nbsp;multiplier&nbsp;×&nbsp;play&nbsp;bonus
          </div>
          <p>
            <strong>Reward for playing, not just holding.</strong> Your accrual is also boosted by a{" "}
            <strong>play bonus</strong> equal to your empire’s renown rank — the same ladder you climb by building,
            winning and conquering (1× as a Peasant up to 2.5× as an Emperor). So the harder you play, the bigger your
            slice of the pool.
          </p>
          <p>
            The total paid out is still <strong>hard-capped at 1 SOL per day</strong> across everyone — the tier and
            play multipliers only set how fast you accrue (your claim priority), never extra SOL on top of the pool.
            Once the day’s pool is used up, claims resume the next day.
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

        <Section id="governance" title="Governance: holders vote" icon="🗳️">
          <p>
            Token holders steer where the game goes next. On the{" "}
            <Link to="/governance" className="text-gold-light hover:underline">Vote</Link> page you’ll find community
            polls — choose an option and your vote is cast.
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li><strong>Weighted by holdings</strong> — your vote weight is your on-chain token balance, read live when you vote. Bigger holders carry more weight.</li>
            <li><strong>One vote per wallet</strong> — changeable while the poll is open, so you can move your weight.</li>
            <li><strong>Transparent tallies</strong> — every poll shows live weighted results and total tokens voted.</li>
            <li><strong>No SOL spent</strong> — voting is purely a community signal; nothing leaves your wallet.</li>
          </ul>
          <p className="text-sm text-parchment-300/70">
            Holding the token isn’t just rewards — it’s a say in the roadmap.
          </p>
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
