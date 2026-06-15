import { Link } from "react-router-dom";
import Reveal from "./Reveal";
import { AGES, AGE_ORDER } from "@shared/gamedata";
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
    title: "Build & Expand",
    body: "Raise lumber camps, farms, mines, barracks, walls and more. Every building you place and upgrade strengthens your settlement and unlocks new strategies.",
  },
  {
    icon: "⚔️",
    title: "Raise Armies & Raid",
    body: "Train spearmen, archers and thundering knights, then march on rival empires to plunder their resources. Fortify your walls before they march on you.",
  },
  {
    icon: "🏛️",
    title: "Four Ages of History",
    body: "Advance from the humble Dark Age through Feudal and Castle to the mighty Imperial Age, unlocking powerful buildings and units at every step.",
  },
  {
    icon: "📜",
    title: "Quests & Coins",
    body: "Complete quests as you grow to earn coins and resource rewards. Spend coins to rush construction, finish research and accelerate your rise to power.",
  },
  {
    icon: "🤖",
    title: "Players & Cunning Bots",
    body: "Test your strategy against real rulers worldwide or against AI empires that build, expand and raid with a will of their own. The world is always full of rivals.",
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
            Empires Eternal blends the depth of a classic real-time strategy game with the
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

// ── How it works ────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    title: "Found your empire",
    body: "Pick a name and a banner colour. Your town center rises on the shared world map with villagers ready to work.",
  },
  {
    n: "02",
    title: "Grow your economy",
    body: "Build lumber camps, farms, mines and quarries. Resources flow in every second — even while you're away.",
  },
  {
    n: "03",
    title: "Raise an army",
    body: "Construct military buildings and train troops. Advance through the ages to unlock archers and knights.",
  },
  {
    n: "04",
    title: "Conquer & climb",
    body: "Raid rivals for loot, defend your walls, complete quests for coins, and climb the global leaderboard.",
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
