import { useEffect, useState } from "react";
import { fetchBurns } from "../lib/burns";
import { fmt } from "../lib/format";

type Tag = "Feature" | "Improvement" | "Fix" | "Docs";

// EST calendar day for a burn timestamp, formatted to match the changelog dates
// (e.g. "June 18, 2026") so we can total burns per day.
const estDay = (at: number) =>
  new Date(at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" });

const TAG_STYLE: Record<Tag, string> = {
  Feature: "bg-emerald-500/15 text-emerald-300",
  Improvement: "bg-sky-500/15 text-sky-300",
  Fix: "bg-blood/20 text-blood-light",
  Docs: "bg-parchment-300/15 text-parchment-200",
};

// Newest first. Add a new dated block at the top as updates ship.
const CHANGELOG: { date: string; items: { tag: Tag; title: string; desc: string }[] }[] = [
  {
    date: "June 21, 2026",
    items: [
      { tag: "Feature", title: "Gather resources in the hub", desc: "The town plaza is now somewhere to work, not just hang out — walk up to a tree and chop it for resources, over and over, alongside everyone else online. A small daily haul to grind between raids, capped so it stays a nice top-up rather than a shortcut." },
    ],
  },
  {
    date: "June 20, 2026",
    items: [
      { tag: "Feature", title: "Spinner Wheel is live", desc: "The Spinner is out of beta — and it's now the centrepiece of the hub plaza: walk up and spin it right there for a free resource top-up every 12 hours. Tuned to modest, sustainable rewards so it's a daily helping hand, never a shortcut or a farm." },
      { tag: "Feature", title: "Spectate the live world", desc: "Now live — watch the hub fill up and players move about in real time straight from the landing page, no wallet needed, then connect to play." },
      { tag: "Feature", title: "Tombstone duels", desc: "The Arena's Tombstone mode is live — win a staked duel and the loser's coins drop into a tombstone; race to recover most of it within five minutes, or the victor loots the lot." },
      { tag: "Feature", title: "Mounts & Pets in the Marketplace", desc: "A new Mounts & Pets tab previewing a roster of collectible companions — each gives a real equipped perk (faster gathering or building, and the rarest ones boost your daily SOL share), with strictly limited supply. Buying goes live soon; for now you can browse the roster and exactly what each one does." },
      { tag: "Improvement", title: "Jump to listings from the activity feed", desc: "Click any entry in a Marketplace activity feed to jump straight to that item's listing — it switches to the right tab and highlights the card." },
      { tag: "Feature", title: "Live dashboard stats", desc: "The Leaderboard now shows two headline numbers at a glance: how many players are online right now, and the total SOL earned by players across the game — a running tally that only grows as the realm pays out." },
      { tag: "Improvement", title: "Fairer SOL rewards", desc: "The daily SOL pool is now split as a true weighted share — your slice grows with your renown rank, holder tier, Diamond-hands loyalty and equipped relics, and the slices always add up to the pool so it can never be drained. Holding always pays your full share; playing and ranking just earn you a bigger one. No single wallet can take more than 15% of the day." },
      { tag: "Improvement", title: "Army size cap", desc: "Empire armies are now capped at 10,000 population, so no one can stack endless houses to field a runaway army — battles stay competitive across the board." },
      { tag: "Fix", title: "Token-shop purchases are guaranteed", desc: "Shop payments that confirm slowly are now retried and delivered automatically, so a purchase can never take your tokens without granting the item. Timed boosts like Harvest Surge also show an active badge so you can see them working." },
    ],
  },
  {
    date: "June 19, 2026",
    items: [
      { tag: "Feature", title: "The Hub is now a walkable village", desc: "The Hub has been rebuilt as a village you explore — wander your hero with WASD across a market square of stalls around the fountain, past dozens of houses, dirt roads out to open grassland and tree-lined fields, with everyone online beside you. Scroll or use the +/− buttons to zoom in and out." },
      { tag: "Feature", title: "Collectible characters — preview (beta)", desc: "A new roster of hand-made character cNFTs is previewing in the Marketplace's Characters tab. You'll be able to buy them, wear them as your hub avatar, and own + resell each as a compressed NFT in your wallet. Locked for now while the artwork and on-chain minting are finalized — so you can't play as them just yet." },
    ],
  },
  {
    date: "June 18, 2026",
    items: [
      { tag: "Feature", title: "Live burn counter", desc: "A $RUMBLE burned counter on the home page — click it for a breakdown of every hourly treasury burn, each linking to the transaction on Solscan, plus the token supply and treasury wallet. Fully verifiable." },
      { tag: "Improvement", title: "Marketplace settles in $RUMBLE", desc: "Relics are now listed at a stable USD price and bought with $RUMBLE at the live token rate — 95% to the seller, 5% burned. One token across the whole economy, paid straight to your wallet." },
      { tag: "Feature", title: "See any player in the Hub", desc: "Click a name in the Hub roster to open that player's card — their rank, power, raids won and lifetime SOL earned." },
      { tag: "Feature", title: "Hub lobby roster", desc: "A live 'In the Hub' panel shows everyone in the plaza right now — crest, name, level and equipped character — plus how many players are online." },
      { tag: "Improvement", title: "Coin Exchange priced in USD", desc: "Sell your coins at a stable dollar price — paid to your wallet in $RUMBLE at the live token rate (5% burned), with a one-tap 'Cash out → SOL'. And the token shop no longer sells coins, so the Exchange is now the single free market for them — real, player-set prices." },
      { tag: "Improvement", title: "Standout nameplates in the Hub", desc: "Players in the Hub now show a bigger name and a bold level tag above their hero, and higher-level rulers glow gold so the strongest players stand out in the plaza." },
      { tag: "Feature", title: "Private profiles", desc: "A new toggle on your Profile card lets you hide your name on the leaderboard — your rank still counts, but your name shows as Hidden." },
      { tag: "Feature", title: "Daily Quests (beta preview)", desc: "A Daily tab with objectives that reset every day — win raids, take Arena duels, earn experience — for resource rewards. Locked for now while it's in beta." },
      { tag: "Feature", title: "Spinner Wheel (beta preview)", desc: "A wheel you can spin once free every 12 hours for resources or a rare relic. Locked for now while it's in beta." },
      { tag: "Feature", title: "Mounts & pets (beta preview)", desc: "Rare companions that drop when you win raids — collect them, own each as a cNFT, and equip one beside your hero in the hub. Locked for now while it's in beta." },
      { tag: "Feature", title: "Tombstone duels (beta preview)", desc: "A new Arena mode where the loser's staked coins drop into a tombstone — race to recover most of it within five minutes, or the victor loots the lot. Locked for now while it's in beta." },
      { tag: "Feature", title: "Spectate the live world (beta preview)", desc: "Watch the hub fill up and players move about in real time from the landing page — no wallet needed — then connect to play. Locked for now while it's in beta." },
      { tag: "Feature", title: "Marketplace activity feeds", desc: "Every relic and coin listing, purchase and sale now appears in a live Activity feed on its Marketplace tab." },
      { tag: "Feature", title: "Characters (beta preview)", desc: "A new Characters tab in the Marketplace — preview the character roster you'll be able to buy, wear as your hub avatar, and own as a compressed NFT you can resell. Locked for now while the artwork and on-chain minting are finished." },
      { tag: "Improvement", title: "Rewards go to active players", desc: "The daily SOL pool now splits among active holders — people who hold $RUMBLE and actually play — instead of being diluted across the whole token supply. Far bigger, real rewards for players in the game, with a per-wallet cap so no whale drains the day. Daily pool raised to 5 SOL." },
      { tag: "Improvement", title: "Full leaderboard", desc: "The leaderboard now lists every ruler, ranked by power, with pages to flip through (50 per page) — no more top-25 cutoff, bots excluded." },
      { tag: "Feature", title: "The Hub — a place to gather", desc: "A shared, walkable plaza every ruler now spawns in: stroll around as your hero with WASD, see everyone online moving about with their name and level, chat in real time, then march into your world." },
      { tag: "Feature", title: "Editable profile", desc: "A Profile card on your dashboard — change your display name and pick your crest colour. Your name and colour show everywhere: the leaderboard, the world and the hub." },
      { tag: "Feature", title: "Token-gated play", desc: "Playing the full game and earning SOL now requires holding at least 10 $RUMBLE in your wallet, verified on-chain and enforced continuously while you play. Demo mode stays free and open to everyone (no rewards)." },
      { tag: "Improvement", title: "Direct wallet sign-in", desc: "Sign in straight to Phantom or Solflare. Your empire is tied to your wallet, and your holdings unlock the daily SOL rewards." },
      { tag: "Feature", title: "Coin Exchange — cash out to $RUMBLE", desc: "Sell the in-game coins you grind for the project token, P2P, paid straight to your wallet (95%) with the 5% fee burned. Turns playtime into token, on the Market page." },
      { tag: "Feature", title: "Token shop now burns", desc: "Every token-shop purchase burns the $RUMBLE you spend — removed from supply forever. The shop is purely deflationary." },
      { tag: "Improvement", title: "Market in USDC + SOL on leaderboard", desc: "Relics are now priced in dollars (USDC) by default, repriced to match each relic's utility. The leaderboard shows each player's lifetime SOL earned." },
      { tag: "Feature", title: "Rank-gated relics + inventory cap", desc: "You unlock the power to equip rarer relics as you climb the ranks (Common → Rare → Epic → Legendary), and you can hold up to 15 — so you choose what to keep, sell or forge instead of hoarding. (Burn-for-SOL coming.)" },
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
      { tag: "Docs", title: "Professional README", desc: "Expanded into a full game guide with banner, badges and tables." },
    ],
  },
];

export default function ChangelogPage() {
  // live $RUMBLE burned per EST day, keyed by the same date string as the blocks
  const [burnByDay, setBurnByDay] = useState<Record<string, number>>({});
  useEffect(() => {
    fetchBurns().then((b) => {
      const map: Record<string, number> = {};
      for (const burn of b.burns) map[estDay(burn.at)] = (map[estDay(burn.at)] || 0) + burn.amount;
      setBurnByDay(map);
    });
  }, []);

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
              <div className="sticky top-20 z-10 -mx-2 mb-4 inline-flex items-center gap-2 rounded-lg bg-ink-800/80 px-3 py-1 font-display text-lg font-bold text-parchment-100 backdrop-blur">
                {day.date}
                {burnByDay[day.date] > 0 && (
                  <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 font-sans text-xs font-semibold text-gold-light">
                    🔥 {fmt(Math.round(burnByDay[day.date]))} $RUMBLE burned
                  </span>
                )}
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
