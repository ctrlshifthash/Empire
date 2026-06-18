import { useEffect, useRef, useState } from "react";
import { useGame } from "../lib/store";
import { worldToScreen, TILE_W, TILE_H } from "../world/iso";
import { drawCharacter } from "../world/draw";

// The spatial hub: a shared walkable plaza. You spawn as your hero sprite, walk
// with WASD / arrows, and see everyone else online moving around in real time
// with their name + level. Chat is docked bottom-left; head into your world from
// the top-right. (Art is placeholder — a tileset skin comes later.)

const SPEED = 4.6; // tiles / second
const BOUND = 11; // plaza half-extent (matches the server)

type Local = { x: number; y: number; facing: number; moving: boolean; phase: number };
type RemoteDisp = { x: number; y: number; facing: number; moving: boolean; phase: number };

export default function HubWorld({ onEnter }: { onEnter: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hubEnter = useGame((s) => s.hubEnter);
  const hubLeave = useGame((s) => s.hubLeave);
  const hubMove = useGame((s) => s.hubMove);
  const hubChat = useGame((s) => s.hubChat);
  const messages = useGame((s) => s.hubMessages);
  const myId = useGame((s) => s.snapshot?.empire?.id);
  const myName = useGame((s) => s.snapshot?.empire?.name ?? "You");
  const myBanner = useGame((s) => s.snapshot?.empire?.banner ?? "#c0a020");
  const [chat, setChat] = useState("");

  const me = useRef<Local>({ x: 0, y: 0, facing: 1, moving: false, phase: 0 });
  const keys = useRef<Set<string>>(new Set());

  // join / leave the plaza
  useEffect(() => {
    hubEnter();
    return () => hubLeave();
  }, [hubEnter, hubLeave]);

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
    const disp = new Map<string, RemoteDisp>(); // smoothed remote positions
    let raf = 0;
    let last = performance.now();
    let sendAcc = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const diamond = (cx: number, cy: number, fill: string) => {
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
      ctx.font = "700 11px ui-sans-serif, system-ui";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.fillStyle = "#fff";
      ctx.strokeText(name, cx, topY);
      ctx.fillText(name, cx, topY);
      ctx.font = "700 9px ui-sans-serif, system-ui";
      ctx.strokeText(`Lvl ${level}`, cx, topY - 12);
      ctx.fillStyle = "#e8c75a";
      ctx.fillText(`Lvl ${level}`, cx, topY - 12);
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
        const sdx = dx - dy; // screen-x direction
        if (sdx !== 0) m.facing = sdx > 0 ? 1 : -1;
        m.phase += dt * 9;
      } else {
        m.phase += dt * 2;
      }
      m.moving = moving;

      // throttled position broadcast (~10/sec)
      sendAcc += dt;
      if (sendAcc >= 0.1) {
        sendAcc = 0;
        hubMove(m.x, m.y, m.facing, moving);
      }

      // ── camera centred on me ──
      const camS = worldToScreen(m.x, m.y);
      const ox = cw / 2 - camS.sx;
      const oy = ch / 2 - camS.sy;
      const toScreen = (wx: number, wy: number) => {
        const p = worldToScreen(wx, wy);
        return { x: p.sx + ox, y: p.sy + oy };
      };

      // ── ground ──
      ctx.fillStyle = "#3f7a3a"; // grass beyond the plaza
      ctx.fillRect(0, 0, cw, ch);
      for (let wx = -BOUND - 1; wx <= BOUND + 1; wx++) {
        for (let wy = -BOUND - 1; wy <= BOUND + 1; wy++) {
          const s = toScreen(wx, wy);
          if (s.x < -TILE_W || s.x > cw + TILE_W || s.y < -TILE_H || s.y > ch + TILE_H) continue;
          const inPlaza = Math.abs(wx) <= BOUND && Math.abs(wy) <= BOUND;
          if (!inPlaza) { diamond(s.x, s.y, (wx + wy) % 2 === 0 ? "#46863f" : "#417d3b"); continue; }
          diamond(s.x, s.y, (wx + wy) % 2 === 0 ? "#8a8377" : "#7c766b");
        }
      }
      // fountain at the centre
      const f = toScreen(0, 0);
      ctx.fillStyle = "#5d574d";
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, TILE_W * 0.62, TILE_H * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4aa3d4";
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, TILE_W * 0.48, TILE_H * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7fc4e8";
      ctx.beginPath();
      ctx.ellipse(f.x, f.y - 2, TILE_W * 0.16, TILE_H * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();

      // ── characters (me + everyone else), depth-sorted ──
      const remote = useGame.getState().hubAvatars;
      const myLvl = remote.find((a) => a.id === myId)?.level ?? myLevel();
      type Draw = { wx: number; wy: number; name: string; level: number; color: string; facing: number; moving: boolean; phase: number; me: boolean };
      const chars: Draw[] = [{ wx: m.x, wy: m.y, name: myName, level: myLvl, color: myBanner, facing: m.facing, moving: m.moving, phase: m.phase, me: true }];

      const seen = new Set<string>();
      for (const a of remote) {
        if (a.id === myId) continue;
        seen.add(a.id);
        let d = disp.get(a.id);
        if (!d) { d = { x: a.x, y: a.y, facing: a.facing, moving: a.moving, phase: 0 }; disp.set(a.id, d); }
        const lf = Math.min(1, dt * 12);
        d.x += (a.x - d.x) * lf;
        d.y += (a.y - d.y) * lf;
        d.facing = a.facing;
        d.moving = a.moving;
        d.phase += dt * (a.moving ? 9 : 2);
        chars.push({ wx: d.x, wy: d.y, name: a.name, level: a.level, color: a.banner, facing: a.facing, moving: a.moving, phase: d.phase, me: false });
      }
      for (const id of [...disp.keys()]) if (!seen.has(id)) disp.delete(id);

      chars.sort((a, b) => a.wx + a.wy - (b.wx + b.wy));
      for (const c of chars) {
        const s = toScreen(c.wx, c.wy);
        drawCharacter(ctx, s.x, s.y, {
          color: c.color,
          facing: c.facing,
          scale: 1.1,
          moving: c.moving,
          phase: c.phase,
          ring: c.me ? "#e8c75a" : undefined,
        });
        label(s.x, s.y - 34, c.name, c.level);
      }

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
    <div className="relative h-[72vh] w-full overflow-hidden rounded-xl border border-parchment-300/15 bg-black/40">
      <canvas ref={canvasRef} className="h-full w-full" />

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto rounded-lg bg-black/55 px-3 py-1.5 text-xs text-parchment-200 backdrop-blur">
          🏰 <b className="text-gold-light">The Hub</b> — move with <b>WASD</b> / arrows. Everyone here is online with you.
        </div>
        <button className="btn-gold btn-sm pointer-events-auto" onClick={onEnter}>
          Enter your world ⚔
        </button>
      </div>

      {/* chat dock */}
      <div className="absolute bottom-3 left-3 w-[min(20rem,70vw)]">
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

// A simple display "level" for the local avatar (server sends levels for others).
function myLevel(): number {
  const e = useGame.getState().snapshot?.empire;
  const xp = e?.hero?.skills?.combat ?? 0;
  // mirror the server's levelForXp curve loosely; exact value comes from the
  // server for remote players, this is just our own label.
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
}
