// ─────────────────────────────────────────────────────────────────────────────
// Isometric village for the Hub — renders the Village_1_S tileset. The whole
// settlement is spread across a large grid (houses scattered over the full map,
// a market plaza at the centre, dirt roads to every edge, trees/flowers between)
// so there's a big world to roam. Native tile is a 353×209 iso diamond.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = "/village/";

export const V_TILE_W = 353;
export const V_TILE_H = 176;
export const V_SCALE = 0.62;
export const V_HSTEP = (V_TILE_W / 2) * V_SCALE;
export const V_VSTEP = (V_TILE_H / 2) * V_SCALE;

// ── image cache + preload ────────────────────────────────────────────────────
const cache = new Map<string, HTMLImageElement>();
let pending = 0;
let ready = false;
export const villageReady = () => ready;
export const vimg = (name: string): HTMLImageElement | undefined => cache.get(name);

function need(name: string): void {
  if (cache.has(name)) return;
  const img = new Image();
  pending++;
  img.onload = img.onerror = () => {
    if (--pending <= 0) ready = true;
  };
  img.src = `${BASE}${name}.png`;
  cache.set(name, img);
}

// small deterministic PRNG (mulberry32) so the layout is stable across reloads
function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── ground map ───────────────────────────────────────────────────────────────
const G = "ground_13"; // grass
const D = "ground_18"; // dirt

// Big square map. Bump GRID to grow it; everything is centre-relative.
const GRID_W = 37;
const GRID_H = 37;
const CX = (GRID_W - 1) / 2; // centre tile / avatar (0,0)
const MARKET_R = 4.5; // market-plaza radius

// Walk-bound from the map size so you can roam to the very edge.
export const V_BOUND = CX - 0.6;

function buildGround(): string[][] {
  const g = Array.from({ length: GRID_H }, () => Array.from({ length: GRID_W }, () => G));
  const dirt = (x: number, y: number) => {
    if (y >= 0 && y < GRID_H && x >= 0 && x < GRID_W) g[y][x] = D;
  };
  // circular market plaza at the centre
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++)
      if (Math.hypot(x - CX, y - CX) <= MARKET_R) dirt(x, y);
  // three-wide dirt roads running from the plaza out to all four edges
  for (let y = 0; y < GRID_H; y++) for (let d = -1; d <= 1; d++) dirt(CX + d, y);
  for (let x = 0; x < GRID_W; x++) for (let d = -1; d <= 1; d++) dirt(x, CX + d);
  return g;
}
export const GROUND: string[][] = buildGround();

// ── houses spread across the whole map ───────────────────────────────────────
export interface VObj {
  sprite: string;
  gx: number;
  gy: number;
  dy?: number;
  anim?: string[];
  flat?: boolean;
}

const HOUSE_SPRITES = [
  "house_1_1_1", "house_1_2_1", "house_1_3_1", "house_1_4_1",
  "house_2_1_1", "house_2_2_1", "house_2_3_1", "house_2_4_1",
  "house_3_1_1", "house_3_2_1",
  "house_4_1_1", "house_4_2_1", "house_4_3_1", "house_4_4_1",
  "house_5_1_1", "house_5_2_1", "house_5_3_1", "house_5_4_1",
];

// Scatter ~50 houses over the whole map: off the roads/plaza, well spaced so
// there's open grass to walk between them.
function buildHouses(): { houses: VObj[]; pos: [number, number][] } {
  const houses: VObj[] = [];
  const pos: [number, number][] = [];
  const rnd = mulberry(99991);
  const isDirt = (gx: number, gy: number) => GROUND[Math.round(gy)]?.[Math.round(gx)] === D;
  let i = 0;
  for (let tries = 0; tries < 9000 && houses.length < 50; tries++) {
    const gx = 2 + rnd() * (GRID_W - 4);
    const gy = 2 + rnd() * (GRID_H - 4);
    if (isDirt(gx, gy)) continue; // keep off roads + plaza
    if (Math.hypot(gx - CX, gy - CX) < MARKET_R + 2) continue; // leave the plaza open
    if (pos.some(([px, py]) => Math.hypot(px - gx, py - gy) < 3.0)) continue; // spacing
    pos.push([gx, gy]);
    houses.push({ sprite: HOUSE_SPRITES[i % HOUSE_SPRITES.length], gx, gy });
    i++;
  }
  return { houses, pos };
}
const BUILT = buildHouses();
const HOUSES = BUILT.houses;
const HOUSE_POS = BUILT.pos;

