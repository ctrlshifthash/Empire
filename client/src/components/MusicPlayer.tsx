import { useEffect, useState } from "react";
import { useGame } from "../lib/store";

// Looping ambient soundtrack with a floating mute toggle. Plays a livelier track
// while you're in the hub, and the theme everywhere else. Browsers block audio
// until the user interacts, so when enabled we start it on the first interaction.
// (If the hub track file isn't present, it falls back to the theme — never silent.)
const LS = "rr_music";
const THEME = "/music/theme.m4a";
const HUB = "/music/hub.mp3"; // upbeat CC0 hub track (public domain, no attribution)

// ONE shared <audio> for the whole app, held at module scope. React StrictMode,
// route changes and HMR all reuse this exact element, so a second overlapping
// track (e.g. the main-page theme bleeding into the hub) can never exist.
let shared: HTMLAudioElement | null = null;
function sharedAudio(): HTMLAudioElement {
  if (!shared) {
    const a = new Audio();
    a.loop = true;
    a.volume = 0.32;
    a.preload = "auto";
    a.addEventListener("error", () => {
      // hub track missing/unsupported → fall back to the theme so it's never silent
      if (a.src.includes("/hub.")) {
        a.src = THEME;
        a.play().catch(() => {});
      }
    });
    shared = a;
  }
  return shared;
}

export default function MusicPlayer() {
  const inHub = useGame((s) => s.inHub);
  const [on, setOn] = useState(() => {
    try {
      const v = localStorage.getItem(LS);
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });

  // pick the track for the current context (hub vs. elsewhere) + play/pause.
  // Switching src on the single element guarantees the theme stops in the hub.
  useEffect(() => {
    const a = sharedAudio();
    try {
      localStorage.setItem(LS, on ? "1" : "0");
    } catch {
      /* ignore */
    }
    const want = inHub ? HUB : THEME;
    if (a.src.split("/").pop() !== want.split("/").pop()) {
      a.pause(); // stop the outgoing track before loading the new one
      a.src = want;
    }

    if (!on) {
      a.pause();
      return;
    }
    a.play().catch(() => {
      const events = ["pointerdown", "keydown", "wheel", "touchstart"];
      const start = () => {
        a.play().catch(() => {});
        events.forEach((e) => window.removeEventListener(e, start));
      };
      events.forEach((e) => window.addEventListener(e, start, { once: true, passive: true }));
    });
  }, [on, inHub]);

  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      aria-label={on ? "Mute music" : "Play music"}
      title={on ? "Mute music" : "Play music"}
      className="fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-gold/30 bg-ink-800/80 text-gold-light shadow-deep backdrop-blur-sm transition-colors hover:border-gold/60 hover:text-gold"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M20 3.5 8 5.9v9.04A3 3 0 1 0 10 17.5V8.7l8-1.6v5.84A3 3 0 1 0 20 15.5V3.5z" />
        {!on && (
          <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
