type Tag = "Feature" | "Improvement" | "Fix" | "Docs";

const TAG_STYLE: Record<Tag, string> = {
  Feature: "bg-emerald-500/15 text-emerald-300",
  Improvement: "bg-sky-500/15 text-sky-300",
  Fix: "bg-blood/20 text-blood-light",
  Docs: "bg-parchment-300/15 text-parchment-200",
};

// Newest first. Add a new dated block at the top as updates ship.
const CHANGELOG: { date: string; items: { tag: Tag; title: string; desc: string }[] }[] = [
  {
    date: "June 18, 2026",
    items: [
      { tag: "Feature", title: "The Forge", desc: "Combine 3 relics of a rarity into a random one tier up (inputs burned), or craft a relic from raw materials. A deflationary sink that keeps relics scarce & in demand. Plus 6 new relics for variety and a 'how to collect' guide." },
      { tag: "Feature", title: "Relics that earn SOL", desc: "The rarest relics now grant a direct SOL-yield boost when equipped (bigger slice of the daily pool) — making Legendaries genuinely worth real money. Starter market re-listed in SOL." },
      { tag: "Improvement", title: "Bazaar stocked & clearer", desc: "Starter relics listed at fair prices so the market isn't empty, each listing shows its effect, and the page explains equip-vs-sell and how to list." },
      { tag: "Feature", title: "Relics are gear now", desc: "Marketplace items grant real boosts — equip up to 3 for stacking power, harvest and speed. Bigger catalog (15 relics across rarities)." },
      { tag: "Feature", title: "More ways to earn relics", desc: "Drops from quests, World Boss top damage, and a guaranteed drop on every rank-up (plus tournament champions)." },
      { tag: "Improvement", title: "Inventory & trading on dashboard", desc: "Your relics, equipped slots, and SOL/USDC trading profit/loss now show on the dashboard." },
      { tag: "Feature", title: "Player marketplace", desc: "Trade scarce, limited-supply relics with other rulers in SOL or USDC — paid wallet-to-wallet, verified on-chain, item to your inventory. Champion drops seed circulation." },
      { tag: "Feature", title: "Arena tournaments", desc: "A rolling single-elimination tournament — pay a coin entry fee; when it fills, a bracket runs instantly and the champion takes the pot." },
      { tag: "Feature", title: "Daily win bonus", desc: "Your first Arena win each day pays a bonus coin reward." },
      { tag: "Feature", title: "Arena rankings", desc: "A leaderboard of top duelists by wins and best win streak." },
    ],
  },
  {
    date: "June 17, 2026",
    items: [
      { tag: "Feature", title: "Wagered Arena (PvP)", desc: "Stake coins and commit an army; anyone can accept and fight you. Winner takes the pot (minus a burned rake). In-game coins only." },
      { tag: "Feature", title: "Diamond Hands rewards", desc: "Holding without selling grows a loyalty multiplier on your SOL accrual (up to 2×); selling resets it." },
      { tag: "Feature", title: "In-game holder perks", desc: "Your holder tier now grants real gameplay bonuses — bigger harvests and faster build/train — refreshed from your holdings." },
      { tag: "Fix", title: "Navbar polish", desc: "Tightened the nav so the brand and slogan no longer wrap; the changelog link is now labelled “Changelog”." },
      { tag: "Improvement", title: "Daily reward pool tripled", desc: "The shared daily SOL reward pool increased from 1 SOL to 3 SOL per day." },
      { tag: "Feature", title: "Feedback & bug reporting", desc: "Floating Feedback and Report-a-bug buttons; submissions flow into a private admin inbox." },
      { tag: "Feature", title: "Token-holder governance", desc: "Vote on what gets built next — your weight is your on-chain token balance. New Vote page." },
      { tag: "Feature", title: "Achievements & titles", desc: "Earn milestone titles (First Blood, Boss Slayer, Emperor…) as your empire grows." },
      { tag: "Feature", title: "World Boss events", desc: "A server-wide boss everyone fights together; in-game spoils split by damage dealt. No SOL touched." },
      { tag: "Feature", title: "Alliances", desc: "Form crews with a shared war-room chat, ally protection, and an alliance leaderboard." },
      { tag: "Feature", title: "Token shop", desc: "Spend the token on resource packs, boosts, instant armies, exclusive traits and crests." },
      { tag: "Improvement", title: "Fair-bracket raiding", desc: "The Attack list shows only targets you can reach; tougher ones unlock as your rank climbs." },
      { tag: "Improvement", title: "Raid shield", desc: "Strong empires can no longer farm far-weaker players." },
      { tag: "Improvement", title: "Deeper armour", desc: "Armour now spans 12 named tiers so defenders can out-armour an attacker's weapons." },
      { tag: "Improvement", title: "Demolish buildings", desc: "Tear down a building for a 50% refund, or cancel a mis-placed build mid-construction." },
      { tag: "Docs", title: "Docs overhaul + Roadmap", desc: "Sidebar documentation covering every system, plus a 4-phase public roadmap." },
      { tag: "Feature", title: "Theme music", desc: "A looping medieval soundtrack with a floating mute toggle." },
    ],
  },
  {
    date: "June 16, 2026",
    items: [
      { tag: "Improvement", title: "Reward playing hard", desc: "Your empire's renown rank now boosts SOL accrual — within the same fixed daily pool." },
      { tag: "Improvement", title: "Themed home page", desc: "Per-section backdrops: sky, world map, night town, the ages, and the kingdom." },
      { tag: "Improvement", title: "Heraldic empire crests", desc: "Shield-style crests replace flat colour squares across the site." },
      { tag: "Feature", title: "Game-style loading screen", desc: "New warrior logo, matching favicon, and an intro splash." },
      { tag: "Fix", title: "Navbar layout", desc: "Resolved nav overlap and centring; tidied the social links." },
      { tag: "Docs", title: "Professional README", desc: "Expanded into a full game guide with banner, badges and tables." },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      <div className="absolute inset-0 bg-grid opacity-10" />
      <div className="container-x relative max-w-3xl py-16">
        <div className="text-center">
          <span className="kicker">📜 What's new</span>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
            <span className="text-gold-gradient">Changelog</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-parchment-300/70">
            Every update to Realm Rumble, newest first. The realm grows fast — and holders steer where it goes next.
          </p>
        </div>

        <div className="mt-12 space-y-10">
          {CHANGELOG.map((day) => (
            <section key={day.date}>
              <div className="sticky top-20 z-10 -mx-2 mb-4 inline-block rounded-lg bg-ink-800/80 px-3 py-1 font-display text-lg font-bold text-parchment-100 backdrop-blur">
                {day.date}
              </div>
              <div className="space-y-3 border-l border-parchment-300/15 pl-5">
                {day.items.map((it) => (
                  <div key={it.title} className="relative">
                    <span className="absolute -left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full bg-gold/60 ring-2 ring-ink-800" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TAG_STYLE[it.tag]}`}>
                        {it.tag}
                      </span>
                      <span className="font-semibold text-parchment-100">{it.title}</span>
                    </div>
                    <p className="mt-1 text-sm text-parchment-300/75">{it.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
