import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import type { HubAvatar, HubMessage, HubPlayer } from "@shared/types";
import { SERVER_URL } from "../lib/config";
import { drawCharacter } from "../world/draw";
import { loadVillage, villageReady, vimg, GROUND, OBJECTS, vToScreen, drawGround, drawObj, drawHubFountain, drawHubSpinner, V_TILE_W, V_TILE_H } from "../world/village";

// Spectate (beta). A read-only window on the live hub — anyone can watch players
// mill about the real village plaza, no account needed, with a prompt to play.
// Renders the same village scene as the authed hub; its own socket, no coupling.

type Disp = { x: number; y: number; phase: number };

export default function SpectateView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nav = useNavigate();
  const [online, setOnline] = useState<HubPlayer[]>([]);
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [locked, setLocked] = useState(false);
  const avatarsRef = useRef<HubAvatar[]>([]);

  useEffect(() => {
    const socket: Socket = io(SERVER_URL, { transports: ["websocket", "polling"] });
    socket.on("connect", () => socket.emit("spectate"));
    socket.on("spectate:locked", () => setLocked(true));
    socket.on("hub:players", (a: HubAvatar[]) => (avatarsRef.current = a));
    socket.on("hub:online", (p: HubPlayer[]) => setOnline(p));
    socket.on("hub:history", (m: HubMessage[]) => setMessages(m.slice(-30)));
    socket.on("hub:message", (m: HubMessage) => setMessages((prev) => [...prev, m].slice(-30)));
    return () => {
      socket.close();
    };
  }, []);

  // preload the village tileset + sprites once
  useEffect(() => {
    loadVillage();
  }, []);

  useEffect(() => {
    if (locked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const disp = new Map<string, Disp>();
    const cam = { x: 0, y: 0 };
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const avatars = avatarsRef.current;

      // camera drifts toward the crowd's centroid
      let tx = 0;
      let ty = 0;
      if (avatars.length) {
        for (const a of avatars) {
          tx += a.x;
          ty += a.y;
        }
        tx /= avatars.length;
        ty /= avatars.length;
      }
      cam.x += (tx - cam.x) * Math.min(1, dt * 2);
      cam.y += (ty - cam.y) * Math.min(1, dt * 2);

      const VC = (GROUND.length - 1) / 2; // village-centre offset → avatar (0,0)
      const camS = vToScreen(cam.x, cam.y);
      const ox = cw / 2 - camS.sx;
      const oy = ch / 2 - camS.sy + 30;
      const toScreen = (wx: number, wy: number) => {
        const p = vToScreen(wx, wy);
        return { x: p.sx + ox, y: p.sy + oy };
      };

      // ground — the village tilemap (grass field + dirt courtyard)
      ctx.fillStyle = "#2f5a2a";
      ctx.fillRect(0, 0, cw, ch);
      if (villageReady()) {
        for (let gy = 0; gy < GROUND.length; gy++) {
          const row = GROUND[gy];
          for (let gx = 0; gx < row.length; gx++) {
            const s = toScreen(gx - VC, gy - VC);
            if (s.x < -V_TILE_W || s.x > cw + V_TILE_W || s.y < -V_TILE_H * 3 || s.y > ch + V_TILE_H * 2) continue;
            const img = vimg(row[gx]);
            if (img && img.complete) drawGround(ctx, img, s.x, s.y);
          }
        }
      }

      type Obj = { d: number; draw: () => void };
      const objs: Obj[] = [];
      // fountain at the plaza centre + the prize wheel just behind it
      objs.push({ d: 0, draw: () => drawHubFountain(ctx, toScreen(0, 0).x, toScreen(0, 0).y, t) });
      objs.push({ d: -2.0, draw: () => drawHubSpinner(ctx, toScreen(0, -2.0).x, toScreen(0, -2.0).y, t) });
      // village sprites (houses, stalls, decor, animated windmill) depth-sorted
      if (villageReady()) {
        for (const o of OBJECTS) {
          const ax = o.gx - VC;
          const ay = o.gy - VC;
          const s = toScreen(ax, ay);
          if (s.x < -V_TILE_W || s.x > cw + V_TILE_W || s.y < -V_TILE_H * 3 || s.y > ch + V_TILE_H) continue;
          const name = o.anim ? o.anim[Math.floor(t / 110) % o.anim.length] : o.sprite;
          const img = vimg(name);
          if (!img || !img.complete) continue;
          const dy = o.dy ?? 0;
          const flat = o.flat ?? false;
          objs.push({ d: flat ? ax + ay - 0.45 : ax + ay, draw: () => drawObj(ctx, img, s.x, s.y, dy, flat) });
        }
      }

      const seen = new Set<string>();
      for (const a of avatars) {
        seen.add(a.id);
        let d = disp.get(a.id);
        if (!d) {
          d = { x: a.x, y: a.y, phase: 0 };
          disp.set(a.id, d);
        }
        const lf = Math.min(1, dt * 12);
        d.x += (a.x - d.x) * lf;
        d.y += (a.y - d.y) * lf;
        d.phase += dt * (a.moving ? 9 : 2);
        const dd = d;
        objs.push({
          d: dd.x + dd.y,
          draw: () => {
            const s = toScreen(dd.x, dd.y);
            drawCharacter(ctx, s.x, s.y, { color: a.character?.color ?? a.banner, facing: a.facing, scale: 1.15, moving: a.moving, phase: dd.phase, hat: a.character?.hat ?? undefined, cape: a.character?.cape });
            if (a.mount) {
              ctx.font = "20px serif";
              ctx.textAlign = "center";
              ctx.fillText(a.mount, s.x + 21, s.y + 1);
            }
            ctx.textAlign = "center";
            ctx.font = "800 13px ui-sans-serif, system-ui";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(0,0,0,0.9)";
            ctx.strokeText(a.name, s.x, s.y - 38);
            ctx.fillStyle = a.level >= 30 ? "#f4dd8f" : "#fff";
            ctx.fillText(a.name, s.x, s.y - 38);
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
  }, [locked]);

  if (locked) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-4 text-center">
        <div>
          <div className="text-5xl">🔒</div>
          <h2 className="mt-3 font-display text-2xl font-bold text-gold-gradient">Spectate is in beta</h2>
          <p className="mt-2 max-w-sm text-sm text-parchment-300/60">Watching the live world is coming soon. For now, jump straight in.</p>
          <button className="btn-gold mt-4" onClick={() => nav("/play")}>Connect wallet & play</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* live badge + online count */}
      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-red-400/40 bg-black/60 px-3 py-1.5 backdrop-blur">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <span className="text-xs font-bold uppercase tracking-wide text-red-200">Live</span>
        <span className="text-xs text-parchment-300/70">· {online.length} online</span>
        <span className="rounded-full border border-purple-400/40 bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-purple-200">Beta</span>
      </div>

      {/* read-only chat feed */}
      <div className="absolute bottom-4 left-4 max-h-48 w-72 overflow-hidden rounded-xl border border-parchment-300/15 bg-black/55 p-3 backdrop-blur">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-parchment-300/50">Plaza chat</div>
        <div className="space-y-1 text-xs">
          {messages.length === 0 && <div className="text-parchment-300/40">Quiet for now…</div>}
          {messages.slice(-8).map((m) => (
            <div key={m.id} className="truncate">
              <span className="font-semibold" style={{ color: m.banner }}>{m.fromName}:</span>{" "}
              <span className="text-parchment-200/80">{m.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        <button className="btn-gold" onClick={() => nav("/play")}>Connect wallet & play →</button>
        <span className="rounded-lg bg-black/55 px-2 py-1 text-[11px] text-parchment-300/60 backdrop-blur">You're spectating — join to walk the plaza</span>
      </div>
    </div>
  );
}
