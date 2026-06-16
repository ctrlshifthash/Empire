import { useEffect, useRef, useState } from "react";

// Looping ambient soundtrack with a floating mute toggle. Browsers block audio
// with sound until the user interacts, so when music is enabled we start it on
// the first click/keypress. The on/off choice is remembered.
const LS = "rr_music";
const TRACK = "/music/theme.mp3";

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(() => {
    try {
      const v = localStorage.getItem(LS);
      return v === null ? true : v === "1"; // default on (themed), but silent until first interaction
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const a = new Audio(TRACK);
    a.loop = true;
    a.volume = 0.32;
    a.preload = "auto";
    audioRef.current = a;
    return () => a.pause();
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    try {
      localStorage.setItem(LS, on ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!on) {
      a.pause();
      return;
    }
    // try to play; if the browser blocks it, start on the first interaction
    a.play().catch(() => {
      const start = () => {
        a.play().catch(() => {});
        window.removeEventListener("pointerdown", start);
        window.removeEventListener("keydown", start);
      };
      window.addEventListener("pointerdown", start, { once: true });
      window.addEventListener("keydown", start, { once: true });
    });
  }, [on]);

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
