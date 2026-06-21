import { useEffect, useState } from "react";
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
  HOLDER_PERKS,
} from "@shared/gamedata";

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

const ROADMAP: { phase: string; name: string; tagline: string; status: "complete" | "upcoming"; items: string[] }[] = [
  {
    phase: "Phase 1",
    name: "Foundation",
    tagline: "The realm rises — a complete strategy game with real token rewards.",
    status: "complete",
    items: [
      "Persistent world: build, gather, four ages, hero, army, quests",
      "Fair-bracket raiding, new-player shield, armour tiers, demolish",
      "SOL holder rewards — 10 SOL/day pool, holder tiers, play bonus",
      "Token shop — spend the token on packs, boosts, armies, traits, crests",
      "Alliances with war-room chat, ally protection & alliance leaderboard",
      "World Boss co-op events",
      "Achievements & token-holder governance",
    ],
  },
  {
    phase: "Phase 2",
    name: "The Living World",
    tagline: "Make the realm a place people return to every day.",
    status: "upcoming",
    items: [
      "Seasons + prize ladders — competitive resets with rewards",
      "Daily login streaks & milestone rewards",
      "Notifications — raided alerts, march landed, boss rising",
      "Global live feed + world chat",
      "Public treasury & payouts dashboard — live on-chain transparency",
    ],
  },
  {
    phase: "Phase 3",
    name: "The Token Economy",
    tagline: "Give the token more jobs than holding.",
    status: "upcoming",
    items: [
      "Staking — lock tokens for reward multipliers & in-game boosts",
      "Battle pass / season pass reward tracks",
      "Expanded sinks + optional burn for deflationary pressure",
      "Token-hired mercenaries — elite units summoned with the token",
      "Governance-funded content — holders vote budgets toward features",
    ],
  },
  {
    phase: "Phase 4",
    name: "Conquest & Legacy",
    tagline: "Endgame depth, rivalries, and growth.",
    status: "upcoming",
    items: [
      "Wonders + domination victory — a contested objective and a clear win",
      "Alliance wars & coordinated sieges",
      "Territory / land control for regional bonuses",
      "Referrals & recruitment — invite friends, both earn",
      "Player-to-player marketplace",
      "Native mobile app (iOS & Android)",
      "Soulbound achievement badges & spectator clip sharing",
    ],
  },
];

