// ─────────────────────────────────────────────────────────────────────────────
// Procedural canvas renderer for the empire base and the world map.
// Uses sprite sheets from assets.ts when configured, otherwise draws clean
// stylised tokens so the game looks good immediately.
// ─────────────────────────────────────────────────────────────────────────────
import { BUILDINGS } from "@shared/gamedata";
import type { Building, BuildingType, Empire, WorldMeta } from "@shared/types";
import { gameAssets } from "./assets";

export const BASE_W = 9;
export const BASE_H = 7;

const BUILDING_COLOR: Record<BuildingType, string> = {
  town_center: "#c9a227",
  house: "#a9763f",
  lumber_camp: "#3f7a4d",
  farm: "#7c9c3a",
  gold_mine: "#c79b3a",
  quarry: "#8a8378",
  barracks: "#a23a30",
  archery_range: "#9c5a2a",
  stable: "#7c4a2a",
  wall: "#6f6a5f",
  tower: "#5f5a52",
  gate: "#7a6a4a",
  market: "#3f6bb0",
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// simple deterministic hash for terrain variety
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

// ── Base view ───────────────────────────────────────────────────────────────

export interface BaseLayout {
  cell: number;
  x0: number;
  y0: number;
}

export function getBaseLayout(w: number, h: number): BaseLayout {
  const pad = 18;
  const cell = Math.floor(Math.min((w - 2 * pad) / BASE_W, (h - 2 * pad) / BASE_H));
  const x0 = Math.round((w - cell * BASE_W) / 2);
  const y0 = Math.round((h - cell * BASE_H) / 2);
  return { cell, x0, y0 };
}

export function baseCellAt(layout: BaseLayout, px: number, py: number): { x: number; y: number } | null {
  const cx = Math.floor((px - layout.x0) / layout.cell);
  const cy = Math.floor((py - layout.y0) / layout.cell);
  if (cx < 0 || cy < 0 || cx >= BASE_W || cy >= BASE_H) return null;
  return { x: cx, y: cy };
}

export function buildingAtCell(empire: Empire, cell: { x: number; y: number }): Building | undefined {
  return empire.buildings.find((b) => b.x === cell.x && b.y === cell.y);
}

export function renderBase(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  empire: Empire,
  now: number,
  hover: { x: number; y: number } | null,
  selectedId: string | null,
) {
  ctx.clearRect(0, 0, w, h);
  const { cell, x0, y0 } = getBaseLayout(w, h);

  // ground tiles
  for (let gy = 0; gy < BASE_H; gy++) {
    for (let gx = 0; gx < BASE_W; gx++) {
      const px = x0 + gx * cell;
      const py = y0 + gy * cell;
      const n = hash(gx, gy, 7);
      if (gameAssets.terrain?.ready) {
        gameAssets.terrain.draw(ctx, gameAssets.terrainIndex.grass ?? 0, px, py, cell, cell);
      } else {
        const base = (gx + gy) % 2 === 0 ? "#2c4a2f" : "#28442b";
        ctx.fillStyle = base;
        ctx.fillRect(px, py, cell, cell);
        // grass speckle
        ctx.fillStyle = `rgba(120,160,90,${0.05 + n * 0.06})`;
        ctx.fillRect(px + cell * 0.2, py + cell * 0.2, cell * 0.12, cell * 0.12);
      }
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, cell, cell);
    }
  }

  // hover highlight
  if (hover) {
    ctx.fillStyle = "rgba(201,162,39,0.18)";
    ctx.fillRect(x0 + hover.x * cell, y0 + hover.y * cell, cell, cell);
  }

  // buildings
  for (const b of empire.buildings) {
    const px = x0 + b.x * cell;
    const py = y0 + b.y * cell;
    const pad = cell * 0.12;
    const bw = cell - pad * 2;
    const color = BUILDING_COLOR[b.type] ?? "#888";
    const constructing = b.completesAt != null;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(ctx, px + pad, py + pad + 3, bw, bw, cell * 0.16);
    ctx.fill();

    if (gameAssets.buildings?.ready && gameAssets.buildingIndex[b.type] != null) {
      gameAssets.buildings.draw(ctx, gameAssets.buildingIndex[b.type]!, px + pad, py + pad, bw, bw);
    } else {
      // token body
      const grad = ctx.createLinearGradient(px, py, px, py + cell);
      grad.addColorStop(0, color);
      grad.addColorStop(1, shade(color, -0.35));
      ctx.fillStyle = grad;
      roundRect(ctx, px + pad, py + pad, bw, bw, cell * 0.16);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // icon
      ctx.font = `${Math.floor(cell * 0.4)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(BUILDINGS[b.type].icon, px + cell / 2, py + cell / 2 + 1);
    }

    // level pips
    if (b.level >= 1) {
      const pips = Math.min(b.level, 5);
      for (let i = 0; i < pips; i++) {
        ctx.fillStyle = "#f4dd8f";
        ctx.beginPath();
        ctx.arc(px + pad + 4 + i * 6, py + cell - pad - 3, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // construction overlay
    if (constructing && b.completesAt) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, px + pad, py + pad, bw, bw, cell * 0.16);
      ctx.fill();
      ctx.font = `${Math.floor(cell * 0.28)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText("🔨", px + cell / 2, py + cell / 2 - cell * 0.06);
      const remain = Math.max(0, Math.ceil((b.completesAt - now) / 1000));
      ctx.font = `bold ${Math.floor(cell * 0.16)}px sans-serif`;
      ctx.fillStyle = "#f4dd8f";
      ctx.fillText(remain < 60 ? `${remain}s` : `${Math.ceil(remain / 60)}m`, px + cell / 2, py + cell / 2 + cell * 0.22);
    }

    // selection ring
    if (selectedId === b.id) {
      ctx.strokeStyle = "#f4dd8f";
      ctx.lineWidth = 3;
      roundRect(ctx, px + pad - 2, py + pad - 2, bw + 4, bw + 4, cell * 0.2);
      ctx.stroke();
    }
  }
}

// ── World map ───────────────────────────────────────────────────────────────

export interface WorldMarker {
  id: string;
  x: number;
  y: number;
  banner: string;
  isBot: boolean;
  online: boolean;
  power: number;
  name: string;
  self: boolean;
}

export interface WorldLayout {
  scale: number;
  ox: number;
  oy: number;
}

export interface MapView {
  zoom: number;
  panX: number;
  panY: number;
}

export function getWorldLayout(
  w: number,
  h: number,
  world: WorldMeta,
  view: MapView = { zoom: 1, panX: 0, panY: 0 },
): WorldLayout {
  const scale = Math.min(w / world.width, h / world.height) * view.zoom;
  const ox = (w - scale * world.width) / 2 + view.panX;
  const oy = (h - scale * world.height) / 2 + view.panY;
  return { scale, ox, oy };
}

function tilePixel(layout: WorldLayout, tx: number, ty: number): [number, number] {
  return [layout.ox + tx * layout.scale + layout.scale / 2, layout.oy + ty * layout.scale + layout.scale / 2];
}

export function worldMarkerAt(
  layout: WorldLayout,
  markers: WorldMarker[],
  px: number,
  py: number,
): WorldMarker | null {
  let best: WorldMarker | null = null;
  let bestD = Infinity;
  const radius = Math.max(10, layout.scale * 0.6);
  for (const m of markers) {
    const [mx, my] = tilePixel(layout, m.x, m.y);
    const d = Math.hypot(px - mx, py - my);
    if (d < radius && d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

interface MarchLine {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number; // 0..1
  attack: boolean;
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  world: WorldMeta,
  markers: WorldMarker[],
  selectedId: string | null,
  marches: MarchLine[],
  view: MapView = { zoom: 1, panX: 0, panY: 0 },
) {
  ctx.clearRect(0, 0, w, h);
  const layout = getWorldLayout(w, h, world, view);
  const s = layout.scale;

  // terrain
  for (let ty = 0; ty < world.height; ty++) {
    for (let tx = 0; tx < world.width; tx++) {
      const n = hash(tx, ty, world.seed);
      let col: string;
      if (n < 0.12) col = "#1f3a52"; // water
      else if (n < 0.34) col = "#2f5d3a"; // forest
      else if (n < 0.5) col = "#3a6b41"; // grass dark
      else if (n < 0.78) col = "#467a48"; // grass
      else col = "#6b6a4a"; // hills
      ctx.fillStyle = col;
      ctx.fillRect(layout.ox + tx * s, layout.oy + ty * s, s + 1, s + 1);
    }
  }

  // subtle grid
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  for (let tx = 0; tx <= world.width; tx += 5) {
    ctx.beginPath();
    ctx.moveTo(layout.ox + tx * s, layout.oy);
    ctx.lineTo(layout.ox + tx * s, layout.oy + world.height * s);
    ctx.stroke();
  }
  for (let ty = 0; ty <= world.height; ty += 5) {
    ctx.beginPath();
    ctx.moveTo(layout.ox, layout.oy + ty * s);
    ctx.lineTo(layout.ox + world.width * s, layout.oy + ty * s);
    ctx.stroke();
  }

  // march lines
  for (const m of marches) {
    const [fx, fy] = tilePixel(layout, m.fromX, m.fromY);
    const [tx, ty] = tilePixel(layout, m.toX, m.toY);
    ctx.strokeStyle = m.attack ? "rgba(192,57,43,0.5)" : "rgba(63,122,77,0.5)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    // moving dot
    const dx = fx + (tx - fx) * m.progress;
    const dy = fy + (ty - fy) * m.progress;
    ctx.fillStyle = m.attack ? "#c0392b" : "#3f7a4d";
    ctx.beginPath();
    ctx.arc(dx, dy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // markers
  for (const m of markers) {
    const [mx, my] = tilePixel(layout, m.x, m.y);
    const r = Math.max(5, Math.min(13, 5 + Math.sqrt(m.power) * 0.25));

    if (m.self || selectedId === m.id) {
      ctx.strokeStyle = m.self ? "#f4dd8f" : "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mx, my, r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // banner pin
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.arc(mx, my + 1, r + 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = m.banner;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // online dot
    if (m.online && !m.isBot) {
      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.arc(mx + r - 1, my - r + 1, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// lighten/darken a hex color
function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const num = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.round(Math.min(255, Math.max(0, r + r * amt)));
  g = Math.round(Math.min(255, Math.max(0, g + g * amt)));
  b = Math.round(Math.min(255, Math.max(0, b + b * amt)));
  return `rgb(${r},${g},${b})`;
}
