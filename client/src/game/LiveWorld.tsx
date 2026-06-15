import { useEffect, useMemo, useRef, useState } from "react";
import type { BuildingType, GameSnapshot, ResourceKind } from "@shared/types";
import {
  AGES,
  BUILDING_TYPES,
  BUILDINGS,
  HELMET_HP,
  HERO_ARMOUR_HP,
  ageAtLeast,
  nextLevelCost,
  rankForPower,
  traitBonuses,
} from "@shared/gamedata";
import {
  SKILLS,
  SKILL_ORDER,
  gatherYield,
  heroDamage,
  heroMaxHp,
  levelForXp,
  resourceSkill,
  resourceTool,
} from "@shared/progression";
import { useGame } from "../lib/store";
import { useNow } from "../lib/hooks";
import { RESOURCE_META, RESOURCE_ORDER, fmt } from "../lib/format";
import { World, type NodeKind } from "../world/engine";
import { renderWorld } from "../world/draw";
import { screenToWorld, worldToScreen } from "../world/iso";
import { CostBadge } from "./ui";

function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function canAfford(res: GameSnapshot["empire"]["resources"], cost: Partial<Record<string, number>>) {
  return (["wood", "food", "gold", "stone"] as const).every((k) => res[k] >= (cost[k] ?? 0));
}