// Every doc section: id, sidebar label, icon, and its content. Selecting one in
// the sidebar shows it as its own page.
const SECTIONS: { id: string; title: string; icon: string; body: React.ReactNode }[] = [
  {
    id: "overview",
    title: "What is Realm Rumble",
    icon: "🌍",
    body: (
      <>
        <p>
          Realm Rumble is a persistent, browser-based strategy game. You rule one empire on a single shared world map.
          Unlike a match that ends, this world is <strong>always running</strong> — your buildings produce resources and
          your armies march around the clock, whether you are online or not.
        </p>
        <p>
          It is also <strong>token-gated with real rewards</strong>. Hold the game token and a slice of a daily{" "}
          <strong>10 SOL</strong> pool accrues to your wallet, claimable as Solana. Don’t hold the token? You can still
          play the full game in <strong>demo mode</strong> with worthless in-game coins.
        </p>
        <p>
          Around that core sit the systems that make the world feel alive: <strong>fair-bracket raiding</strong>,
          server-wide <strong>World Boss</strong> events, <strong>alliances</strong> with a shared war room, a{" "}
          <strong>token shop</strong>, <strong>achievements</strong>, and <strong>token-holder governance</strong> where
          you vote on what gets built next. Pick a topic from the sidebar.
        </p>
      </>
    ),
  },
  {
    id: "getin",
    title: "Getting in: wallet, email or demo",
    icon: "🔑",
    body: (
      <>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Solana wallet (Phantom or Solflare)</strong> — sign in with your wallet. Your empire is created
            automatically and tied to your address, and your holdings unlock token rewards.
          </li>
          <li>
            <strong>Demo mode</strong> — one click, no wallet. A throwaway empire with worthless in-game coins so you can
            learn the game. No real rewards.
          </li>
        </ul>
        <p>The same wallet or email always returns to the same empire — there are no passwords.</p>
      </>
    ),
  },
  {
    id: "loop",
    title: "The core game loop",
    icon: "🔄",
    body: (
      <>
        <ol className="ml-5 list-decimal space-y-2">
          <li><strong>Gather</strong> — raise lumber camps, farms, mines and quarries that produce wood, food, gold and stone every second.</li>
          <li><strong>Build</strong> — spend resources to place and upgrade buildings in your settlement.</li>
          <li><strong>Advance</strong> — research through four ages (Dark → Feudal → Castle → Imperial) to unlock stronger buildings and units.</li>
          <li><strong>Train</strong> — field spearmen, archers and knights.</li>
          <li><strong>Raid</strong> — march on rival empires to plunder resources. You can <strong>spectate the battle live</strong> and watch buildings get razed.</li>
          <li><strong>Progress</strong> — complete quests for coins, climb the renown ranks, and earn harvest multipliers as you rise.</li>
        </ol>
        <p className="text-sm text-parchment-300/70">
          See the <Link to="/guide" className="text-gold-light hover:underline">full handbook</Link> for the building,
          unit and age tables.
        </p>
      </>
    ),
  },
  {
    id: "raids",
    title: "Raiding & matchmaking",
    icon: "🗡️",
    body: (
      <>
        <p>
          You raid by marching armies on a rival empire and plundering their resources. But you can’t farm the helpless:
          the <strong>Attack</strong> tab only lists targets inside your <strong>bracket</strong>, enforced on the server.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li><strong>The shield</strong> — a real player far weaker than you (below {Math.round(RAID_SHIELD_RATIO * 100)}% of your power) can’t be raided. This stops strong empires from bullying newcomers.</li>
          <li><strong>Reach</strong> — empires far stronger than you are <strong>locked</strong> until you grow. Your reach widens as your renown rank climbs, so tougher targets unlock the more you play.</li>
          <li><strong>Bots are always fair game</strong> — there’s always something to fight while you climb.</li>
          <li><strong>Allies are off-limits</strong> — you can never raid a member of your own alliance.</li>
        </ul>
        <p className="text-sm text-parchment-300/70">You can spectate the battle live. Survivors march home with the loot.</p>
      </>
    ),
  },
  {
    id: "defend",
    title: "Defending your realm",
    icon: "🛡️",
    body: (
      <>
        <p>Raids cut both ways — rivals within your bracket can march on you. Your defense comes from three places:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li><strong>A standing army at home</strong> — units left in your settlement fight as defenders, with a home-ground advantage.</li>
          <li><strong>Armour</strong> — bought in the Armoury, armour climbs to <strong>{MAX_ARMOUR} named tiers</strong> (Padded → Royal Plate), higher than weapons reach, so a defender who invests can out-armour an attacker’s weapons and survive.</li>
          <li><strong>The shield</strong> — being under-strength relative to a would-be attacker protects you outright.</li>
        </ul>
        <p className="text-sm text-parchment-300/70">
          Buildings can be <strong>demolished</strong> for a 50% refund (or to cancel a misplaced build) from the
          Buildings tab — the Town Centre is your core and can’t be torn down.
        </p>
      </>
    ),
  },
  {
    id: "boss",
    title: "World Boss events",
    icon: "👹",
    body: (
      <>
        <p>
          A single <strong>World Boss</strong> rises for the entire server at once — one enemy, one shared health bar,
          the whole realm against it. Everyone fights the same boss from the <strong>World Boss</strong> tab.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li><strong>Commit your army to strike it</strong> — your damage scales with your troops and weapon upgrades.</li>
          <li><strong>It costs you</strong> — you lose a share of every army you commit, with a short cooldown between strikes.</li>
          <li><strong>Live damage board</strong> — every challenger’s damage is ranked in real time.</li>
          <li><strong>Spoils on the kill</strong> — in-game coins &amp; resources split by damage dealt, with a bonus for the top dealer. A tougher boss respawns minutes later.</li>
        </ul>
        <p className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-sm">
          World Boss spoils are <strong>in-game only</strong> (coins &amp; resources). No SOL is paid here — the 10 SOL/day
          token pool is never touched by the boss.
        </p>
      </>
    ),
  },
  {
    id: "arena",
    title: "Wagered Arena (PvP)",
    icon: "⚔️",
    body: (
      <>
        <p>
          The <strong>Arena</strong> is consensual PvP for coins. Post a wager — stake coins and commit an army — and
          anyone can accept by matching your stake and committing their own. The fight resolves instantly.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li><strong>Duels</strong> — winner takes the pot (both stakes minus a 5% burned rake). Both sides take casualties; survivors return home. Outcome is army strength (units + gear) with variance, so scout before you accept, and withdraw anytime before someone accepts.</li>
          <li><strong>Tombstone duels</strong> — when a staked duel ends, the loser's lost coins drop into a tombstone on the field. They have five minutes to recover most of them; if they don't, the victor sweeps what's left — a comeback window on every fight.</li>
          <li><strong>Tournament</strong> — a rolling single-elimination bracket. Pay the coin entry fee; when it fills it runs instantly and the champion takes the pot.</li>
          <li><strong>Daily win bonus</strong> — your first Arena win each day pays a bonus coin reward.</li>
          <li><strong>Rankings</strong> — top duelists ranked by wins and best streak.</li>
        </ul>
        <p className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-sm">
          Arena wagers are <strong>in-game coins only</strong> — no SOL is staked or paid, so the reward pool is never
          touched.
        </p>
      </>
    ),
  },
  {
    id: "spinner",
    title: "Spinner Wheel",
    icon: "🎡",
    body: (
      <>
        <p>
          Take a <strong>free spin every 12 hours</strong> for a small resource reward — a daily helping hand toward your
          next building or batch of troops.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li><strong>Resources only</strong> — wood, food, stone or gold, with a rare “Lucky Crate” of a bit of everything. Kept deliberately modest, so it's a top-up and never a shortcut or a farm.</li>
          <li><strong>Fair &amp; server-decided</strong> — the outcome is rolled on the server, so the wheel can't be gamed.</li>
        </ul>
      </>
    ),
  },
  {
    id: "plaza-gather",
    title: "Gathering in the plaza",
    icon: "🪓",
    body: (
      <>
        <p>
          The town hub isn't just for chatting — walk up to a tree in the plaza and <strong>chop it for resources</strong>,
          again and again, while everyone else mills about around you.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li><strong>A grind, not a handout</strong> — each chop gives just a few resources, so you put in ~100+ chops to fill a <strong>small daily cap</strong>. A nice top-up to chip away at between raids, never a farm.</li>
          <li><strong>Fair &amp; server-decided</strong> — the cooldown and daily cap are enforced on the server, so it can't be sped up or gamed.</li>
        </ul>
      </>
    ),
  },
  {
    id: "alliances",
    title: "Alliances",
    icon: "🤝",
    body: (
      <>
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
      </>
    ),
  },
  {
    id: "hero",
    title: "Hero, armoury & traits",
    icon: "🎖️",
    body: (
      <ul className="ml-5 list-disc space-y-2">
        <li><strong>Armoury</strong> — spend coins on weapons (attack) and armour (defense) for your units, plus a helmet &amp; armour for your hero. Armour climbs to {MAX_ARMOUR} named tiers, so investing in defense really pays off.</li>
        <li><strong>Traits</strong> — learn perks: some are free (Hardy, Keen Eye, Brawler), others cost coins. They boost HP, harvest yield and hero damage. A few elite traits are token-only (see the Token Shop).</li>
        <li><strong>Hero customization</strong> — outfit the character you play as and see the look update live.</li>
        <li><strong>Collectible characters (beta)</strong> — a growing roster of hand-made character cNFTs you can preview in the Marketplace, and will be able to wear as your hub avatar and own + resell as a compressed NFT. In beta for now — you're previewing the art while on-chain minting is finalized, so you can't play as them just yet.</li>
      </ul>
    ),
  },
  {
    id: "market",
    title: "Player marketplace",
    icon: "🏛️",
    body: (
      <>
        <p>
          The <strong>Bazaar</strong> is a player-to-player market for scarce, limited-supply relics. Each item type has
          a hard max supply (Legendary 10 · Epic 50 · Rare 250), so the rare ones hold real value. Items enter
          circulation through <strong>gameplay drops</strong> (detailed below).
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li><strong>Relics are gear, not just collectibles</strong> — equip up to 3 at once for stacking boosts: flat power (→ higher rank → bigger SOL share), bonus harvest, faster build/train, and on the rarest relics a <strong>direct SOL-yield boost</strong> (a bigger slice of the daily pool, for token holders). Rarer relics hit much harder — a Legendary can be worth real money.</li>
          <li><strong>Earn them lots of ways</strong> — a guaranteed drop on every rank-up, a chance on every quest, World Boss top-damage drops, tournament-champion drops, the Forge, or just buy on the market.</li>
          <li><strong>The Forge</strong> — fuse 3 spare relics of one rarity into a random relic one tier up (the inputs are burned), or craft a common relic from raw materials. Fusing permanently shrinks supply, so lower relics stay in demand and the rare ones keep their value.</li>
          <li><strong>Buy &amp; sell in $RUMBLE</strong> — relics are priced in USD and settled in $RUMBLE at the live token rate. Payment goes <strong>straight from buyer to seller</strong>, wallet-to-wallet, verified on-chain — <strong>95% to the seller, 5% burned</strong>.</li>
          <li><strong>No custody</strong> — the platform never holds your funds; it only verifies the payment, then transfers the item to your inventory.</li>
          <li><strong>Safe trades</strong> — a listed item is escrow-locked, a pending buy reserves it briefly so it can't be double-sold, and each payment is single-use.</li>
          <li><strong>Unlocked by rank</strong> — you can own &amp; trade any relic any time, but you can only <strong>equip</strong> it once you've earned the rank: Common (anyone), Rare (Footman), Epic (Knight), Legendary (Warlord). So power is something you grow into, not buy your way to.</li>
          <li><strong>Hold up to {15}</strong> — your inventory is capped, so you can't hoard endless power; when it's full you choose what to keep, sell or forge. (Burning relics for SOL is coming.)</li>
          <li>Your inventory, equipped relics and trading P/L (in USD) all show on your <Link to="/dashboard" className="text-gold-light hover:underline">dashboard</Link>. A connected wallet is needed to trade.</li>
        </ul>
      </>
    ),
  },
  {
    id: "mounts",
    title: "Mounts & Pets",
    icon: "🐎",
    body: (
      <>
        <p>
          <strong>Mounts &amp; Pets</strong> are collectible companions that ride beside your hero — and each gives a real{" "}
          <strong>equipped perk</strong>. A pet is its own equip slot, so it stacks on top of your relics.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li><strong>Each has a use</strong> — faster resource gathering, faster building &amp; training, and the rarest two boost your <strong>share of the daily SOL pool</strong>. Different pets suit different playstyles.</li>
          <li><strong>Strictly scarce</strong> — hard supply caps (only 8 Dragonlings and 15 Phoenixes will ever exist), so the rare ones hold real value.</li>
          <li><strong>Yours to own &amp; resell</strong> — each is a compressed NFT you hold in your wallet and can trade.</li>
          <li><strong>Browse now, buy soon</strong> — preview the full roster and exactly what each pet does in the Marketplace's Mounts &amp; Pets tab; buying with $RUMBLE goes live shortly.</li>
        </ul>
      </>
    ),
  },
  {
    id: "shop",
    title: "Token shop",
    icon: "💎",
    body: (
      <>
        <p>
          The <strong>Token Shop</strong> lets you spend the project token on in-game items. Every purchase{" "}
          <strong>burns the token</strong> — it's removed from circulating supply forever, verified on-chain by the
          server before the item is granted. So the shop is purely <strong>deflationary</strong>: the more it's used, the
          scarcer the token. You need a connected wallet that holds the token.
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
        <p className="text-sm text-parchment-300/70">Burning on every purchase shrinks supply, supporting the token's value.</p>
      </>
    ),
  },
  {
    id: "exchange",
    title: "Coin Exchange",
    icon: "💱",
    body: (
      <>
        <p>
          The <strong>Coin Exchange</strong> (on the Market page) is the grind-to-token cash-out: <strong>sell the
          in-game coins you farm for the $RUMBLE token</strong>, player-to-player. List an amount of coins for a $RUMBLE
          price; a buyer pays you <strong>straight to your wallet</strong> in $RUMBLE (95%), and the 5% fee is{" "}
          <strong>burned</strong>. The server verifies the on-chain payment, then delivers the coins. No platform custody.
        </p>
        <p className="text-sm text-parchment-300/70">
          This gives the whole grind a real token price — coins you earn become something you can cash out, and every
          trade burns a little supply.
        </p>
      </>
    ),
  },
  {
    id: "ranks",
    title: "Renown ranks",
    icon: "⚜️",
    body: (
      <>
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
      </>
    ),
  },
  {
    id: "titles",
    title: "Achievements & titles",
    icon: "🏅",
    body: (
      <>
        <p>Milestones unlock automatically as your empire grows and are logged the moment you earn them. Track them on the <strong>Titles</strong> tab.</p>
        <Table head={["Title", "How to unlock"]}>
          {ACHIEVEMENTS.map((a) => (
            <tr key={a.id} className="border-b border-parchment-300/5">
              <td className="py-2 pr-3 font-medium text-parchment-100">{a.icon} {a.name}</td>
              <td className="py-2 text-parchment-300/75">{a.desc}</td>
            </tr>
          ))}
        </Table>
      </>
    ),
  },
  {
    id: "enemies",
    title: "Enemy empires & difficulty tiers",
    icon: "🤖",
    body: (
      <>
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
                <td className="py-2 pr-3 text-parchment-300/75">{t.powerCap >= 99999 ? "Unlimited" : `up to ${t.powerCap.toLocaleString()}`}</td>
                <td className="py-2 text-parchment-300/75">{Math.round((t.weight / total) * 100)}%</td>
              </tr>
            );
          })}
        </Table>
      </>
    ),
  },
  {
    id: "rewards",
    title: "Token rewards & payouts",
    icon: "💰",
    body: (
      <>
        <p>
          A total pool of <strong className="text-gold-light">10 SOL per day</strong> is shared among all token holders —
          one pool for everyone, not per player. Your slice is <strong>pro-rata</strong> to how much of the supply you
          hold, then boosted by your holder tier:
        </p>
        <div className="rounded-xl border border-gold/25 bg-black/30 p-4 text-center font-mono text-sm text-parchment-100">
          your&nbsp;daily&nbsp;SOL&nbsp;=&nbsp;(tokens&nbsp;÷&nbsp;supply)&nbsp;×&nbsp;10&nbsp;SOL&nbsp;×&nbsp;tier&nbsp;×&nbsp;play&nbsp;bonus&nbsp;×&nbsp;diamond&nbsp;hands
        </div>
        <p>
          <strong>Reward for playing, not just holding.</strong> Your accrual is also boosted by a <strong>play bonus</strong>{" "}
          equal to your empire’s renown rank (1× as a Peasant up to 2.5× as an Emperor). So the harder you play, the
          bigger your slice of the pool.
        </p>
        <p>
          <strong>💎 Diamond Hands.</strong> Holding without selling grows a <strong>loyalty multiplier</strong> on your
          accrual — about +3% per day, up to 2× at ~33 days. Selling below your streak’s starting balance resets it. So
          the longer you hold, the bigger your share of the daily pool.
        </p>
        <p>
          The total paid out is still <strong>hard-capped at 10 SOL per day</strong> across everyone — the tier and play
          multipliers only set how fast you accrue, never extra SOL on top of the pool. Once the day’s pool is used up,
          claims resume the next day.
        </p>
        <p>
          Holdings are read directly <strong>on-chain</strong> (your SPL-token balance vs. circulating supply). Rewards{" "}
          <strong>accrue continuously</strong> from the moment you’re first seen holding — you don’t have to be online.
        </p>
      </>
    ),
  },
  {
    id: "tiers",
    title: "Holder tiers",
    icon: "◆",
    body: (
      <>
        <p>
          Holders are sorted into tiers by their <strong>share of circulating supply</strong>. The tier sets the
          multiplier applied on top of your pro-rata slice — the more you hold, the higher the tier, the bigger the boost
          (up to 3×). Your current tier is shown on your dashboard.
        </p>
        <Table head={["Tier", "Supply share", "Multiplier", "Notes"]}>
          {REWARD_TIERS.map((t) => (
            <tr key={t.name} className="border-b border-parchment-300/5">
              <td className="py-2 pr-3 font-semibold" style={{ color: t.color }}>● {t.name}</td>
              <td className="py-2 pr-3 text-parchment-300/75">{t.minShare === 0 ? "any holder" : `≥ ${(t.minShare * 100).toFixed(t.minShare < 0.01 ? 1 : 0)}%`}</td>
              <td className="py-2 pr-3 text-gold-light">{t.multiplier.toFixed(2)}×</td>
              <td className="py-2 text-parchment-300/70">{t.blurb}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-4">
          <strong>🏰 In-game holder perks.</strong> Your tier isn’t just SOL — it grants a real gameplay edge on your
          linked empire: bigger harvests and faster construction &amp; training. Refreshed from your on-chain holdings
          each time you connect.
        </p>
        <Table head={["Tier", "Harvest bonus", "Build & train speed"]}>
          {REWARD_TIERS.map((t) => {
            const p = HOLDER_PERKS[t.name];
            return (
              <tr key={t.name} className="border-b border-parchment-300/5">
                <td className="py-2 pr-3 font-semibold" style={{ color: t.color }}>● {t.name}</td>
                <td className="py-2 pr-3 text-emerald-300">+{Math.round((p?.gatherPct ?? 0) * 100)}%</td>
                <td className="py-2 text-sky-300">+{Math.round((p?.speedPct ?? 0) * 100)}%</td>
              </tr>
            );
          })}
        </Table>
      </>
    ),
  },
  {
    id: "governance",
    title: "Governance: holders vote",
    icon: "🗳️",
    body: (
      <>
        <p>
          Token holders steer where the game goes next. On the{" "}
          <Link to="/governance" className="text-gold-light hover:underline">Vote</Link> page you’ll find community polls —
          choose an option and your vote is cast.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li><strong>Weighted by holdings</strong> — your vote weight is your on-chain token balance, read live when you vote.</li>
          <li><strong>One vote per wallet</strong> — changeable while the poll is open, so you can move your weight.</li>
          <li><strong>Transparent tallies</strong> — every poll shows live weighted results and total tokens voted.</li>
          <li><strong>No SOL spent</strong> — voting is purely a community signal; nothing leaves your wallet.</li>
        </ul>
        <p className="text-sm text-parchment-300/70">Holding the token isn’t just rewards — it’s a say in the roadmap.</p>
      </>
    ),
  },
  {
    id: "claim",
    title: "Claiming your SOL",
    icon: "💸",
    body: (
      <ul className="ml-5 list-disc space-y-2">
        <li>Your <strong>first claim</strong> is available any time.</li>
        <li>After that, you can claim <strong>once every 6 hours</strong> (4× a day). The button shows a live countdown.</li>
        <li>Rewards keep accruing between claims, so there’s no penalty for claiming less often.</li>
        <li>Claims pay <strong>SOL on Solana mainnet</strong>, sent straight from the treasury to your wallet.</li>
      </ul>
    ),
  },
  {
    id: "dashboard",
    title: "Your dashboard",
    icon: "📊",
    body: (
      <p>
        The <Link to="/dashboard" className="text-gold-light hover:underline">dashboard</Link> brings your whole empire
        into one view: rank and progress, power, time played, army size, raids won/lost, win rate, buildings razed and
        more — alongside your reward cards (claimable, total earned, daily rate and boost tier), the full holder-tier
        ladder with your current tier highlighted, and the claim button.
      </p>
    ),
  },
  {
    id: "trust",
    title: "Mainnet, treasury & fairness",
    icon: "🔒",
    body: (
      <ul className="ml-5 list-disc space-y-2">
        <li>Everything runs on <strong>Solana mainnet</strong> — clearly badged on the dashboard.</li>
        <li>Payouts come from a dedicated <strong>treasury wallet</strong> that funds the daily pool.</li>
        <li>The pool is fixed at 10 SOL/day total and split pro-rata, so rewards scale fairly with real on-chain holdings.</li>
        <li>Non-holders and demo players earn no SOL — the in-game economy stays separate from real rewards.</li>
      </ul>
    ),
  },
  {
    id: "roadmap",
    title: "Roadmap",
    icon: "🗺️",
    body: (
      <>
        <p>
          Phase 1 is live — a complete game with real rewards. From here the realm grows toward retention, deeper token
          utility, and endgame conquest. And because of{" "}
          <Link to="/governance" className="text-gold-light hover:underline">governance</Link>, holders can reorder what
          comes next — the roadmap is the community’s to steer.
        </p>
        <div className="mt-2 space-y-4">
          {ROADMAP.map((p) => (
            <div
              key={p.phase}
              className={`rounded-2xl border p-5 ${p.status === "complete" ? "border-emerald-500/30 bg-emerald-500/5" : "border-parchment-300/12 bg-black/20"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-parchment-100">
                  <span className="text-parchment-300/55">{p.phase}:</span> {p.name}
                </h3>
                <span className={`rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${p.status === "complete" ? "bg-emerald-500/20 text-emerald-300" : "bg-gold/15 text-gold-light"}`}>
                  {p.status === "complete" ? "✓ Complete" : "Upcoming"}
                </span>
              </div>
              <p className="mt-1 text-sm text-parchment-300/70">{p.tagline}</p>
              <ul className="mt-3 space-y-1.5">
                {p.items.map((it) => (
                  <li key={it} className="flex gap-2 text-sm text-parchment-300/85">
                    <span className={p.status === "complete" ? "text-emerald-400" : "text-gold-light/70"}>{p.status === "complete" ? "✓" : "▸"}</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-sm text-parchment-300/60">Timelines aren’t fixed — features ship as they’re ready, and holder votes can reprioritise the order.</p>
      </>
    ),
  },
];

export default function DocsPage() {
  const [active, setActive] = useState<string>(() => {
    const h = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
    return SECTIONS.some((s) => s.id === h) ? h : SECTIONS[0].id;
  });

  // keep the URL hash in sync so sections are deep-linkable / shareable
  useEffect(() => {
    if (window.location.hash.replace("#", "") !== active) {
      window.history.replaceState(null, "", `#${active}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [active]);

  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-grid opacity-10" />
      <div className="container-x relative py-10 lg:py-14">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* sidebar */}
          <aside className="lg:w-64 lg:shrink-0">
            <div className="lg:sticky lg:top-24">
              <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-parchment-300/55">
                📚 Documentation
              </div>
              <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
                {SECTIONS.map((s) => {
                  const on = s.id === active;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActive(s.id)}
                      className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors lg:w-full ${
                        on
                          ? "bg-gold/15 font-semibold text-gold-light"
                          : "text-parchment-300/75 hover:bg-white/5 hover:text-parchment-100"
                      }`}
                    >
                      <span className="text-base">{s.icon}</span>
                      <span>{s.title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* content */}
          <div className="min-w-0 flex-1">
            <div className="mx-auto max-w-3xl">
              <h1 className="flex items-center gap-3 text-3xl font-bold sm:text-4xl">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold/25 to-transparent text-2xl ring-1 ring-gold/20">
                  {section.icon}
                </span>
                <span className="text-gold-gradient">{section.title}</span>
              </h1>
              <div className="mt-6 space-y-3 leading-relaxed text-parchment-300/85">{section.body}</div>

              {/* prev / next */}
              <DocNav active={active} onNavigate={setActive} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocNav({ active, onNavigate }: { active: string; onNavigate: (id: string) => void }) {
  const idx = SECTIONS.findIndex((s) => s.id === active);
  const prev = idx > 0 ? SECTIONS[idx - 1] : null;
  const next = idx < SECTIONS.length - 1 ? SECTIONS[idx + 1] : null;
  return (
    <div className="mt-12 flex items-center justify-between gap-3 border-t border-parchment-300/10 pt-6">
      {prev ? (
        <button onClick={() => onNavigate(prev.id)} className="group flex max-w-[48%] flex-col items-start rounded-lg border border-parchment-300/12 px-4 py-3 text-left transition-colors hover:border-gold/35">
          <span className="text-[11px] uppercase tracking-wider text-parchment-300/45">← Previous</span>
          <span className="truncate text-sm font-medium text-parchment-100">{prev.icon} {prev.title}</span>
        </button>
      ) : (
        <span />
      )}
      {next ? (
        <button onClick={() => onNavigate(next.id)} className="group flex max-w-[48%] flex-col items-end rounded-lg border border-parchment-300/12 px-4 py-3 text-right transition-colors hover:border-gold/35">
          <span className="text-[11px] uppercase tracking-wider text-parchment-300/45">Next →</span>
          <span className="truncate text-sm font-medium text-parchment-100">{next.icon} {next.title}</span>
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
