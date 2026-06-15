// ─────────────────────────────────────────────────────────────────────────────
// In-world battle spectate. Stages the resolved battle inside the isometric
// world — the defender's stronghold, with the two armies marching in, clashing
// and taking real casualties — so you actually watch the fight (AoE-style)
// rather than reading a paper result. Driven entirely by the BattleReport.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { LOCAL_WORLD, type BattleReport, type ResourceKind, type UnitType } from "@shared/types";
import { UNIT_TYPES } from "@shared/gamedata";
import { World, type Unit } from "../world/engine";
import { renderWorld } from "../world/draw";

const CAP = 16; // max soldier sprites drawn per side (each may represent several)
const ATT_COLOR = "#d8a52a"; // attacker tunic (gold)
const DEF_COLOR = "#7a2b3a"; // defender tunic (crimson)
const MARCH_END = 2.2; // seconds: armies finish marching into position
const CLASH_END = 7.4; // seconds: fighting ends, result shown

const RES_ICON: Record<ResourceKind, string> = { wood: "🪵", food: "🌾", gold: "🪙", stone: "🪨" };

type Meta = { x0: number; y0: number; x1: number; y1: number; deathAt: number; side: "att" | "def" };

// Turn an army (unit counts) into a capped, type-proportional list of sprites.
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
  const [phase, setPhase] = useState<"fight" | "done">("fight");
  const [runId, setRunId] = useState(0);

  const youAttacker = report.role === "attacker";
  const youWon = youAttacker ? report.attackerWon : !report.attackerWon;
  const foe = youAttacker ? report.defenderName : report.attackerName;
  const loot = (Object.entries(report.loot) as [ResourceKind, number][]).filter(([, v]) => v > 0);

  useEffect(() => {
    setPhase("fight");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const world = new World(7);
    world.enemies = []; // no bandits/wolves — this is an army battle
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
      const shuffled = sprites.map((_, i) => i).sort(() => Math.random() - 0.5);
      const doomed = new Set(shuffled.slice(0, deaths));

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
          id,
          type,
          x: formX,
          y: spawnY,
          hp: 100,
          maxHp: 100,
          speed: 2,
          atk: 5,
          attackId: null,
          order: { x: cx, y: side === "att" ? cy : cy + 12 },
          swing: 0,
          downUntil: 0,
          ox: 0,
          oy: 0,
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

    let raf = 0;
    let doneFired = false;
    let razedShown = false;
    const start = performance.now();

    const loop = (t: number) => {
      const el = (t - start) / 1000;
      const marchP = Math.min(1, el / MARCH_END);
      const now = t + performance.timeOrigin;

      for (const u of world.units) {
        const m = meta.get(u.id)!;
        u.x = m.x0 + (m.x1 - m.x0) * marchP;
        u.y = m.y0 + (m.y1 - m.y0) * marchP;
        if (el < MARCH_END) {
          u.order = { x: cx, y: m.side === "att" ? cy : cy + 12 }; // walking animation
          u.swing = 0;
        } else if (el < CLASH_END) {
          u.order = null;
          u.swing = 0.45 + Math.sin(el * 9 + u.id) * 0.4; // attack swings
        } else {
          u.order = null;
          u.swing = 0;
        }

        if (el >= m.deathAt) {
          if (u.downUntil === 0) {
            world.floats.push({ x: u.x, y: u.y, text: "☠", color: "#e0533f", born: now });
          }
          u.downUntil = Number.MAX_SAFE_INTEGER; // fallen
        } else if (Number.isFinite(m.deathAt) && el > MARCH_END) {
          const k = (el - MARCH_END) / Math.max(0.1, m.deathAt - MARCH_END);
          u.hp = Math.max(8, 100 - k * 92); // bleed toward death
        } else if (el > MARCH_END) {
          u.hp = Math.max(45, 100 - (el - MARCH_END) * 7); // survivors take some hits
        }
      }

      if (!razedShown && report.razed && el > (MARCH_END + CLASH_END) / 2) {
        razedShown = true;
        world.floats.push({ x: cx, y: cy - 1, text: `🔥 ${report.razed} razed!`, color: "#ffae57", born: now });
      }
      if (!doneFired && el > CLASH_END + 0.4) {
        doneFired = true;
        setPhase("done");
      }

      renderWorld(ctx, canvas.clientWidth, canvas.clientHeight, world, now, { hover: null, ghost: null });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [report, runId]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <canvas ref={canvasRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-xl border border-gold/25 bg-black/60 px-5 py-2 text-center backdrop-blur">
        <div className="font-display text-lg font-bold text-parchment-50">
          ⚔ {report.attackerName} <span className="text-parchment-300/60">invades</span> {report.defenderName}
        </div>
        <div className="text-xs text-parchment-300/60">Live at {report.defenderName}'s stronghold</div>
      </div>

      <button
        className="absolute right-4 top-4 rounded-lg border border-parchment-300/20 bg-black/60 px-3 py-1.5 text-sm text-parchment-100/90 hover:border-gold/50 hover:text-gold-light"
        onClick={onClose}
      >
        ✕ Close
      </button>

      {phase === "done" && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center pb-10">
          <div className="w-[min(520px,92vw)] rounded-2xl border border-gold/25 bg-ink/95 p-5 text-center shadow-2xl">
            <div className={`font-display text-2xl font-bold ${youWon ? "text-emerald-300" : "text-blood-light"}`}>
              {youWon ? "⚑ Victory!" : "☠ Defeat"}
            </div>
            <div className="mt-1 text-sm text-parchment-300/70">
              {youAttacker ? "Your raid on" : "Defence against"} {foe}
            </div>
            {loot.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm">
                <span className="text-parchment-300/60">Plunder:</span>
                {loot.map(([k, v]) => (
                  <span key={k} className="chip">
                    {RES_ICON[k]} {Math.round(v)}
                  </span>
                ))}
              </div>
            )}
            {report.razed && <div className="mt-2 text-xs text-orange-300">🔥 Razed their {report.razed}</div>}
            <div className="mt-4 flex justify-center gap-3">
              <button className="btn-ghost" onClick={() => setRunId((r) => r + 1)}>
                ↻ Replay
              </button>
              <button className="btn-gold" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
