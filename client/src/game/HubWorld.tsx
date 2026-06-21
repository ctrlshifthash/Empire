import { useEffect, useRef, useState } from "react";
import { useGame } from "../lib/store";
import { worldToScreen, TILE_W, TILE_H } from "../world/iso";
import { drawCharacter, drawBuilding } from "../world/draw";
import { drawTile, TILES } from "../world/tiles";
import type { BuildingView } from "../world/engine";
import { loadVillage, villageReady, vimg, GROUND, OBJECTS, vToScreen, drawGround, drawObj, drawHubFountain, drawHubSpinner, V_SCALE, V_TILE_W, V_TILE_H, V_BOUND } from "../world/village";
import { SERVER_URL } from "../lib/config";
import { rankForPower } from "@shared/gamedata";
import { fmt } from "../lib/format";
import SolanaIcon from "../components/SolanaIcon";
import SpinnerWheel from "./SpinnerWheel";

// The spatial hub: a shared, walkable town. You spawn as your hero sprite and
// stroll a real environment — grass, a cobblestone plaza, a fountain, houses and
// trees — alongside everyone else online, each shown with their name + level.
// Built from the game's own world art (tiles + building + character renderers).

const SPEED = 4.5; // tiles / second (village tile units)
// walk-bound comes from the map size (V_BOUND) so you can reach the edges

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
  const lobby = useGame((s) => s.hubAvatars); // everyone currently in the plaza
  const online = useGame((s) => s.hubOnline); // everyone online (broader count)
  const [chat, setChat] = useState("");
  const [nearSpin, setNearSpin] = useState(false); // standing next to the plaza wheel
  const [showSpin, setShowSpin] = useState(false); // the wheel overlay is open

  // player card: click a roster name to see their stats
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [card, setCard] = useState<{ power: number; raidsWon: number; solEarned: number | null; age: number } | null>(null);
  const selectedAvatar = lobby.find((a) => a.id === selectedId);
  useEffect(() => {
    if (!selectedId) {
      setCard(null);
      return;
    }
    let alive = true;
    setCard(null);
    fetch(`${SERVER_URL}/api/player/${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.ok) setCard(d.player);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [selectedId]);
  const setInHub = useGame((s) => s.setInHub);

  const me = useRef<Local>({ x: 0, y: 2, facing: -1, moving: false, phase: 0 });
  const keys = useRef<Set<string>>(new Set());

  // preload the village tileset once
  useEffect(() => {
    loadVillage();
  }, []);

  // live zoom for the village (scroll wheel over the canvas, or the +/− buttons)
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const applyZoom = (z: number) => {
    const c = Math.max(0.4, Math.min(1.4, Math.round(z * 100) / 100));
    zoomRef.current = c;
    setZoom(c);
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      applyZoom(zoomRef.current - e.deltaY * 0.0012);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // join / leave the plaza (re-emit on (re)connect so the spawn isn't lost)
  useEffect(() => {
    if (connected) hubEnter();
    return () => hubLeave();
  }, [hubEnter, hubLeave, connected]);

  // tell the music player we're in the hub (plays the hub track while here)
  useEffect(() => {
    setInHub(true);
    return () => setInHub(false);
  }, [setInHub]);

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
    let lastNear = false; // proximity to the wheel — only setState when it flips

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
      // higher levels stand out: gold name + glow; everyone shows a bold level tag
      const elite = level >= 30;
      const high = level >= 15;
      const nameColor = elite ? "#f4dd8f" : high ? "#ffe9a8" : "#ffffff";
      const lvlColor = elite ? "#ff8c3a" : "#e8a23a";

      // level tag (above the name)
      ctx.font = "800 12px ui-sans-serif, system-ui";
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "rgba(0,0,0,0.92)";
      ctx.strokeText(`Lvl ${level}`, cx, topY - 18);
      ctx.fillStyle = lvlColor;
      ctx.fillText(`Lvl ${level}`, cx, topY - 18);

      // name — bigger, with a gold glow for elites
      if (elite) {
        ctx.shadowColor = "rgba(244,221,143,0.95)";
        ctx.shadowBlur = 9;
      }
      ctx.font = "800 16px ui-sans-serif, system-ui";
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = "rgba(0,0,0,0.92)";
      ctx.strokeText(name, cx, topY);
      ctx.fillStyle = nameColor;
      ctx.fillText(name, cx, topY);
      ctx.shadowBlur = 0;
    };

    // the fountain + prize wheel are shared props (drawHubFountain / drawHubSpinner
    // in ../world/village) so the live hub and Spectate render the same scene.

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
        m.x = Math.max(-V_BOUND, Math.min(V_BOUND, m.x + (dx / len) * SPEED * dt));
        m.y = Math.max(-V_BOUND, Math.min(V_BOUND, m.y + (dy / len) * SPEED * dt));
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

      // walked up to the plaza wheel (now just behind the fountain)?
      const nearWheel = Math.hypot(m.x, m.y + 2.0) < 1.7;
      if (nearWheel !== lastNear) {
        lastNear = nearWheel;
        setNearSpin(nearWheel);
      }

      // ── camera centred on me (village iso projection) ──
      const VC = (GROUND.length - 1) / 2; // village-centre offset → avatar (0,0)
      const camS = vToScreen(m.x, m.y);
      const ox = cw / 2 - camS.sx;
      const oy = ch / 2 - camS.sy + 30;
      const toScreen = (wx: number, wy: number) => {
        const p = vToScreen(wx, wy);
        return { x: p.sx + ox, y: p.sy + oy };
      };

      // live zoom — scales the whole scene about the screen centre. Cull margins
      // grow as you zoom out so nothing pops in at the edges.
      const z = zoomRef.current;
      const cmx = (cw / 2) * (1 / z - 1);
      const cmy = (ch / 2) * (1 / z - 1);

      // ── ground: the village tilemap (grass field + dirt courtyard) ──
      ctx.fillStyle = "#2f5a2a";
      ctx.fillRect(0, 0, cw, ch);
      ctx.save();
      ctx.translate(cw / 2, ch / 2);
      ctx.scale(z, z);
      ctx.translate(-cw / 2, -ch / 2);
      if (villageReady()) {
        for (let gy = 0; gy < GROUND.length; gy++) {
          const row = GROUND[gy];
          for (let gx = 0; gx < row.length; gx++) {
            const s = toScreen(gx - VC, gy - VC);
            if (s.x < -V_TILE_W - cmx || s.x > cw + V_TILE_W + cmx || s.y < -V_TILE_H * 3 - cmy || s.y > ch + V_TILE_H * 2 + cmy) continue;
            const img = vimg(row[gx]);
            if (img && img.complete) drawGround(ctx, img, s.x, s.y);
          }
        }
      }

      // ── standing objects (buildings, trees, fountain, avatars) depth-sorted ──
      type Obj = { d: number; draw: () => void };
      const objs: Obj[] = [];

      // fountain back at the plaza centre; the prize wheel sits just behind it
      objs.push({ d: 0, draw: () => drawHubFountain(ctx, toScreen(0, 0).x, toScreen(0, 0).y, t) });
      objs.push({ d: -2.0, draw: () => drawHubSpinner(ctx, toScreen(0, -2.0).x, toScreen(0, -2.0).y, t) });

      // village sprites (houses, stalls, decor, animated windmill) depth-sorted
      if (villageReady()) {
        for (const o of OBJECTS) {
          const ax = o.gx - VC;
          const ay = o.gy - VC;
          const s = toScreen(ax, ay);
          if (s.x < -V_TILE_W - cmx || s.x > cw + V_TILE_W + cmx || s.y < -V_TILE_H * 3 - cmy || s.y > ch + V_TILE_H + cmy) continue; // cull off-screen
          const name = o.anim ? o.anim[Math.floor(t / 110) % o.anim.length] : o.sprite;
          const img = vimg(name);
          if (!img || !img.complete) continue;
          const dy = o.dy ?? 0;
          const flat = o.flat ?? false;
          // flat decals sort just behind their tile so uprights/avatars cover them
          objs.push({ d: flat ? ax + ay - 0.45 : ax + ay, draw: () => drawObj(ctx, img, s.x, s.y, dy, flat) });
        }
      }

      const remote = useGame.getState().hubAvatars;
      const meAvatar = remote.find((a) => a.id === myId);
      const myLvl = meAvatar?.level ?? 1;
      const myChar = meAvatar?.character;
      const badge = (cx: number, y: number, icon: string) => {
        ctx.font = "16px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(icon, cx, y);
      };
      // equipped mount/pet — stands at the hero's side (beta)
      const mountGlyph = (cx: number, y: number, icon: string) => {
        ctx.font = "20px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(icon, cx, y);
      };
      const seen = new Set<string>();
      objs.push({
        d: m.x + m.y + 0.001,
        draw: () => {
          const s = toScreen(m.x, m.y);
          drawCharacter(ctx, s.x, s.y, { color: myChar?.color ?? myBanner, facing: m.facing, scale: 1.15, moving: m.moving, phase: m.phase, ring: "#e8c75a", hat: myChar?.hat ?? undefined, cape: myChar?.cape });
          if (meAvatar?.mount) mountGlyph(s.x + 21, s.y + 1, meAvatar.mount);
          label(s.x, s.y - 40, myName, myLvl);
          if (myChar) badge(s.x, s.y - 76, myChar.icon);
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
            drawCharacter(ctx, s.x, s.y, { color: a.character?.color ?? a.banner, facing: a.facing, scale: 1.15, moving: a.moving, phase: dd.phase, hat: a.character?.hat ?? undefined, cape: a.character?.cape });
            if (a.mount) mountGlyph(s.x + 21, s.y + 1, a.mount);
            label(s.x, s.y - 40, a.name, a.level);
            if (a.character) badge(s.x, s.y - 76, a.character.icon);
          },
        });
      }
      for (const id of [...disp.keys()]) if (!seen.has(id)) disp.delete(id);

      objs.sort((a, b) => a.d - b.d);
      for (const o of objs) o.draw();
      ctx.restore(); // end zoom transform

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

      {/* zoom out / in (scroll wheel works too) */}
      <div className="absolute bottom-[4.5rem] right-4 z-40 flex flex-col overflow-hidden rounded-full border border-gold/30 bg-ink-800/80 text-xl font-bold leading-none text-gold-light backdrop-blur-sm">
        <button onClick={() => applyZoom(zoom + 0.12)} title="Zoom in" className="flex h-9 w-11 items-center justify-center transition-colors hover:bg-white/5 hover:text-gold">+</button>
        <button onClick={() => applyZoom(zoom - 0.12)} title="Zoom out" className="flex h-9 w-11 items-center justify-center border-t border-gold/20 transition-colors hover:bg-white/5 hover:text-gold">−</button>
      </div>

      {/* the one button players need — the rest of the game's nav is inside */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
        <button
          className="btn-gold pointer-events-auto px-6 py-2.5 text-base font-bold shadow-gold"
          onClick={() => onOpenTab("live")}
        >
          🏰 Enter My Empire →
        </button>
      </div>

      {/* walk up to the plaza wheel → prompt to spin */}
      {nearSpin && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-40 flex justify-center">
          <button
            onClick={() => setShowSpin(true)}
            className="btn-gold pointer-events-auto animate-pulse px-6 py-2.5 text-base font-bold shadow-gold"
          >
            🎡 Spin the Wheel
          </button>
        </div>
      )}

      {/* spin right here on the hub — overlay, no page change */}
      {showSpin && (
        <div
          className="absolute inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowSpin(false)}
        >
          <div
            className="relative rounded-2xl border border-gold/30 bg-ink-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSpin(false)}
              className="absolute right-3 top-3 z-10 text-xl text-parchment-300/70 hover:text-parchment-100"
              aria-label="Close"
            >
              ✕
            </button>
            <SpinnerWheel />
          </div>
        </div>
      )}

      {/* lobby roster — who's in the hub right now */}
      <div className="absolute right-3 top-3 w-44 max-w-[45vw]">
        <div className="rounded-lg border border-parchment-300/15 bg-black/55 backdrop-blur">
          <div className="flex items-center gap-1.5 border-b border-parchment-300/10 px-3 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-parchment-200">In the Hub</span>
            <span className="ml-auto text-[11px] text-parchment-300/55">
              {lobby.length}
              {online.length > lobby.length ? ` · ${online.length} on` : ""}
            </span>
          </div>
          <div className="max-h-[18rem] space-y-0.5 overflow-y-auto px-1.5 py-1.5">
            {lobby.length === 0 && <div className="px-1.5 py-1 text-[11px] text-parchment-300/45">Just you so far…</div>}
            {[...lobby]
              .sort((a, b) => b.level - a.level)
              .map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  title="View player"
                  className="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left hover:bg-white/10"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-bold text-white" style={{ background: a.banner }}>
                    {(a.name[0] ?? "?").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-parchment-100">{a.id === myId ? "You" : a.name}</span>
                  {a.character && <span className="shrink-0 text-xs">{a.character.icon}</span>}
                  <span className="shrink-0 text-[10px] font-bold text-gold-light">{a.level}</span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* controls hint */}
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-black/50 px-2.5 py-1 text-[11px] text-parchment-200 backdrop-blur">
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

      {/* player card — opened by clicking a name in the roster */}
      {selectedAvatar && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setSelectedId(null)}>
          <div className="w-72 rounded-xl border border-parchment-300/15 bg-ink-800/95 p-5 shadow-panel" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-xl font-bold text-white" style={{ background: selectedAvatar.banner }}>
                {(selectedAvatar.name[0] ?? "?").toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="truncate font-display text-lg font-bold text-parchment-100">{selectedAvatar.id === myId ? "You" : selectedAvatar.name}</div>
                <div className="text-xs text-parchment-300/60">
                  Lvl {selectedAvatar.level}
                  {card ? ` · ${rankForPower(card.power).name}` : ""}
                </div>
              </div>
            </div>
            {selectedAvatar.character && (
              <div className="mt-3 flex items-center justify-center gap-2 text-3xl">
                {selectedAvatar.character.icon}
                {selectedAvatar.mount && <span>{selectedAvatar.mount}</span>}
              </div>
            )}
            <div className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-parchment-300/60">Power</span><span className="font-semibold text-gold-light">{card ? fmt(card.power) : "…"}</span></div>
              <div className="flex justify-between"><span className="text-parchment-300/60">Raids won</span><span className="font-semibold text-parchment-100">{card ? card.raidsWon : "…"}</span></div>
              <div className="flex justify-between">
                <span className="text-parchment-300/60">SOL earned</span>
                <span className="flex items-center gap-1 font-semibold text-gold-light">
                  {!card ? "…" : card.solEarned == null ? <span className="text-parchment-300/45">Private</span> : <><SolanaIcon className="h-3 w-3" /> {card.solEarned.toFixed(3)}</>}
                </span>
              </div>
            </div>
            <button className="btn-ghost btn-sm mt-4 w-full" onClick={() => setSelectedId(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