const BLADES = ["blades_animation_1", "blades_animation_2", "blades_animation_3", "blades_animation_4", "blades_animation_5", "blades_animation_6", "blades_animation_7"];

// ── market plaza + decor (centre-relative) ───────────────────────────────────
const c = CX;
const PLACED: VObj[] = [
  // dirt scuffs around the fountain
  { sprite: "dirt_stain_1", gx: c - 0.9, gy: c + 0.3, flat: true },
  { sprite: "dirt_stain_2", gx: c + 1.0, gy: c - 0.5, flat: true },
  { sprite: "dirt_stain_3", gx: c + 0.4, gy: c + 1.0, flat: true },
  // 12 stalls ringing the fountain
  { sprite: "fruit_stand_1", gx: c - 2.6, gy: c - 1.6 },
  { sprite: "pastry_stand_1", gx: c + 2.6, gy: c - 1.6 },
  { sprite: "ceramic_stand_1", gx: c - 2.6, gy: c + 1.6 },
  { sprite: "fruit_stand_2", gx: c + 2.6, gy: c + 1.6 },
  { sprite: "pastry_stand_2", gx: c, gy: c - 3.0 },
  { sprite: "ceramic_stand_2", gx: c, gy: c + 3.0 },
  { sprite: "fruit_stand_3", gx: c - 3.2, gy: c },
  { sprite: "pastry_stand_3", gx: c + 3.2, gy: c },
  { sprite: "ceramic_stand_3", gx: c - 1.4, gy: c - 2.6 },
  { sprite: "fruit_stand_4", gx: c + 1.4, gy: c - 2.6 },
  { sprite: "pastry_stand_4", gx: c - 1.4, gy: c + 2.6 },
  { sprite: "ceramic_stand_4", gx: c + 1.4, gy: c + 2.6 },
  // market goods by the fountain (every bag + basket colour)
  { sprite: "bag_1", gx: c - 1.0, gy: c - 0.6 },
  { sprite: "bag_2", gx: c + 1.1, gy: c - 0.3 },
  { sprite: "bag_3", gx: c - 0.6, gy: c + 1.1 },
  { sprite: "bag_4", gx: c + 0.8, gy: c + 0.9 },
  { sprite: "basket_1", gx: c - 0.3, gy: c + 0.5 },
  { sprite: "basket_2", gx: c + 0.5, gy: c - 0.9 },
  { sprite: "basket_3", gx: c + 0.2, gy: c + 0.7 },
  { sprite: "basket_4", gx: c + 0.9, gy: c + 0.2 },
  // animals around the plaza
  { sprite: "chiken", gx: c - 0.7, gy: c + 0.4 },
  { sprite: "chiken", gx: c + 0.7, gy: c + 0.6 },
  { sprite: "chiken", gx: c + 1.5, gy: c - 0.4 },
  { sprite: "dog", gx: c - 2.0, gy: c + 1.8 },
  { sprite: "dog", gx: c + 3.0, gy: c - 1.2 },
  { sprite: "bird", gx: c - 4.0, gy: c - 4.0 },
  { sprite: "bird", gx: c + 5.0, gy: c + 3.0 },
  // props in the ring just outside the plaza
  { sprite: "cart_1", gx: c - 5.0, gy: c - 1.0 },
  { sprite: "cart_2", gx: c + 4.0, gy: c + 5.0 },
  { sprite: "campfire", gx: c - 5.5, gy: c - 5.5 },
  { sprite: "campfire", gx: c + 5.5, gy: c - 5.5 },
  { sprite: "campfire", gx: c - 5.5, gy: c + 5.5 },
  { sprite: "chest", gx: c + 6.0, gy: c - 2.0 },
  { sprite: "chest", gx: c - 6.0, gy: c + 3.0 },
  { sprite: "logs", gx: c - 3.0, gy: c + 6.0 },
  { sprite: "logs", gx: c + 6.5, gy: c + 1.0 },
  { sprite: "rock", gx: c - 7.0, gy: c },
  { sprite: "rock", gx: c + 7.0, gy: c },
  { sprite: "rock", gx: c, gy: c - 7.0 },
  { sprite: "rock", gx: c, gy: c + 7.0 },
  // laundry strung up around the village
  { sprite: "hanging_laundry_1", gx: c - 7.5, gy: c - 3.5 },
  { sprite: "hanging_laundry_2", gx: c + 7.5, gy: c - 4.0 },
  { sprite: "hanging_laundry_4", gx: c - 4.0, gy: c + 7.5 },
  { sprite: "hanging_laundry_5", gx: c + 5.0, gy: c + 7.5 },
  { sprite: "hanging_laundry_3", gx: c + 2.0, gy: c - 8.0 },
  // windmill sails (animated, east edge)
  { sprite: "blades_animation_1", gx: GRID_W - 1.6, gy: c - 2.0, anim: BLADES },
];

