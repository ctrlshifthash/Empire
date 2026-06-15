// ─────────────────────────────────────────────────────────────────────────────
// In-world battle spectate. Stages the resolved battle inside the isometric
// world — the defender's stronghold, with the two armies marching in, clashing,
// taking real casualties and their buildings being wrecked. Driven by the
// BattleReport. Has a scrubbable timeline and a free camera (drag + zoom).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { LOCAL_WORLD, type BattleReport, type ResourceKind, type UnitType } from "@shared/types";
import { UNIT_TYPES } from "@shared/gamedata";
import { World, type Unit } from "../world/engine";
import { renderWorld } from "../world/draw";

const CAP = 16; // max soldier sprites per side
const ATT_COLOR = "#d8a52a"; // attacker tunic (gold)
const DEF_COLOR = "#7a2b3a"; // defender tunic (crimson)
const MARCH_END = 2.2; // armies finish marching into position
const CLASH_END = 7.4; // fighting ends
const TOTAL = 9.0; // whole timeline (hold on the result after the clash)

const RES_ICON: Record<ResourceKind, string> = { wood: "🪵", food: "🌾", gold: "🪙", stone: "🪨" };

type Meta = { x0: number; y0: number; x1: number; y1: number; deathAt: number; side: "att" | "def" };

function spriteTypes(army: Partial<Record<UnitType, number>>): UnitType[] {
  const types = UNIT_TYPES.filter((t) => (army[t] ?? 0) > 0);
  const total = types.reduce((s, t) => s + (army[t] ?? 0), 0);
  if (total === 0) return [];
  const n = Math.min(total, CAP);
  const out: UnitType[] = [];
  for (const t of types) {
    const share = Math.max(1, Math.round((n * (army[t] ?? 0)) / total));
    for (let i = 0; i < share && out.length < n; i++) out.push(t);
  }
  while (out.length < n && types.length) out.push(types[out.length % types.length]);
  return out.slice(0, n);
}

