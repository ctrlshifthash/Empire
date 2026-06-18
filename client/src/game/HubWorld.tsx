import { useEffect, useRef, useState } from "react";
import { useGame } from "../lib/store";
import { worldToScreen, TILE_W, TILE_H } from "../world/iso";
import { drawCharacter, drawBuilding } from "../world/draw";
import { drawTile, TILES } from "../world/tiles";
import type { BuildingView } from "../world/engine";

// The spatial hub: a shared, walkable town. You spawn as your hero sprite and
// stroll a real environment — grass, a cobblestone plaza, a fountain, houses and
// trees — alongside everyone else online, each shown with their name + level.
// Built from the game's own world art (tiles + building + character renderers).

const SPEED = 4.6; // tiles / second
const BOUND = 12; // how far you can walk from the centre
const PLAZA_R = 3.5; // cobblestone plaza radius around the fountain

type B = { type: BuildingView["type"]; x: number; y: number };
const BUILDINGS: B[] = [
  { type: "town_center", x: 0, y: -6 },
  { type: "house", x: -6, y: -3 },
  { type: "house", x: -7, y: 1 },
  { type: "barracks", x: 6, y: -4 },
  { type: "stable", x: 7, y: 1 },
  { type: "house", x: 5, y: 5 },
  { type: "lumber_camp", x: -5, y: 5 },
  { type: "house", x: 0, y: 8 },
];
// trees/rocks/bushes ringing the town (deterministic) — drawn as the game's glyphs
const DECOR: { x: number; y: number; g: string }[] = [
  [-10, -9, "🌲"], [-7, -11, "🌲"], [-3, -12, "🌲"], [1, -12, "🌲"], [5, -11, "🌲"], [9, -10, "🌲"],
  [11, -6, "🌲"], [12, -2, "🌲"], [12, 3, "🌲"], [10, 7, "🌲"], [7, 10, "🌲"], [3, 11, "🌲"],
  [-2, 12, "🌲"], [-6, 11, "🌲"], [-10, 9, "🌲"], [-12, 5, "🌲"], [-12, 0, "🌲"], [-11, -5, "🌲"],
  [-9, 3, "🌿"], [9, -7, "🪨"], [-3, 9, "🌿"], [8, 5, "🌲"], [-8, -6, "🪨"], [4, -9, "🌿"],
].map(([x, y, g]) => ({ x: x as number, y: y as number, g: g as string }));

type Local = { x: number; y: number; facing: number; moving: boolean; phase: number };
type RemoteDisp = { x: number; y: number; facing: number; moving: boolean; phase: number };

// Quick destinations reachable straight from the hub (so players aren't stuck).
const HUB_NAV: [string, string][] = [
  ["empire", "🏰 Buildings"],
  ["military", "⚔ Army"],
  ["armoury", "🛒 Armoury"],
  ["world", "🗡 Attack"],
  ["tokenshop", "💎 Shop"],
  ["quests", "📜 Quests"],
  ["rewards", "💰 Rewards"],
];