// ── trees + flowers between the houses (open, never on roads/houses) ──────────
function scatter(): VObj[] {
  const out: VObj[] = [];
  const rnd = mulberry(424242);
  const trees = ["tree_1", "tree_2", "tree_3", "tree_4", "tree_5"];
  const flowers = Array.from({ length: 35 }, (_, i) => `plant_${i + 8}`);
  const onGrass = (gx: number, gy: number) => GROUND[Math.round(gy)]?.[Math.round(gx)] === G;
  const nearHouse = (gx: number, gy: number) => HOUSE_POS.some(([hx, hy]) => Math.abs(hx - gx) < 1.4 && Math.abs(hy - gy) < 1.4);
  const place = (list: string[], tries: number) => {
    for (let i = 0; i < tries; i++) {
      const gx = 0.5 + rnd() * (GRID_W - 1.5);
      const gy = 0.5 + rnd() * (GRID_H - 1.5);
      if (!onGrass(gx, gy) || nearHouse(gx, gy)) continue;
      if (rnd() > 0.45) continue; // keep it open — lots of bare grass to walk
      out.push({ sprite: list[i % list.length], gx, gy });
    }
  };
  place(trees, 320);
  place(flowers, 520);
  return out;
}

export const OBJECTS: VObj[] = [...PLACED, ...HOUSES, ...scatter()];

export function loadVillage(): void {
  if (cache.size) return;
  const set = new Set<string>([G, D]);
  for (const row of GROUND) for (const t of row) set.add(t);
  for (const o of OBJECTS) {
    set.add(o.sprite);
    if (o.anim) for (const f of o.anim) set.add(f);
  }
  for (const n of set) need(n);
}

// ── iso projection + draw ────────────────────────────────────────────────────
export function vToScreen(gx: number, gy: number): { sx: number; sy: number } {
  return { sx: (gx - gy) * V_HSTEP, sy: (gx + gy) * V_VSTEP };
}

export function drawGround(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number): void {
  const w = V_TILE_W * V_SCALE;
  const h = img.height * V_SCALE;
  ctx.drawImage(img, cx - w / 2, cy - V_VSTEP, w, h);
}

export function drawObj(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, dy = 0, flat = false): void {
  const w = img.width * V_SCALE;
  const h = img.height * V_SCALE;
  ctx.drawImage(img, cx - w / 2, flat ? cy - h / 2 + dy : cy - h + dy, w, h);
}

// ── shared hub props (the live hub + spectate both render these) ─────────────

