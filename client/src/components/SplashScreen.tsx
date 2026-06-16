import { useEffect, useState } from "react";

// A game-style intro/loading screen: the splash art, the title, and a loading
// bar that fills before fading into the site. Shows once per full page load;
// click anywhere to skip.
export default function SplashScreen() {
  const [phase, setPhase] = useState<"in" | "out" | "done">("in");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setProgress(100)); // fill the bar
    const fade = setTimeout(() => setPhase("out"), 2100);
    const done = setTimeout(() => setPhase("done"), 2650);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      onClick={() => setPhase("out")}
      className={`fixed inset-0 z-[100] cursor-pointer overflow-hidden bg-ink transition-opacity duration-500 ${
        phase === "out" ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* splash art */}
      <img src="/splash.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      {/* vignette so the title/bar read, warriors stay visible in the middle */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/20 to-ink" />
      <div className="absolute inset-0 bg-ink/25" />

      <div className="relative flex h-full flex-col items-center justify-between py-12 sm:py-16">
        {/* top: brand */}
        <div className="mt-4 text-center">
          <h1 className="font-display text-5xl font-extrabold leading-none text-gold-gradient drop-shadow-[0_4px_18px_rgba(0,0,0,0.75)] sm:text-7xl">
            Realm Rumble
          </h1>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.35em] text-parchment-100/80 drop-shadow sm:text-sm">
            Build · Conquer · Endure
          </p>
        </div>

        {/* bottom: loading bar */}
        <div className="w-full max-w-xs px-4 text-center">
          <div className="h-2.5 overflow-hidden rounded-full bg-black/55 ring-1 ring-gold/25">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold-light transition-[width] duration-[2000ms] ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 animate-pulse text-xs uppercase tracking-[0.25em] text-parchment-200/85">
            Entering the realm…
          </p>
          <p className="mt-4 text-[10px] uppercase tracking-wider text-parchment-300/40">click to skip</p>
        </div>
      </div>
    </div>
  );
}