export default function HubWorld({ onOpenTab }: { onOpenTab: (tab: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hubEnter = useGame((s) => s.hubEnter);
  const hubLeave = useGame((s) => s.hubLeave);
  const hubMove = useGame((s) => s.hubMove);
  const hubChat = useGame((s) => s.hubChat);
  const messages = useGame((s) => s.hubMessages);
  const connected = useGame((s) => s.connected);
  const myId = useGame((s) => s.snapshot?.empire?.id);
  const myName = useGame((s) => s.snapshot?.empire?.name ?? "You");
  const myBanner = useGame((s) => s.snapshot?.empire?.banner ?? "#c0a020");
  const [chat, setChat] = useState("");

  const me = useRef<Local>({ x: 2, y: 2, facing: -1, moving: false, phase: 0 });
  const keys = useRef<Set<string>>(new Set());

  // join / leave the plaza (re-emit on (re)connect so the spawn isn't lost)
  useEffect(() => {
    if (connected) hubEnter();
    return () => hubLeave();
  }, [hubEnter, hubLeave, connected]);

  // keyboard (ignored while typing in the chat box)
  useEffect(() => {
    const MOVE = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"];
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (MOVE.includes(k)) {
        keys.current.add(k);
        if (k.startsWith("arrow")) e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // render + movement loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const disp = new Map<string, RemoteDisp>();
    let raf = 0;
    let last = performance.now();
    let sendAcc = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const stoneDiamond = (cx: number, cy: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(cx, cy - TILE_H / 2);
      ctx.lineTo(cx + TILE_W / 2, cy);
      ctx.lineTo(cx, cy + TILE_H / 2);
      ctx.lineTo(cx - TILE_W / 2, cy);
      ctx.closePath();
      ctx.fill();
    };

    const label = (cx: number, topY: number, name: string, level: number) => {
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = "700 9px ui-sans-serif, system-ui";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(`Lvl ${level}`, cx, topY - 12);
      ctx.fillStyle = "#e8c75a";
      ctx.fillText(`Lvl ${level}`, cx, topY - 12);
      ctx.font = "700 11px ui-sans-serif, system-ui";
      ctx.strokeText(name, cx, topY);
      ctx.fillStyle = "#fff";
      ctx.fillText(name, cx, topY);
    };

    const drawFountain = (cx: number, cy: number, t: number) => {
      ctx.fillStyle = "#6e675b";
      ctx.beginPath();
      ctx.ellipse(cx, cy, TILE_W * 0.66, TILE_H * 0.66, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#564f45";
      ctx.beginPath();
      ctx.ellipse(cx, cy, TILE_W * 0.58, TILE_H * 0.58, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3f93c6";
      ctx.beginPath();
      ctx.ellipse(cx, cy, TILE_W * 0.46, TILE_H * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      // ripples + spout
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      const r = (Math.sin(t / 600) + 1) * 0.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, TILE_W * (0.12 + r * 0.28), TILE_H * (0.12 + r * 0.28), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#bfe6f7";
      ctx.beginPath();
      ctx.ellipse(cx, cy - 16, 4, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;

      // ── input → movement (screen-relative isometric) ──
      const k = keys.current;
      let dx = 0;
      let dy = 0;
      if (k.has("w") || k.has("arrowup")) { dx -= 1; dy -= 1; }
      if (k.has("s") || k.has("arrowdown")) { dx += 1; dy += 1; }
      if (k.has("a") || k.has("arrowleft")) { dx -= 1; dy += 1; }
      if (k.has("d") || k.has("arrowright")) { dx += 1; dy -= 1; }
      const m = me.current;
      const moving = dx !== 0 || dy !== 0;
      if (moving) {
        const len = Math.hypot(dx, dy) || 1;
        m.x = Math.max(-BOUND, Math.min(BOUND, m.x + (dx / len) * SPEED * dt));
        m.y = Math.max(-BOUND, Math.min(BOUND, m.y + (dy / len) * SPEED * dt));
        const sdx = dx - dy;
        if (sdx !== 0) m.facing = sdx > 0 ? 1 : -1;
        m.phase += dt * 9;
      } else {
        m.phase += dt * 2;
      }
      m.moving = moving;

      sendAcc += dt;
      if (sendAcc >= 0.1) {
        sendAcc = 0;
        hubMove(m.x, m.y, m.facing, moving);
      }

      // ── camera centred on me ──
      const camS = worldToScreen(m.x, m.y);
      const ox = cw / 2 - camS.sx;
      const oy = ch / 2 - camS.sy + 30;
      const toScreen = (wx: number, wy: number) => {
        const p = worldToScreen(wx, wy);
        return { x: p.sx + ox, y: p.sy + oy };
      };

      // ── ground: real grass tiles + a cobblestone plaza ──
      ctx.fillStyle = "#3f7a3a";
      ctx.fillRect(0, 0, cw, ch);
      const R = 16;
      for (let wx = -R; wx <= R; wx++) {
        for (let wy = -R; wy <= R; wy++) {
          const s = toScreen(wx, wy);
          if (s.x < -TILE_W || s.x > cw + TILE_W || s.y < -TILE_H * 3 || s.y > ch + TILE_H) continue;
          const inPlaza = Math.abs(wx) <= PLAZA_R && Math.abs(wy) <= PLAZA_R;
          if (inPlaza) {
            stoneDiamond(s.x, s.y, (wx + wy) % 2 === 0 ? "#9a9488" : "#8b857a");
            continue;
          }
          const gi = Math.abs(wx * 7 + wy * 13) % TILES.grassBase.length;
          if (!drawTile(ctx, TILES.grassBase[gi], s.x, s.y)) stoneDiamond(s.x, s.y, (wx + wy) % 2 === 0 ? "#46863f" : "#3f7d39");
        }
      }

      // ── standing objects (buildings, trees, fountain, avatars) depth-sorted ──
      type Obj = { d: number; draw: () => void };
      const objs: Obj[] = [];

      objs.push({ d: 0.0, draw: () => drawFountain(toScreen(0, 0).x, toScreen(0, 0).y, t) });

      for (const b of BUILDINGS) {
        const s = toScreen(b.x, b.y);
        const view: BuildingView = { id: b.type + b.x, type: b.type, level: 2, x: b.x, y: b.y, constructing: false, completesAt: null };
        objs.push({ d: b.x + b.y, draw: () => drawBuilding(ctx, s.x, s.y, view, t) });
      }

      for (const o of DECOR) {
        const s = toScreen(o.x, o.y);
        objs.push({
          d: o.x + o.y,
          draw: () => {
            ctx.fillStyle = "rgba(0,0,0,0.22)";
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, 16, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = "42px serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(o.g, s.x, s.y + 6);
          },
        });
      }

      const remote = useGame.getState().hubAvatars;
      const myLvl = remote.find((a) => a.id === myId)?.level ?? 1;
      const seen = new Set<string>();
      objs.push({
        d: m.x + m.y + 0.001,
        draw: () => {
          const s = toScreen(m.x, m.y);
          drawCharacter(ctx, s.x, s.y, { color: myBanner, facing: m.facing, scale: 1.15, moving: m.moving, phase: m.phase, ring: "#e8c75a" });
          label(s.x, s.y - 36, myName, myLvl);
        },
      });
      for (const a of remote) {
        if (a.id === myId) continue;
        seen.add(a.id);
        let d = disp.get(a.id);
        if (!d) { d = { x: a.x, y: a.y, facing: a.facing, moving: a.moving, phase: 0 }; disp.set(a.id, d); }
        const lf = Math.min(1, dt * 12);
        d.x += (a.x - d.x) * lf;
        d.y += (a.y - d.y) * lf;
        d.facing = a.facing;
        d.phase += dt * (a.moving ? 9 : 2);
        const dd = d;
        objs.push({
          d: dd.x + dd.y,
          draw: () => {
            const s = toScreen(dd.x, dd.y);
            drawCharacter(ctx, s.x, s.y, { color: a.banner, facing: a.facing, scale: 1.15, moving: a.moving, phase: dd.phase });
            label(s.x, s.y - 36, a.name, a.level);
          },
        });
      }
      for (const id of [...disp.keys()]) if (!seen.has(id)) disp.delete(id);

      objs.sort((a, b) => a.d - b.d);
      for (const o of objs) o.draw();

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, myName, myBanner]);

  const send = () => {
    const t = chat.trim();
    if (!t) return;
    hubChat(t);
    setChat("");
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#3f7a3a]">
      <canvas ref={canvasRef} className="h-full w-full" />

      {/* hub navigation — reach any part of the game straight from the hub */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-xl border border-parchment-300/15 bg-black/60 px-2 py-1.5 backdrop-blur">
          <button className="btn-gold btn-sm" onClick={() => onOpenTab("live")}>
            ▶ Enter World
          </button>
          <span className="mx-0.5 h-5 w-px bg-parchment-300/20" />
          {HUB_NAV.map(([t, lbl]) => (
            <button
              key={t}
              onClick={() => onOpenTab(t)}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-parchment-100/80 transition-colors hover:bg-white/10 hover:text-gold-light"
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* controls hint */}
      <div className="pointer-events-none absolute right-3 top-16 rounded-lg bg-black/50 px-2.5 py-1 text-[11px] text-parchment-200 backdrop-blur">
        Walk with <b>WASD</b> / arrows
      </div>

      <div className="absolute bottom-3 left-3 w-[min(20rem,72vw)]">
        <div className="rounded-lg border border-parchment-300/15 bg-black/55 backdrop-blur">
          <div className="max-h-40 space-y-1 overflow-y-auto px-3 py-2 text-sm">
            {messages.length === 0 && <div className="text-parchment-300/50">Say hello to the realm…</div>}
            {messages.slice(-30).map((mm) => (
              <div key={mm.id} className="break-words">
                <span className="font-semibold" style={{ color: mm.banner }}>
                  {mm.fromName === myName ? "You" : mm.fromName}
                </span>
                <span className="text-parchment-300/50">: </span>
                <span className="text-parchment-100">{mm.text}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 border-t border-parchment-300/10 p-2">
            <input
              value={chat}
              onChange={(e) => setChat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={240}
              placeholder="Message the realm…"
              className="flex-1 rounded-md border border-parchment-300/15 bg-black/40 px-2 py-1 text-sm focus:border-gold/40 focus:outline-none"
            />
            <button className="btn-gold btn-sm px-2" disabled={!chat.trim()} onClick={send}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
