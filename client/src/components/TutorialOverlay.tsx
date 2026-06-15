import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameSnapshot } from "@shared/types";
import { levelForXp } from "@shared/progression";

interface Step {
  title: string;
  body: ReactNode;
  goto?: string; // optional tab to jump to
  gotoLabel?: string;
  // auto-advance when this returns true (omit for purely manual steps)
  auto?: (s: GameSnapshot, tab: string) => boolean;
}

const STEPS: Step[] = [
  {
    title: "Welcome, ruler! 👑",
    body: (
      <>
        You command an <strong>empire in a living world</strong> that keeps running 24/7. This quick tour
        teaches the basics in a minute. You can <em>Skip</em> any time.
      </>
    ),
  },
  {
    title: "Move your hero 🏃",
    body: (
      <>
        You're the gold character in the <strong>🌍 Adventure</strong> view. <strong>Left‑click the ground</strong>{" "}
        (or use <strong>WASD</strong>) to walk. <strong>Scroll</strong> to zoom in and out. Click <em>Next</em> when
        you've moved around.
      </>
    ),
    goto: "live",
    gotoLabel: "Go to Adventure",
  },
  {
    title: "Gather resources 🌲",
    body: (
      <>
        <strong>Left‑click a tree 🌲</strong> (or 🪨 rock, 💎 vein, 🌿 bush). Your hero walks over and harvests it —
        you gain resources <em>and</em> Woodcutting XP. Try chopping a tree now.
      </>
    ),
    auto: (s) => levelForXp(s.empire.hero?.skills.woodcutting ?? 0) >= 1 && (s.empire.hero?.skills.woodcutting ?? 0) > 0,
  },
  {
    title: "Build your empire 🏗️",
    body: (
      <>
        Open the <strong>Build bar</strong> at the bottom, pick a <strong>House</strong>, then click a spot to place
        it. The camera flies to your new building as it rises.
      </>
    ),
    auto: (s) => s.empire.buildings.some((b) => b.type === "house"),
  },
  {
    title: "Level up your hero 🦸",
    body: (
      <>
        Open the <strong>🦸 Hero</strong> tab to see your <strong>skills</strong> (they level up as you play) and
        <strong> upgrade your tools</strong> — a better axe gathers more, a better sword hits harder.
      </>
    ),
    goto: "hero",
    gotoLabel: "Open Hero tab",
    auto: (_s, tab) => tab === "hero",
  },
  {
    title: "Raise an army & fight ⚔️",
    body: (
      <>
        Train troops in the <strong>⚔️ Military</strong> tab — they follow you in the world. Back in{" "}
        <strong>Adventure</strong>, <strong>left‑click an enemy</strong> to attack (drag a box to select your units,
        then <strong>right‑click</strong> to command them). Slaying foes gives Combat XP + loot.
      </>
    ),
    auto: (s) => (s.empire.hero?.skills.combat ?? 0) > 0,
  },
  {
    title: "Invade rival empires 🗺️",
    body: (
      <>
        Open the <strong>🗺️ Map</strong>, click a rival empire, and launch a <strong>raid</strong>. Win to{" "}
        <strong>plunder their resources</strong>, earn XP and coins — and a decisive win <strong>razes one of their
        buildings</strong>, pushing you up the leaderboard.
      </>
    ),
    goto: "world",
    gotoLabel: "Open the Map",
    auto: (s) => s.outgoingMarches.length > 0 || s.empire.raidsWon > 0,
  },
  {
    title: "You're ready! 🔥",
    body: (
      <>
        That's the loop: <strong>gather → build → advance ages → train → invade → level up</strong>. Your empire
        grows even while you're away. Go forge a realm that never sleeps!
      </>
    ),
  },
];

export default function TutorialOverlay({
  snapshot,
  currentTab,
  onTab,
  onFinish,
}: {
  snapshot: GameSnapshot;
  currentTab: string;
  onTab: (tab: string) => void;
  onFinish: () => void;
}) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  // auto-advance when the current step's objective is met
  useEffect(() => {
    if (step.auto && step.auto(snapshot, currentTab)) {
      const t = setTimeout(() => setI((x) => Math.min(STEPS.length - 1, x + 1)), 700);
      return () => clearTimeout(t);
    }
  }, [snapshot, currentTab, step]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[7.5rem] z-50 flex justify-center px-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-auto w-full max-w-lg rounded-2xl border border-gold/40 bg-ink-800/95 p-5 shadow-deep backdrop-blur-md"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-light/90">
              ★ Tutorial · Step {i + 1} of {STEPS.length}
            </span>
            <button className="text-xs text-parchment-300/60 hover:text-parchment-100" onClick={onFinish}>
              Skip ✕
            </button>
          </div>

          <h3 className="font-display text-lg font-bold text-parchment-100">{step.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-parchment-300/85">{step.body}</p>

          {/* progress dots */}
          <div className="mt-4 flex items-center gap-1.5">
            {STEPS.map((_, k) => (
              <span
                key={k}
                className={`h-1.5 rounded-full transition-all ${
                  k === i ? "w-5 bg-gold" : k < i ? "w-1.5 bg-gold/60" : "w-1.5 bg-parchment-300/20"
                }`}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              className="text-xs text-parchment-300/60 hover:text-parchment-100 disabled:opacity-40"
              onClick={() => setI((x) => Math.max(0, x - 1))}
              disabled={i === 0}
            >
              ← Back
            </button>
            <div className="flex gap-2">
              {step.goto && step.goto !== currentTab && (
                <button className="btn-ghost btn-sm" onClick={() => onTab(step.goto!)}>
                  {step.gotoLabel ?? "Go"}
                </button>
              )}
              {last ? (
                <button className="btn-gold btn-sm" onClick={onFinish}>
                  ⚔ Start playing
                </button>
              ) : (
                <button className="btn-gold btn-sm" onClick={() => setI((x) => Math.min(STEPS.length - 1, x + 1))}>
                  Next →
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