// The courtyard fountain — sits at the centre of the plaza.
export function drawHubFountain(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
  const rw = V_TILE_W * V_SCALE * 0.42;
  const rh = V_TILE_H * V_SCALE * 0.42;
  ctx.fillStyle = "#6e675b";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#564f45";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw * 0.86, rh * 0.86, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3f93c6";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw * 0.68, rh * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();
  // ripples + spout
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1.5;
  const r = (Math.sin(t / 600) + 1) * 0.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw * (0.18 + r * 0.42), rh * (0.18 + r * 0.42), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#bfe6f7";
  ctx.beginPath();
  ctx.ellipse(cx, cy - rh * 0.7, 4, 11, 0, 0, Math.PI * 2);
  ctx.fill();
}

// The prize wheel — a "spin to win" prop on a post with a slow idle spin.
const WHEEL_COLORS = ["#e6443b", "#f0922f", "#f4c63d", "#5bbf4a", "#2fb3a8", "#3b82d6", "#8b54d6", "#d64f9e"];
export function drawHubSpinner(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
  const U = V_TILE_W * V_SCALE; // base unit (matches the fountain's scale)
  const R = U * 0.4; // wheel radius
  const wy = cy - R * 1.7; // wheel centre, raised on the post
  const N = WHEEL_COLORS.length;
  const SEG = (Math.PI * 2) / N;
  const spin = (t / 5200) * Math.PI * 2; // slow idle rotation

  // ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.62, R * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  // wooden post + a thin highlight down its centre
  ctx.fillStyle = "#5d3f24";
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.13, cy);
  ctx.lineTo(cx + R * 0.13, cy);
  ctx.lineTo(cx + R * 0.07, wy + R * 0.2);
  ctx.lineTo(cx - R * 0.07, wy + R * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(cx - R * 0.03, wy + R * 0.2, R * 0.05, cy - wy - R * 0.2);

  // outer glow + gold rim
  ctx.save();
  ctx.shadowColor = "rgba(244,205,90,0.55)";
  ctx.shadowBlur = U * 0.5;
  ctx.fillStyle = "#caa53a";
  ctx.beginPath();
  ctx.arc(cx, wy, R * 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#9a7820"; // inner rim ring
  ctx.beginPath();
  ctx.arc(cx, wy, R, 0, Math.PI * 2);
  ctx.fill();

  // colour segments
  for (let i = 0; i < N; i++) {
    const a0 = spin + i * SEG;
    ctx.fillStyle = WHEEL_COLORS[i];
    ctx.beginPath();
    ctx.moveTo(cx, wy);
    ctx.arc(cx, wy, R * 0.9, a0, a0 + SEG);
    ctx.closePath();
    ctx.fill();
  }
  // segment dividers
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1, U * 0.03);
  for (let i = 0; i < N; i++) {
    const a = spin + i * SEG;
    ctx.beginPath();
    ctx.moveTo(cx, wy);
    ctx.lineTo(cx + Math.cos(a) * R * 0.9, wy + Math.sin(a) * R * 0.9);
    ctx.stroke();
  }

  // casino bulbs around the rim (twinkle)
  const BULBS = 16;
  for (let i = 0; i < BULBS; i++) {
    const a = (i / BULBS) * Math.PI * 2;
    const lit = (Math.floor(t / 170) + i) % 2 === 0;
    ctx.fillStyle = lit ? "#fff4c2" : "#b9912f";
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * R, wy + Math.sin(a) * R, R * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }

  // hub cap
  ctx.fillStyle = "#f4cd5a";
  ctx.beginPath();
  ctx.arc(cx, wy, R * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7a5e1c";
  ctx.beginPath();
  ctx.arc(cx, wy, R * 0.075, 0, Math.PI * 2);
  ctx.fill();

  // top pointer (points down into the wheel)
  ctx.fillStyle = "#e23b3b";
  ctx.beginPath();
  ctx.moveTo(cx, wy - R * 0.82);
  ctx.lineTo(cx - R * 0.13, wy - R * 1.14);
  ctx.lineTo(cx + R * 0.13, wy - R * 1.14);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.stroke();
}