export default function BattleSpectate({ report, onClose }: { report: BattleReport; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phRef = useRef(0); // playhead seconds (authoritative)
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const [ui, setUi] = useState({ ph: 0, playing: true, speed: 1 });
  const [runId, setRunId] = useState(0);

  const youAttacker = report.role === "attacker";
  const youWon = youAttacker ? report.attackerWon : !report.attackerWon;
  const foe = youAttacker ? report.defenderName : report.attackerName;
  const loot = (Object.entries(report.loot) as [ResourceKind, number][]).filter(([, v]) => v > 0);
  const razed = report.razed ?? [];

  useEffect(() => {
    phRef.current = 0;
    playingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const world = new World(7);
    world.enemies = [];
    world.hero.deadUntil = Number.MAX_SAFE_INTEGER; // hide the player hero
    const cx = LOCAL_WORLD.centerX;
    const cy = LOCAL_WORLD.centerY;

    const meta = new Map<number, Meta>();
    let nid = 1;
    const buildSide = (
      army: Partial<Record<UnitType, number>>,
      losses: Partial<Record<UnitType, number>>,
      side: "att" | "def",
    ): Unit[] => {
      const sprites = spriteTypes(army);
      if (sprites.length === 0) return [];
      const total = UNIT_TYPES.reduce((s, t) => s + (army[t] ?? 0), 0);
      const lost = UNIT_TYPES.reduce((s, t) => s + (losses[t] ?? 0), 0);
      const deaths = Math.min(sprites.length, Math.round((sprites.length * lost) / Math.max(1, total)));
      const doomed = new Set(sprites.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, deaths));
      return sprites.map((type, i) => {
        const col = i % 6;
        const row = Math.floor(i / 6);
        const formX = cx - 2.5 + col * 1.0 + (Math.random() - 0.5) * 0.3;
        const spawnY = side === "att" ? cy + 11 + row * 0.9 : cy + 4 - row * 0.9;
        const clashY = side === "att" ? cy + 7.6 + row * 0.5 : cy + 6.4 - row * 0.5;
        const id = nid++;
        meta.set(id, {
          x0: formX,
          y0: spawnY,
          x1: formX,
          y1: clashY,
          deathAt: doomed.has(i) ? MARCH_END + 0.5 + Math.random() * (CLASH_END - MARCH_END - 1.2) : Infinity,
          side,
        });
        return {
          id, type, x: formX, y: spawnY, hp: 100, maxHp: 100, speed: 2, atk: 5,
          attackId: null, order: { x: cx, y: side === "att" ? cy : cy + 12 }, swing: 0,
          downUntil: 0, ox: 0, oy: 0,
          color: side === "att" ? ATT_COLOR : DEF_COLOR,
          ring: side === "att" ? "rgba(216,165,42,0.5)" : "rgba(160,60,70,0.5)",
          face: side === "att" ? 1 : -1,
        } as Unit;
      });
    };

    world.units = [
      ...buildSide(report.attackerArmy, report.attackerLosses, "att"),
      ...buildSide(report.defenderArmy, report.defenderLosses, "def"),
    ];
    world.cam = { x: cx, y: cy + 7 };
    world.zoom = 0.78;

    // schedule building destruction: map each razed building to a plot + a time
    const basePlots = [...(world.town?.decorPlots ?? [])];
    const plotOrder = basePlots.map((_, i) => i).sort(() => Math.random() - 0.5);
    const razeAt = razed.map((name, k) => ({
      idx: plotOrder[k % Math.max(1, plotOrder.length)],
      t: MARCH_END + 1 + (k + 1) * ((CLASH_END - MARCH_END - 1.6) / (razed.length + 1)),
      name,
      shown: false,
    }));

    // free camera: drag to pan, wheel to zoom
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: MouseEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      world.panByScreen(-(e.clientX - lastX), -(e.clientY - lastY));
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      world.zoom = Math.max(0.3, Math.min(2.6, world.zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
    };
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // pure function of the playhead, so scrubbing back and forth is consistent
    const apply = (ph: number, now: number) => {
      const marchP = Math.min(1, ph / MARCH_END);
      for (const u of world.units) {
        const m = meta.get(u.id)!;
        u.x = m.x0 + (m.x1 - m.x0) * marchP;
        u.y = m.y0 + (m.y1 - m.y0) * marchP;
        if (ph < MARCH_END) {
          u.order = { x: cx, y: m.side === "att" ? cy : cy + 12 };
          u.swing = 0;
          u.downUntil = 0;
          u.hp = 100;
        } else {
          u.order = null;
          u.swing = ph < CLASH_END ? 0.45 + Math.sin(ph * 9 + u.id) * 0.4 : 0;
          if (ph >= m.deathAt) {
            u.downUntil = Number.MAX_SAFE_INTEGER;
          } else {
            u.downUntil = 0;
            if (Number.isFinite(m.deathAt)) {
              const k = (ph - MARCH_END) / Math.max(0.1, m.deathAt - MARCH_END);
              u.hp = Math.max(8, 100 - k * 92);
            } else {
              u.hp = Math.max(45, 100 - (ph - MARCH_END) * 7);
            }
          }
        }
      }
      // wreck buildings: drop their plots, with a one-off fire callout
      const gone = new Set<number>();
      for (const r of razeAt) {
        if (ph >= r.t) {
          gone.add(r.idx);
          if (!r.shown && playingRef.current) {
            r.shown = true;
            world.floats.push({ x: cx - 1, y: cy - 1, text: `🔥 ${r.name} destroyed!`, color: "#ffae57", born: now });
          }
        }
      }
      if (world.town) world.town.decorPlots = basePlots.filter((_, i) => !gone.has(i));
    };

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (playingRef.current) {
        phRef.current = Math.min(TOTAL, phRef.current + dt * speedRef.current);
        if (phRef.current >= TOTAL) playingRef.current = false;
      }
      const now = t + performance.timeOrigin;
      apply(phRef.current, now);
      renderWorld(ctx, canvas.clientWidth, canvas.clientHeight, world, now, { hover: null, ghost: null });
      setUi((prev) =>
        Math.abs(prev.ph - phRef.current) > 0.04 || prev.playing !== playingRef.current || prev.speed !== speedRef.current
          ? { ph: phRef.current, playing: playingRef.current, speed: speedRef.current }
          : prev,
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [report, runId]);

  const done = ui.ph >= CLASH_END + 0.4;
  const phase = ui.ph < MARCH_END ? "March" : ui.ph < CLASH_END ? "Clash" : "Aftermath";

  const togglePlay = () => {
    if (phRef.current >= TOTAL) phRef.current = 0;
    playingRef.current = !playingRef.current;
    setUi({ ph: phRef.current, playing: playingRef.current, speed: speedRef.current });
  };
  const scrub = (v: number) => {
    phRef.current = v;
    playingRef.current = false;
    setUi({ ph: v, playing: false, speed: speedRef.current });
  };
  const cycleSpeed = () => {
    speedRef.current = speedRef.current === 1 ? 2 : speedRef.current === 2 ? 0.5 : 1;
    setUi((u) => ({ ...u, speed: speedRef.current }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <canvas ref={canvasRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-xl border border-gold/25 bg-black/60 px-5 py-2 text-center backdrop-blur">
        <div className="font-display text-lg font-bold text-parchment-50">
          ⚔ {report.attackerName} <span className="text-parchment-300/60">invades</span> {report.defenderName}
        </div>
        <div className="text-xs text-parchment-300/60">Live at {report.defenderName}'s stronghold · drag to pan · scroll to zoom</div>
      </div>

      <button
        className="absolute right-4 top-4 rounded-lg border border-parchment-300/20 bg-black/60 px-3 py-1.5 text-sm text-parchment-100/90 hover:border-gold/50 hover:text-gold-light"
        onClick={onClose}
      >
        ✕ Close
      </button>

      {/* result card sits above the timeline */}
      {done && (
        <div className="absolute inset-x-0 bottom-24 flex justify-center">
          <div className="w-[min(520px,92vw)] rounded-2xl border border-gold/25 bg-ink/95 p-4 text-center shadow-2xl">
            <div className={`font-display text-xl font-bold ${youWon ? "text-emerald-300" : "text-blood-light"}`}>
              {youWon ? "⚑ Victory!" : "☠ Defeat"}
            </div>
            <div className="text-xs text-parchment-300/70">
              {youAttacker ? "Your raid on" : "Defence against"} {foe}
            </div>
            {loot.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-2 text-sm">
                <span className="text-parchment-300/60">Plunder:</span>
                {loot.map(([k, v]) => (
                  <span key={k} className="chip">
                    {RES_ICON[k]} {Math.round(v)}
                  </span>
                ))}
              </div>
            )}
            {razed.length > 0 && (
              <div className="mt-1.5 text-xs text-orange-300">🔥 Wrecked: {razed.join(", ")}</div>
            )}
            <button className="btn-gold mt-3" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* timeline / transport controls */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-4">
        <div className="flex w-[min(820px,96vw)] items-center gap-3 rounded-xl border border-parchment-300/15 bg-black/70 px-4 py-2.5 backdrop-blur">
          <button
            className="rounded-md border border-parchment-300/20 bg-white/5 px-3 py-1 text-sm hover:border-gold/50"
            onClick={togglePlay}
          >
            {ui.playing ? "⏸" : "▶"}
          </button>
          <span className="w-20 shrink-0 text-xs font-semibold text-gold-light">{phase}</span>
          <input
            type="range"
            min={0}
            max={TOTAL}
            step={0.01}
            value={ui.ph}
            onChange={(e) => scrub(parseFloat(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-gold"
          />
          <span className="w-14 shrink-0 text-right text-xs tabular-nums text-parchment-300/70">
            {ui.ph.toFixed(1)}s
          </span>
          <button
            className="rounded-md border border-parchment-300/20 bg-white/5 px-2 py-1 text-xs hover:border-gold/50"
            onClick={cycleSpeed}
            title="Playback speed"
          >
            {ui.speed}×
          </button>
          <button
            className="rounded-md border border-parchment-300/20 bg-white/5 px-2 py-1 text-xs hover:border-gold/50"
            onClick={() => setRunId((r) => r + 1)}
            title="Replay from the start"
          >
            ↻
          </button>
        </div>
      </div>
    </div>
  );
}
