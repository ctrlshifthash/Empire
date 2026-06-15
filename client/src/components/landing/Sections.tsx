import { Link } from "react-router-dom";
import Reveal from "./Reveal";
import { AGES, AGE_ORDER, REWARD_TIERS } from "@shared/gamedata";
import { AGE_META, fmt } from "../../lib/format";

// ── Features ────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "🌍",
    title: "A World That Never Sleeps",
    body: "Your economy keeps producing and your armies keep marching around the clock. Log off, come back tomorrow, and your empire has grown — and rivals have made their move.",
  },
  {
    icon: "🏗️",
    title: "Build, Fortify & Expand",
    body: "Raise lumber camps, farms, mines and barracks, then barricade your territory with walls, towers and gates. Every building you place strengthens your realm.",
  },
  {
    icon: "⚔️",
    title: "Raid & Spectate Live",
    body: "Train spearmen, archers and knights, then march on rivals — and watch the battle play out live in the isometric world as buildings are razed. No more paper results.",
  },
  {
    icon: "💰",
    title: "Earn Real Solana",
    body: "Hold the game token and a daily 1 SOL pool accrues to your wallet, split pro-rata with a bigger multiplier for bigger holders. Claim real SOL — or play free in demo mode.",
  },
  {
    icon: "🎖️",
    title: "Ranks, Heroes & Gear",
    body: "Climb the renown ranks for permanent harvest bonuses, customise your hero, and spend coins in the shop on weapons, armour and traits that show on the battlefield.",
  },
  {
    icon: "🤖",
    title: "Rivals at Every Tier",
    body: "The world is full of AI empires across difficulty tiers — from defenceless hamlets to fearsome conquerors — so there's always someone to farm for loot or a real challenge to fight.",
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24">
      <div className="container-x">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="kicker">⚜ What awaits you</span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
            Everything a <span className="text-gold-gradient">strategist</span> could want
          </h2>
          <p className="mt-4 text-parchment-300/70">
            Realm Rumble blends the depth of a classic real-time strategy game with the
            persistence of a living online world.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <div className="group h-full rounded-2xl border border-parchment-300/10 bg-ink-800/60 p-6 shadow-panel transition-all duration-300 hover:-translate-y-1 hover:border-gold/30 hover:shadow-gold">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold/25 to-transparent text-2xl ring-1 ring-gold/20">
                  {f.icon}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-parchment-100">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-parchment-300/70">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Play & earn (token rewards) ─────────────────────────────────────────────

export function PlayAndEarn() {
  return (
    <section id="rewards" className="relative py-24">
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="container-x relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="kicker">💰 Play &amp; earn</span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
            Hold the token, earn <span className="text-gold-gradient">real Solana</span>
          </h2>
          <p className="mt-4 text-parchment-300/70">
            A single pool of <b className="text-gold-light">1 SOL every day</b> is shared among all token holders — split
            pro-rata to how much you hold, then boosted by your holder tier. Claim real SOL straight to your wallet.
          </p>
        </Reveal>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-3">
          <Reveal>
            <div className="h-full rounded-2xl border border-parchment-300/10 bg-ink-800/60 p-6 shadow-panel">
              <div className="text-2xl">📈</div>
              <h3 className="mt-3 font-semibold text-parchment-100">Pro-rata, every day</h3>
              <p className="mt-2 text-sm text-parchment-300/70">
                Your share of the 1 SOL pool tracks your share of supply, read live on-chain. Rewards accrue continuously,
                even while you’re offline.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="h-full rounded-2xl border border-parchment-300/10 bg-ink-800/60 p-6 shadow-panel">
              <div className="text-2xl">◆</div>
              <h3 className="mt-3 font-semibold text-parchment-100">Bigger holdings, bigger boost</h3>
              <p className="mt-2 text-sm text-parchment-300/70">
                Holders are sorted into tiers from Bronze to Diamond, each adding a multiplier on top of your slice — up
                to 3× for the whales.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="h-full rounded-2xl border border-parchment-300/10 bg-ink-800/60 p-6 shadow-panel">
              <div className="text-2xl">💸</div>
              <h3 className="mt-3 font-semibold text-parchment-100">Claim on your terms</h3>
              <p className="mt-2 text-sm text-parchment-300/70">
                First claim any time, then once every 6 hours. Paid in real SOL on Solana mainnet. No tokens? Play the
                full game free in demo mode.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal className="mx-auto mt-8 max-w-4xl">
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {REWARD_TIERS.map((t) => (
              <span
                key={t.name}
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold"
                style={{ borderColor: `${t.color}55`, color: t.color, background: `${t.color}14` }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                {t.name}
                <span className="text-parchment-300/60">{t.multiplier.toFixed(2)}×</span>
              </span>
            ))}
          </div>
        </Reveal>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/login" className="btn-gold px-7 py-3">
            🔗 Connect &amp; start earning
          </Link>
          <Link to="/docs" className="btn-ghost px-7 py-3">
            Read the docs →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── How it works ────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    title: "Sign in & found your empire",
    body: "Connect a Solana wallet or email — or jump into demo mode. Your town center rises on the shared world map instantly, no password needed.",
  },
  {
    n: "02",
    title: "Grow & fortify",
    body: "Build lumber camps, farms and mines, then barricade your land with walls, towers and gates. Resources flow every second — even while you're away.",
  },
  {
    n: "03",
    title: "Raise an army",
    body: "Train troops, gear them in the shop, and advance through the ages to unlock archers and knights. Customise your hero as you go.",
  },
  {
    n: "04",
    title: "Conquer, climb & earn",
    body: "Raid rivals and spectate the battle live, climb the renown ranks, and — if you hold the token — claim your share of the daily SOL pool.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative py-24">
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="container-x relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="kicker">🛡 From village to empire</span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">How it works</h2>
          <p className="mt-4 text-parchment-300/70">
            Four simple steps stand between you and a realm that rivals fear.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <div className="relative h-full rounded-2xl border border-parchment-300/10 bg-ink-800/60 p-6 shadow-panel">
                <div className="font-display text-5xl font-bold text-gold/25">{s.n}</div>
                <h3 className="mt-3 text-lg font-semibold text-parchment-100">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-parchment-300/70">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Ages showcase ───────────────────────────────────────────────────────────

export function Ages() {
  return (
    <section id="ages" className="relative py-24">
      <div className="container-x">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="kicker">⏳ March through time</span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
            The <span className="text-gold-gradient">four ages</span>
          </h2>
          <p className="mt-4 text-parchment-300/70">
            Each age you research unlocks new buildings, stronger units and greater storage. Power
            rewards the bold.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AGE_ORDER.map((id, i) => {
            const age = AGES[id];
            const meta = AGE_META[id];
            return (
              <Reveal key={id} delay={i * 0.08}>
                <div
                  className="relative h-full overflow-hidden rounded-2xl border p-6 shadow-panel"
                  style={{
                    borderColor: `${meta.color}55`,
                    background: `linear-gradient(160deg, ${meta.color}22, rgba(28,23,16,0.85))`,
                  }}
                >
                  <div
                    className="absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl"
                    style={{ background: `${meta.color}55` }}
                  />
                  <div className="relative">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-parchment-300/60">
                      Age {i + 1}
                    </div>
                    <h3 className="mt-2 font-display text-xl font-bold" style={{ color: meta.color }}>
                      {age.name}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-parchment-300/75">{age.blurb}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Leaderboard preview ─────────────────────────────────────────────────────

interface Row {
  name: string;
  banner: string;
  isBot: boolean;
  age: string;
  power: number;
  raidsWon: number;
  online: boolean;
}

export function LeaderboardPreview({ rows }: { rows: Row[] }) {
  const top = rows.slice(0, 6);
  return (
    <section className="relative py-24">
      <div className="container-x">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="kicker">👑 The mightiest realms</span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Live leaderboard</h2>
          <p className="mt-4 text-parchment-300/70">
            These empires lead the world right now. Will yours join them?
          </p>
        </Reveal>

        <Reveal className="mx-auto mt-12 max-w-3xl">
          <div className="overflow-hidden rounded-2xl border border-parchment-300/10 bg-ink-800/60 shadow-panel">
            {top.length === 0 && (
              <div className="p-8 text-center text-sm text-parchment-300/60">
                The world is still loading…
              </div>
            )}
            {top.map((r, i) => (
              <div
                key={r.name + i}
                className="flex items-center gap-4 border-b border-parchment-300/5 px-5 py-3.5 last:border-0"
              >
                <div
                  className={`w-7 text-center font-display text-lg font-bold ${
                    i === 0 ? "text-gold-light" : "text-parchment-300/50"
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className="h-6 w-6 shrink-0 rounded-md ring-1 ring-black/40"
                  style={{ background: r.banner }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-parchment-100">{r.name}</div>
                  <div className="text-xs text-parchment-300/55">
                    {AGE_META[r.age as keyof typeof AGE_META]?.name ?? r.age} ·{" "}
                    {r.isBot ? "AI empire" : "Ruler"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-gold-light">{fmt(r.power)}</div>
                  <div className="text-[11px] uppercase tracking-wider text-parchment-300/50">power</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link to="/leaderboard" className="btn-ghost btn-sm">
              View full leaderboard →
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Final CTA ───────────────────────────────────────────────────────────────

export function FinalCTA() {
  return (
    <section className="relative py-24">
      <div className="container-x">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-ink-700 to-ink-800 px-8 py-16 text-center shadow-deep">
            <div className="absolute inset-0 bg-hero-radial opacity-70" />
            <div className="absolute inset-0 bg-grid opacity-20" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold sm:text-4xl md:text-5xl">
                Your throne is <span className="text-gold-gradient">waiting</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-parchment-300/80">
                Found your empire in under a minute. Free to play, no download — just strategy,
                ambition and a world that never stops.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/register" className="btn-gold px-8 py-3 text-base">
                  ⚔ Begin your conquest
                </Link>
                <Link to="/leaderboard" className="btn-ghost px-8 py-3 text-base">
                  Scout the competition
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
