import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../lib/store";
import { SPIN_SEGMENTS, SPIN_COOLDOWN_MS } from "@shared/gamedata";
import { fetchFeatureLocks } from "../lib/features";

// Spinner Wheel (beta). One free spin every 12h — lands on a resource or relic
// reward. Locked behind the `spinner` beta flag until released on Railway.
const N = SPIN_SEGMENTS.length;
const SEG = 360 / N;

export default function SpinnerWheel() {
  const empire = useGame((s) => s.snapshot?.empire);
  const spin = useGame((s) => s.spin);
  const spinResult = useGame((s) => s.spinResult);

  const [locked, setLocked] = useState<boolean | null>(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [reward, setReward] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastNonce = useRef<number>(spinResult?.nonce ?? 0);

  useEffect(() => {
    fetchFeatureLocks().then((l) => setLocked(l.spinner !== false));
  }, []);

  // live cooldown clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const readyAt = (empire?.lastSpinAt ?? 0) + SPIN_COOLDOWN_MS;
  const ready = now >= readyAt;
  const cd = Math.max(0, readyAt - now);

  // react to a fresh server result
  useEffect(() => {
    if (!spinResult || spinResult.nonce === lastNonce.current) return;
    lastNonce.current = spinResult.nonce;
    if (!spinResult.ok || spinResult.index == null) {
      setSpinning(false); // server already toasted the reason
      return;
    }
    const idx = spinResult.index;
    const landing = 360 - (idx * SEG + SEG / 2); // bring this segment's centre to the top pointer
    const base = (Math.floor(rotation / 360) + 6) * 360; // 6 extra turns
    setRotation(base + landing);
    const reveal = setTimeout(() => {
      setSpinning(false);
      setReward(spinResult.reward ?? "a prize");
    }, 4200);
    return () => clearTimeout(reveal);
  }, [spinResult, rotation]);

  const dial = useMemo(
    () => `conic-gradient(${SPIN_SEGMENTS.map((s, i) => `${s.color} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(", ")})`,
    [],
  );

  const doSpin = () => {
    if (spinning || !ready || locked) return;
    setReward(null);
    setSpinning(true);
    spin();
  };

  return (
    <div className="mx-auto max-w-md px-4 py-8 text-center">
      <div className="mb-1 flex items-center justify-center gap-2">
        <h2 className="font-display text-2xl font-bold text-gold-gradient">Spinner Wheel</h2>
        <span className="rounded-full border border-purple-400/40 bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-200">Beta</span>
      </div>
      <p className="mb-6 text-sm text-parchment-300/65">One free spin every 12 hours. Win resources — or a rare relic.</p>

      {/* wheel */}
      <div className="relative mx-auto h-72 w-72">
        {/* pointer */}
        <div className="absolute left-1/2 top-[-6px] z-20 -translate-x-1/2" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))" }}>
          <div className="h-0 w-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-gold-light" />
        </div>
        <div
          className="absolute inset-0 rounded-full border-[6px] border-parchment-900/60 shadow-2xl"
          style={{
            background: dial,
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 4s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
          }}
        >
          {SPIN_SEGMENTS.map((s, i) => (
            <div
              key={s.id}
              className="absolute left-1/2 top-1/2 origin-top"
              style={{ transform: `rotate(${i * SEG + SEG / 2}deg) translateY(8px)` }}
            >
              <span className="block -translate-x-1/2 text-2xl" style={{ transform: `translateY(86px) rotate(${-(i * SEG + SEG / 2)}deg)` }}>
                {s.icon}
              </span>
            </div>
          ))}
        </div>
        {/* hub */}
        <div className="absolute left-1/2 top-1/2 z-10 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-gold/70 bg-parchment-900 shadow-lg" />

        {locked && (
          <div className="absolute inset-0 z-30 grid place-items-center rounded-full bg-black/70 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-3xl">🔒</div>
              <div className="mt-1 text-sm font-semibold text-parchment-100">In beta — coming soon</div>
            </div>
          </div>
        )}
      </div>

      {/* reward / action */}
      <div className="mt-6 min-h-[1.5rem] text-sm font-semibold text-gold-light">
        {reward ? `🎉 You won ${reward}` : spinning ? "Spinning…" : ""}
      </div>
      <button
        className="btn-gold mt-3 w-48"
        disabled={spinning || !ready || !!locked}
        onClick={doSpin}
      >
        {locked ? "Locked" : spinning ? "Spinning…" : ready ? "Spin (Free)" : fmtCd(cd)}
      </button>
      {!locked && !ready && <p className="mt-2 text-[11px] text-parchment-300/45">Next free spin in {fmtCd(cd)}</p>}
    </div>
  );
}

function fmtCd(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