export default function LiveWorld({
  snapshot,
  onInvade,
  onOpenTab,
}: {
  snapshot: GameSnapshot;
  onInvade?: () => void;
  onOpenTab?: (tab: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const miniCache = useRef<HTMLCanvasElement | null>(null);
  const miniCenter = useRef({ x: 0, y: 0 });
  const lastMini = useRef(0);
  const worldRef = useRef<World | null>(null);
  const keys = useRef<Set<string>>(new Set());
  const hover = useRef<{ wx: number; wy: number } | null>(null);
  const buildModeRef = useRef<BuildingType | null>(null);
  const drag = useRef<{ sx: number; sy: number; lx: number; ly: number; moved: boolean; pan: boolean } | null>(null);
  const camDrag = useRef<{ x: number; y: number } | null>(null);
  const mouse = useRef({ x: 0, y: 0, inside: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isFull, setIsFull] = useState(false);

  const gather = useGame((s) => s.gather);
  const slay = useGame((s) => s.slay);
  const build = useGame((s) => s.build);
  const pushToast = useGame((s) => s.pushToast);

  const [buildMode, setBuildMode] = useState<BuildingType | null>(null);
  useNow(220); // refresh HUD overlays from world state ~5x/sec

  // create the world once for this empire
  if (!worldRef.current) {
    worldRef.current = new World(seedFromId(snapshot.empire.id));
    worldRef.current.setBuildings(snapshot.empire.buildings);
    worldRef.current.setArmy(snapshot.empire.army);
  }

  // hook up callbacks (kept fresh)
  useEffect(() => {
    const wd = worldRef.current!;
    wd.onGather = (r) => gather(r);
    wd.onSlay = (k) => slay(k);
    wd.onToast = (text) => pushToast({ kind: "info", text });
  }, [gather, slay, pushToast]);

  // sync authoritative state into the world on each snapshot
  useEffect(() => {
    const wd = worldRef.current!;
    wd.setBuildings(snapshot.empire.buildings);
    wd.setArmy(snapshot.empire.army);
    const hero = snapshot.empire.hero;
    if (hero) {
      const yld = { wood: 0, food: 0, stone: 0, gold: 0 };
      for (const r of RESOURCE_ORDER) {
        yld[r] = gatherYield(levelForXp(hero.skills[resourceSkill(r)] ?? 0), hero.tools[resourceTool(r)] ?? 1);
      }
      const cl = levelForXp(hero.skills.combat ?? 0);
      const arm = snapshot.empire.armoury;
      const gearHp = (arm?.helmet ?? 0) * HELMET_HP + (arm?.heroArmour ?? 0) * HERO_ARMOUR_HP;
      const tb = traitBonuses(snapshot.empire.traits);
      const dmg = Math.round((heroDamage(cl, hero.tools.sword ?? 1) + tb.dmg) * (1 + tb.dmgPct));
      wd.setHeroStats({ dmg, maxHp: heroMaxHp(cl) + gearHp + tb.hp, yield: yld });
      wd.setHeroLook(arm?.helmet ?? 0, arm?.heroArmour ?? 0);
      wd.hero.speed = 4.2 * (1 + tb.speedPct); // base hero speed × trait bonus
    }
  }, [snapshot]);

  // Click a resource in the top bar → fly the camera to, and send the hero to
  // harvest, the nearest source of that resource (so you can see & reach it).
  const locateRequest = useGame((s) => s.locateRequest);
  useEffect(() => {
    if (!locateRequest) return;
    const wd = worldRef.current;
    if (!wd) return;
    const RES_NODE: Record<ResourceKind, NodeKind> = { wood: "tree", stone: "rock", gold: "gold", food: "bush" };
    const want = RES_NODE[locateRequest.kind];
    const clearOfEnemies = (x: number, y: number) =>
      !wd.enemies.some((e) => e.respawnAt === 0 && Math.hypot(e.x - x, e.y - y) < 6);
    let safe: { x: number; y: number } | null = null;
    let safeD = Infinity;
    let any: { x: number; y: number } | null = null;
    let anyD = Infinity;
    for (const n of wd.nodes) {
      if (n.kind !== want || n.respawnAt > 0 || n.amount <= 0) continue;
      const d = Math.hypot(n.x - wd.hero.x, n.y - wd.hero.y);
      if (d < anyD) {
        anyD = d;
        any = n;
      }
      if (d < safeD && clearOfEnemies(n.x, n.y)) {
        safeD = d;
        safe = n;
      }
    }
    const label = RESOURCE_META[locateRequest.kind].label.toLowerCase();
    const target = safe ?? any;
    if (!target) {
      pushToast({ kind: "warn", text: `No ${label} sources nearby right now — they regrow over time.` });
      return;
    }
    wd.focusOn(target.x, target.y);
    wd.interact(target.x, target.y); // hero walks over and harvests it
    if (safe) pushToast({ kind: "info", text: `📍 Marching your hero to the nearest ${label}.` });
    else pushToast({ kind: "warn", text: `⚠ The nearest ${label} is guarded — take your army!` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateRequest]);

  const setMode = (t: BuildingType | null) => {
    buildModeRef.current = t;
    setBuildMode(t);
  };

  // main loop + input
  useEffect(() => {
    const canvas = canvasRef.current;
    const mini = miniRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const mctx = mini?.getContext("2d") ?? null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const localPt = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const pointerToWorld = (clientX: number, clientY: number) => {
      const wd = worldRef.current!;
      const rect = canvas.getBoundingClientRect();
      const z = wd.zoom || 1;
      const camS = worldToScreen(wd.cam.x, wd.cam.y);
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      return screenToWorld((mx - rect.width / 2) / z + camS.sx, (my - rect.height / 2) / z + camS.sy);
    };
    const worldToScreenPt = (wx: number, wy: number) => {
      const wd = worldRef.current!;
      const rect = canvas.getBoundingClientRect();
      const z = wd.zoom || 1;
      const camS = worldToScreen(wd.cam.x, wd.cam.y);
      const s = worldToScreen(wx, wy);
      return { x: rect.width / 2 + (s.sx - camS.sx) * z, y: rect.height / 2 + (s.sy - camS.sy) * z };
    };
    const unitAtScreen = (clientX: number, clientY: number) => {
      const wd = worldRef.current!;
      const p = localPt(clientX, clientY);
      let best: number | null = null;
      let bd = 20;
      for (const u of wd.units) {
        if (u.downUntil > 0) continue;
        const sp = worldToScreenPt(u.x, u.y);
        const d = Math.hypot(sp.x - p.x, sp.y - 12 - p.y);
        if (d < bd) {
          bd = d;
          best = u.id;
        }
      }
      return best;
    };
    const placeBuilding = (wpt: { wx: number; wy: number }) => {
      const wd = worldRef.current!;
      const mode = buildModeRef.current!;
      const tx = Math.round(wpt.wx);
      const ty = Math.round(wpt.wy);
      if (wd.buildings.some((b) => b.x === tx && b.y === ty)) {
        pushToast({ kind: "warn", text: "That spot is already occupied." });
        return;
      }
      if (!canAfford(snapRef.current.empire.resources, nextLevelCost(mode, 0))) {
        pushToast({ kind: "warn", text: "Not enough resources." });
        return;
      }
      build(mode, tx, ty);
      wd.focusOn(tx, ty);
      pushToast({ kind: "success", text: `${BUILDINGS[mode].name} placed — watch it rise!` });
      setMode(null);
    };

    const onMove = (e: MouseEvent) => {
      const p = localPt(e.clientX, e.clientY);
      mouse.current = { x: p.x, y: p.y, inside: true };
      // middle-drag pans the camera (grab the map)
      if (camDrag.current) {
        worldRef.current!.panByScreen(-(p.x - camDrag.current.x), -(p.y - camDrag.current.y));
        camDrag.current = p;
        return;
      }
      const wpt = pointerToWorld(e.clientX, e.clientY);
      hover.current = { wx: Math.round(wpt.wx), wy: Math.round(wpt.wy) };
      if (drag.current && !buildModeRef.current) {
        const d0 = drag.current;
        if (Math.hypot(p.x - d0.sx, p.y - d0.sy) > 5) d0.moved = true;
        if (d0.pan) {
          // hold left-click + drag to grab and move the map around
          if (d0.moved) worldRef.current!.panByScreen(-(p.x - d0.lx), -(p.y - d0.ly));
          d0.lx = p.x;
          d0.ly = p.y;
        } else if (d0.moved) {
          // shift + drag = box-select units
          setSelBox({
            x: Math.min(p.x, d0.sx),
            y: Math.min(p.y, d0.sy),
            w: Math.abs(p.x - d0.sx),
            h: Math.abs(p.y - d0.sy),
          });
        }
      }
    };
    const onLeave = () => {
      hover.current = null;
      mouse.current.inside = false;
    };
    const onDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        camDrag.current = localPt(e.clientX, e.clientY);
        return;
      }
      if (e.button !== 0) return;
      const p = localPt(e.clientX, e.clientY);
      // default left-drag pans the camera; hold Shift to box-select your army
      drag.current = { sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: false, pan: !e.shiftKey };
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 1) {
        camDrag.current = null;
        return;
      }
      if (e.button !== 0) return;
      const wd = worldRef.current!;
      const d0 = drag.current;
      drag.current = null;
      const wpt = pointerToWorld(e.clientX, e.clientY);
      if (buildModeRef.current) {
        placeBuilding(wpt);
        setSelBox(null);
        return;
      }
      if (d0 && d0.moved) {
        if (!d0.pan) {
          // shift+drag finished -> box-select your units
          const p = localPt(e.clientX, e.clientY);
          const minX = Math.min(p.x, d0.sx);
          const maxX = Math.max(p.x, d0.sx);
          const minY = Math.min(p.y, d0.sy);
          const maxY = Math.max(p.y, d0.sy);
          const ids: number[] = [];
          for (const u of wd.units) {
            if (u.downUntil > 0) continue;
            const sp = worldToScreenPt(u.x, u.y);
            if (sp.x >= minX && sp.x <= maxX && sp.y - 12 >= minY && sp.y - 12 <= maxY) ids.push(u.id);
          }
          if (ids.length) wd.selectUnits(ids);
          else wd.clearSelection();
        }
        // (left-drag pan needs no action on release)
      } else {
        // a plain click: pick a unit, else move/interact with the hero
        const uid = unitAtScreen(e.clientX, e.clientY);
        if (uid != null) {
          wd.selectUnits([uid]);
        } else {
          wd.clearSelection();
          wd.interact(wpt.wx, wpt.wy);
        }
      }
      setSelBox(null);
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      const wd = worldRef.current!;
      if (buildModeRef.current) {
        setMode(null);
        return;
      }
      if (wd.selected.size > 0) {
        const wpt = pointerToWorld(e.clientX, e.clientY);
        const enemy = wd.enemyAt(wpt.wx, wpt.wy, 1.3);
        if (enemy) wd.commandAttackSelected(enemy.id);
        else wd.commandMoveSelected(wpt.wx, wpt.wy);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const wd = worldRef.current!;
      const f = e.deltaY < 0 ? 1.12 : 0.89;
      wd.zoom = Math.max(0.35, Math.min(2.2, wd.zoom * f));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // ignore movement keys while typing in a panel input / textarea
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        keys.current.add(k);
        if (k.startsWith("arrow")) e.preventDefault();
      }
      if (k === " " || k === "spacebar") {
        e.preventDefault();
        worldRef.current?.recenterCam(); // snap camera back to the hero
      }
      if (k === "escape") {
        setMode(null);
        worldRef.current?.clearSelection();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("contextmenu", onContext);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const loop = (t: number) => {
      const wd = worldRef.current!;
      const dt = (t - last) / 1000;
      last = t;

      // WASD moves the hero
      let dx = 0;
      let dy = 0;
      const ks = keys.current;
      if (ks.has("w")) {
        dx -= 1;
        dy -= 1;
      }
      if (ks.has("s")) {
        dx += 1;
        dy += 1;
      }
      if (ks.has("a")) {
        dx -= 1;
        dy += 1;
      }
      if (ks.has("d")) {
        dx += 1;
        dy -= 1;
      }
      if (dx !== 0 || dy !== 0) wd.nudge(dx, dy, dt);

      // arrow keys + screen-edge hover pan the CAMERA (free look around the map)
      let px = 0;
      let py = 0;
      if (ks.has("arrowleft")) px -= 1;
      if (ks.has("arrowright")) px += 1;
      if (ks.has("arrowup")) py -= 1;
      if (ks.has("arrowdown")) py += 1;
      const m = mouse.current;
      if (m.inside && !(drag.current && drag.current.moved) && !camDrag.current) {
        const EDGE = 42;
        const cw = canvas.clientWidth;
        const chh = canvas.clientHeight;
        if (m.x < EDGE) px -= 1;
        else if (m.x > cw - EDGE) px += 1;
        if (m.y < EDGE) py -= 1;
        else if (m.y > chh - EDGE) py += 1;
      }
      if (px !== 0 || py !== 0) wd.panByScreen(px * 640 * dt, py * 640 * dt);

      wd.update(dt, t + performance.timeOrigin);

      const ghost = buildModeRef.current
        ? {
            type: buildModeRef.current,
            valid:
              !!hover.current &&
              !wd.buildings.some((b) => b.x === hover.current!.wx && b.y === hover.current!.wy) &&
              canAfford(snapRef.current.empire.resources, nextLevelCost(buildModeRef.current, 0)),
          }
        : null;

      renderWorld(ctx, canvas.clientWidth, canvas.clientHeight, wd, t + performance.timeOrigin, {
        hover: hover.current,
        ghost,
      });
      // minimap: a real rendered view of the world around you using the actual
      // tiles — zoomed in on your surroundings so walls/roads/castle are legible.
      // Terrain is cached & refreshed periodically; the hero marker is live.
      if (mctx && mini) {
        const sz = mini.width;
        if (!miniCache.current) {
          const c = document.createElement("canvas");
          c.width = sz;
          c.height = sz;
          miniCache.current = c;
        }
        const z = sz / (26 * 128); // show ~26 tiles across, centred on the hero
        if (t - lastMini.current > 500) {
          lastMini.current = t;
          miniCenter.current = { x: wd.hero.x, y: wd.hero.y };
          const cc = miniCache.current.getContext("2d");
          if (cc) {
            const sZoom = wd.zoom;
            const sCamX = wd.cam.x;
            const sCamY = wd.cam.y;
            wd.zoom = z;
            wd.cam = { x: wd.hero.x, y: wd.hero.y };
            renderWorld(cc, sz, sz, wd, t + performance.timeOrigin, { hover: null, ghost: null });
            wd.zoom = sZoom;
            wd.cam = { x: sCamX, y: sCamY };
          }
        }
        mctx.clearRect(0, 0, sz, sz);
        mctx.drawImage(miniCache.current, 0, 0);
        // live hero marker, projected relative to the cached centre
        const cs = worldToScreen(miniCenter.current.x, miniCenter.current.y);
        const hs = worldToScreen(wd.hero.x, wd.hero.y);
        const hx = sz / 2 + (hs.sx - cs.sx) * z;
        const hy = sz / 2 + (hs.sy - cs.sy) * z;
        mctx.strokeStyle = "rgba(0,0,0,0.6)";
        mctx.lineWidth = 2.5;
        mctx.beginPath();
        mctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
        mctx.stroke();
        mctx.fillStyle = "#fff";
        mctx.beginPath();
        mctx.arc(hx, hy, 3, 0, Math.PI * 2);
        mctx.fill();
        // frame + compass
        mctx.strokeStyle = "rgba(244,221,143,0.35)";
        mctx.lineWidth = 2;
        mctx.strokeRect(1, 1, sz - 2, sz - 2);
        mctx.fillStyle = "rgba(0,0,0,0.5)";
        mctx.beginPath();
        mctx.arc(sz - 13, 13, 9, 0, Math.PI * 2);
        mctx.fill();
        mctx.fillStyle = "#e0533f";
        mctx.beginPath();
        mctx.moveTo(sz - 13, 6);
        mctx.lineTo(sz - 16, 13);
        mctx.lineTo(sz - 10, 13);
        mctx.closePath();
        mctx.fill();
        mctx.fillStyle = "#fff";
        mctx.font = "bold 6px sans-serif";
        mctx.textAlign = "center";
        mctx.textBaseline = "middle";
        mctx.fillText("N", sz - 13, 18);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("contextmenu", onContext);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFull = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  };

  const empire = snapshot.empire;
  const wd = worldRef.current!;
  const palette = useMemo(
    () => BUILDING_TYPES.filter((t) => !(BUILDINGS[t].unique && empire.buildings.some((b) => b.type === t))),
    [empire.buildings],
  );

  const hero = wd.hero;
  const activity =
    hero.deadUntil > 0
      ? "Fallen — respawning…"
      : hero.state === "harvest"
        ? "Harvesting…"
        : hero.state === "fight"
          ? "In combat!"
          : hero.state === "move"
            ? "Moving…"
            : "Idle";

  return (
    <div
      ref={rootRef}
      className="relative h-[calc(100vh-10.5rem)] min-h-[440px] w-full overflow-hidden border-y border-parchment-300/10 bg-[#1a230f]"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair" />

      {/* unit selection box overlay */}
      {selBox && (
        <div
          className="pointer-events-none absolute z-20 rounded-sm border border-emerald-400 bg-emerald-400/15"
          style={{ left: selBox.x, top: selBox.y, width: selBox.w, height: selBox.h }}
        />
      )}

      {/* top tutorial / hint banner */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
        <div className="rounded-full border border-gold/30 bg-black/60 px-4 py-1.5 text-center text-xs text-parchment-100 backdrop-blur">
          {buildMode ? (
            <span className="text-gold-light">
              🏗️ Placing {BUILDINGS[buildMode].name} — left-click a spot · right-click / Esc to cancel
            </span>
          ) : (
            <>
              <span className="text-parchment-300/80">click / WASD move hero</span> ·{" "}
              <span className="text-parchment-100/90">drag to pan the map</span> ·{" "}
              <span className="text-emerald-300">click 🌲🪨 harvest</span> ·{" "}
              <span className="text-blood-light">click enemy attack</span> ·{" "}
              <span className="text-royal-light">shift-drag select army → right-click command</span> ·{" "}
              <span className="text-parchment-300/70">scroll zoom · Space center</span>
            </>
          )}
        </div>
      </div>

      {/* prominent INVADE button */}
      {onInvade && (
        <button
          onClick={onInvade}
          className="btn-blood absolute left-1/2 top-[3.4rem] z-20 -translate-x-1/2 px-5 py-2 text-sm shadow-deep"
          title="Open the war map and invade a rival empire"
        >
          ⚔ Invade an Empire
        </button>
      )}

      {/* view controls (above the build bar) */}
      <div className="absolute bottom-24 right-3 z-10 flex flex-col gap-1">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md border border-parchment-300/15 bg-ink-800/85 text-base text-parchment-100 backdrop-blur hover:border-gold/40"
          onClick={toggleFull}
          title={isFull ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFull ? "🗗" : "⛶"}
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md border border-parchment-300/15 bg-ink-800/85 text-base text-parchment-100 backdrop-blur hover:border-gold/40"
          onClick={() => worldRef.current?.recenterCam()}
          title="Center on your hero (Space)"
        >
          ⌖
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md border border-parchment-300/15 bg-ink-800/85 text-lg text-parchment-100 backdrop-blur hover:border-gold/40"
          onClick={() => {
            const wd = worldRef.current;
            if (wd) wd.zoom = Math.min(2.4, wd.zoom * 1.2);
          }}
        >
          +
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md border border-parchment-300/15 bg-ink-800/85 text-lg text-parchment-100 backdrop-blur hover:border-gold/40"
          onClick={() => {
            const wd = worldRef.current;
            if (wd) wd.zoom = Math.max(0.35, wd.zoom * 0.8);
          }}
        >
          −
        </button>
      </div>

      {/* selection hint */}
      {wd.selected.size > 0 && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full border border-emerald-400/40 bg-black/70 px-3 py-1 text-xs text-emerald-300 backdrop-blur">
          {wd.selected.size} unit{wd.selected.size === 1 ? "" : "s"} selected — right-click to move / attack
        </div>
      )}

      {/* character panel (top-left): minimap, health, rank, stats & gear */}
      <div className="absolute left-3 top-3 z-10 w-48">
        <div className="panel overflow-hidden p-2">
          <canvas ref={miniRef} width={160} height={160} className="h-32 w-full rounded" />
          <div className="mt-2 px-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-parchment-100">{empire.name}</span>
              <span className="text-parchment-300/60">{AGES[empire.age].name.split(" ")[0]}</span>
            </div>
            {/* rank + hero damage */}
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-gold-light">🏅 {rankForPower(empire.power).name}</span>
              <span className="text-parchment-300/40">·</span>
              <span className="text-parchment-300/70">
                ⚔ {heroDamage(levelForXp(empire.hero?.skills.combat ?? 0), empire.hero?.tools.sword ?? 1)} dmg
              </span>
            </div>
            {/* hero HP */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-xs">❤️</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                  style={{ width: `${(hero.hp / hero.maxHp) * 100}%` }}
                />
              </div>
              <span className="w-9 text-right text-[10px] tabular-nums text-parchment-300/70">
                {Math.ceil(hero.hp)}/{hero.maxHp}
              </span>
            </div>
            {/* equipped gear + troops */}
            <div className="mt-1 flex items-center gap-2 text-[10px] text-parchment-300/60">
              <span title="Sword tier">🗡️{empire.hero?.tools.sword ?? 1}</span>
              <span title="Helmet level">⛑️{empire.armoury?.helmet ?? 0}</span>
              <span title="Armour level">🦺{empire.armoury?.heroArmour ?? 0}</span>
              <span className="ml-auto">⚔ {wd.armyAlive} afield · {activity}</span>
            </div>
            {/* quick access to customise & shop */}
            <div className="mt-2 flex gap-1">
              <button
                onClick={() => onOpenTab?.("hero")}
                className="flex-1 rounded-md border border-gold/30 bg-gold/10 px-1 py-1 text-[10px] font-semibold text-gold-light hover:bg-gold/20"
              >
                🦸 Customise
              </button>
              <button
                onClick={() => onOpenTab?.("armoury")}
                className="flex-1 rounded-md border border-gold/30 bg-gold/10 px-1 py-1 text-[10px] font-semibold text-gold-light hover:bg-gold/20"
              >
                🛒 Shop
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* resources + skills (top-right) */}
      <div className="absolute right-3 top-3 z-10 flex w-36 flex-col gap-2">
        <div className="panel flex flex-col gap-1 p-2.5 text-xs">
          {RESOURCE_ORDER.map((k) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <span>{RESOURCE_META[k].icon}</span>
              <span className="tabular-nums font-semibold text-parchment-100">{fmt(empire.resources[k])}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-parchment-300/10 pt-1">
            <span>🪙</span>
            <span className="tabular-nums font-semibold text-gold-light">{fmt(empire.coins)}</span>
          </div>
        </div>

        <div className="panel p-2 text-xs">
          <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-parchment-300/55">
            Skills
          </div>
          {SKILL_ORDER.map((s) => {
            const lvl = levelForXp(empire.hero?.skills[s] ?? 0);
            return (
              <div key={s} className="flex items-center justify-between px-1 py-0.5">
                <span className="flex items-center gap-1.5">
                  <span>{SKILLS[s].icon}</span>
                  <span className="text-parchment-200">{SKILLS[s].name}</span>
                </span>
                <span className="font-semibold tabular-nums text-gold-light">{lvl}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* build palette (bottom) — wrapper is click-through so edge-scroll works */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
        <div className="bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8">
          <div className="pointer-events-auto mx-auto flex max-w-4xl items-center gap-1.5 overflow-x-auto rounded-xl border border-parchment-300/10 bg-ink-800/85 p-2 backdrop-blur">
            <span className="shrink-0 px-1 text-[10px] font-semibold uppercase tracking-wider text-parchment-300/50">
              Build
            </span>
            {palette.map((t) => {
              const def = BUILDINGS[t];
              const locked = !ageAtLeast(empire.age, def.requiresAge);
              const cost = nextLevelCost(t, 0);
              const affordable = canAfford(empire.resources, cost);
              const selected = buildMode === t;
              return (
                <button
                  key={t}
                  disabled={locked}
                  onClick={() => setMode(selected ? null : t)}
                  title={`${def.name}${locked ? ` (needs ${AGES[def.requiresAge].name})` : ""}`}
                  className={`group relative flex shrink-0 flex-col items-center rounded-lg border px-2.5 py-1.5 transition-all ${
                    selected
                      ? "border-gold bg-gold/20"
                      : locked
                        ? "border-transparent opacity-40"
                        : affordable
                          ? "border-parchment-300/10 bg-white/5 hover:border-gold/40"
                          : "border-parchment-300/10 bg-white/5 opacity-70"
                  }`}
                >
                  <span className="text-xl leading-none">{locked ? "🔒" : def.icon}</span>
                  <span className="mt-0.5 text-[9px] font-medium text-parchment-200">{def.name.split(" ")[0]}</span>
                  {/* cost tooltip on hover */}
                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-parchment-300/15 bg-ink-800 px-2 py-1 group-hover:block">
                    <CostBadge cost={cost} have={empire.resources} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
