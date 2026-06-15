// Isometric renderer for the live world. Draws ground tiles, then depth-sorts
// all standing objects (nodes, buildings, characters) by (x+y) so nearer things
// overlap farther ones. Uses sprites from assets when available (future), else
// clean drawn tokens.
import { BUILDINGS } from "@shared/gamedata";
import { LOCAL_WORLD } from "@shared/types";
import { TILE_H, TILE_W, screenToWorld, worldToScreen } from "./iso";
import type { BuildingView, Compound, Enemy, ResNode, Unit, World } from "./engine";
import {
  CANNON_COLS,
  CANNON_ROWS,
  FLAG_FRAMES,
  TILES,
  WINDMILL_FRAMES,
  drawSheetCell,
  drawTile,
  drawTileFrame,
  isReady,
  pathTileForMask,
} from "./tiles";

// Every wall tile except the two straight runs (indices 0 = wall_1, 7 = wall_8)
// is a tower variant. They're handed out round-robin across all the map's tower
// positions so the whole 16-piece set is guaranteed to appear.
const TOWER_TILES = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15];

// Gate cannons by gate side, for the two camera-facing sides (rows of the
// 8-direction cannon sheet): [left-flank row, right-flank row]. South fires
// SW/SE, East fires SE/E — so the barrels always point toward the viewer.
const GATE_CANNON: Record<string, [number, number]> = { S: [6, 7], E: [7, 3] };

const NODE_GLYPH: Record<ResNode["kind"], string> = {
  tree: "🌲",
  rock: "🪨",
  gold: "💎",
  bush: "🌿",
};

const BUILDING_COLOR: Record<string, string> = {
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
  market: "#3f6bb0",
};

const UNIT_COLOR: Record<string, string> = {
  villager: "#b88a4a",
  spearman: "#5a7fb0",
  archer: "#4f9a5e",
  knight: "#9a6fc0",
};

const UNIT_GEAR: Record<string, { weapon: Weapon; hat: Hat; cape?: boolean; skin?: string }> = {
  villager: { weapon: "hoe", hat: "cap", skin: "#e6b893" },
  spearman: { weapon: "spear", hat: "helmet" },
  archer: { weapon: "bow", hat: "hood" },
  knight: { weapon: "sword", hat: "helmet", cape: true },
};

export interface RenderOpts {
  hover: { wx: number; wy: number } | null;
  ghost: { type: string; valid: boolean } | null;
}

interface Origin {
  ox: number;
  oy: number;
}

function tileDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - TILE_H / 2);
  ctx.lineTo(cx + TILE_W / 2, cy);
  ctx.lineTo(cx, cy + TILE_H / 2);
  ctx.lineTo(cx - TILE_W / 2, cy);
  ctx.closePath();
}

function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function shadow(ctx: CanvasRenderingContext2D, sx: number, sy: number, rw: number) {
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(sx, sy, rw, rw * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
}

function hpBar(ctx: CanvasRenderingContext2D, sx: number, sy: number, frac: number, w = 26) {
  if (frac >= 1) return;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(sx - w / 2 - 1, sy - 1, w + 2, 5);
  ctx.fillStyle = frac > 0.5 ? "#5fd16a" : frac > 0.25 ? "#e8c75a" : "#e0533f";
  ctx.fillRect(sx - w / 2, sy, w * Math.max(0, frac), 3);
}

type Weapon = "spear" | "bow" | "sword" | "hoe" | "dagger" | null;
type Hat = "crown" | "helmet" | "hood" | "cap" | null;

interface CharOpts {
  color: string;
  facing: number;
  scale: number;
  weapon?: Weapon;
  hat?: Hat;
  cape?: boolean;
  skin?: string;
  moving?: boolean;
  attacking?: boolean;
  ring?: string;
  phase: number;
}

function drawHat(ctx: CanvasRenderingContext2D, sx: number, hy: number, r: number, f: number, s: number, hat: Hat, color: string) {
  if (hat === "crown") {
    ctx.fillStyle = "#f4dd8f";
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(sx - r, hy - r * 0.6);
    ctx.lineTo(sx - r, hy - r * 1.5);
    ctx.lineTo(sx - r * 0.5, hy - r);
    ctx.lineTo(sx, hy - r * 1.7);
    ctx.lineTo(sx + r * 0.5, hy - r);
    ctx.lineTo(sx + r, hy - r * 1.5);
    ctx.lineTo(sx + r, hy - r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (hat === "helmet") {
    ctx.fillStyle = "#9aa3ad";
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.arc(sx, hy, r * 1.05, Math.PI, 0);
    ctx.lineTo(sx + r * 1.05, hy + r * 0.2);
    ctx.lineTo(sx - r * 1.05, hy + r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // plume
    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.ellipse(sx, hy - r * 1.2, r * 0.4, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (hat === "hood") {
    ctx.fillStyle = "#3a3340";
    ctx.beginPath();
    ctx.arc(sx, hy, r * 1.15, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
  } else if (hat === "cap") {
    ctx.fillStyle = "#7a5a36";
    ctx.beginPath();
    ctx.arc(sx, hy - r * 0.2, r * 0.95, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(sx - r, hy - r * 0.2, f > 0 ? r * 1.6 : r, 1.4 * s);
  } else {
    // hair tuft
    ctx.fillStyle = "#5a3d24";
    ctx.beginPath();
    ctx.arc(sx, hy - r * 0.4, r * 0.95, Math.PI, 0);
    ctx.fill();
  }
}

function drawWeapon(ctx: CanvasRenderingContext2D, hx: number, hy: number, f: number, s: number, w: Weapon) {
  ctx.lineCap = "round";
  if (w === "spear") {
    ctx.strokeStyle = "#7a5230";
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.moveTo(hx, hy + 6 * s);
    ctx.lineTo(hx, hy - 12 * s);
    ctx.stroke();
    ctx.fillStyle = "#cdd3da";
    ctx.beginPath();
    ctx.moveTo(hx, hy - 16 * s);
    ctx.lineTo(hx - 2 * s, hy - 12 * s);
    ctx.lineTo(hx + 2 * s, hy - 12 * s);
    ctx.closePath();
    ctx.fill();
  } else if (w === "bow") {
    ctx.strokeStyle = "#7a5230";
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.arc(hx, hy, 7 * s, -Math.PI / 2.2, Math.PI / 2.2, f < 0);
    ctx.stroke();
    ctx.strokeStyle = "#e8e0c0";
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(hx + f * 0.5 * s, hy - 6 * s);
    ctx.lineTo(hx + f * 0.5 * s, hy + 6 * s);
    ctx.stroke();
  } else if (w === "sword") {
    ctx.strokeStyle = "#dfe4ea";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(hx, hy + 2 * s);
    ctx.lineTo(hx + f * 2 * s, hy - 11 * s);
    ctx.stroke();
    ctx.strokeStyle = "#c9a227";
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(hx - f * 2.5 * s, hy + 1 * s);
    ctx.lineTo(hx + f * 2.5 * s, hy + 3 * s);
    ctx.stroke();
  } else if (w === "hoe") {
    ctx.strokeStyle = "#8a6238";
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(hx, hy + 5 * s);
    ctx.lineTo(hx + f * 1 * s, hy - 9 * s);
    ctx.stroke();
    ctx.strokeStyle = "#9aa3ad";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(hx + f * 1 * s, hy - 9 * s);
    ctx.lineTo(hx + f * 5 * s, hy - 7 * s);
    ctx.stroke();
  } else if (w === "dagger") {
    ctx.strokeStyle = "#cdd3da";
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.moveTo(hx, hy + 1 * s);
    ctx.lineTo(hx + f * 1 * s, hy - 6 * s);
    ctx.stroke();
  }
}

// A little stylised person with team colours, gear, and walk/attack animation.
function drawCharacter(ctx: CanvasRenderingContext2D, sx: number, sy: number, o: CharOpts) {
  const s = o.scale;
  const f = o.facing >= 0 ? 1 : -1;
  const ph = o.phase;
  shadow(ctx, sx, sy, 8 * s);
  if (o.ring) {
    ctx.strokeStyle = o.ring;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 11 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const bob = (o.moving ? Math.sin(ph) * 1.4 : Math.sin(ph * 0.5) * 0.6) * s;
  const groundY = sy - bob;
  // legs
  const swing = (o.moving ? Math.sin(ph) : 0) * 3 * s;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#2c2118";
  ctx.lineWidth = 2.6 * s;
  ctx.beginPath();
  ctx.moveTo(sx - 2.2 * s, groundY - 6 * s);
  ctx.lineTo(sx - 2.2 * s + swing, groundY);
  ctx.moveTo(sx + 2.2 * s, groundY - 6 * s);
  ctx.lineTo(sx + 2.2 * s - swing, groundY);
  ctx.stroke();

  const bodyBottom = groundY - 6 * s;
  const bodyTop = bodyBottom - 11 * s;
  // cape behind the body (heroes)
  if (o.cape) {
    ctx.fillStyle = shade(o.color, -0.4);
    ctx.beginPath();
    ctx.moveTo(sx - f * 1 * s, bodyTop + 1 * s);
    ctx.lineTo(sx - f * 7 * s, bodyBottom + 3 * s);
    ctx.lineTo(sx - f * 1.5 * s, bodyBottom + 1 * s);
    ctx.closePath();
    ctx.fill();
  }
  // body / tunic
  ctx.fillStyle = o.color;
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1.3 * s;
  roundRect(ctx, sx - 4.5 * s, bodyTop, 9 * s, 12 * s, 3 * s);
  ctx.fill();
  ctx.stroke();
  // belt
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(sx - 4.5 * s, bodyBottom - 3 * s, 9 * s, 1.6 * s);

  // weapon arm + hand position (lunges when attacking)
  const lunge = (o.attacking ? 3.5 : o.moving ? Math.sin(ph) * 0.8 : 0) * s;
  const handX = sx + f * (4 * s + lunge);
  const handY = bodyTop + 6 * s - (o.attacking ? 2 * s : 0);
  ctx.strokeStyle = o.color;
  ctx.lineWidth = 2.4 * s;
  ctx.beginPath();
  ctx.moveTo(sx + f * 2 * s, bodyTop + 4 * s);
  ctx.lineTo(handX, handY);
  ctx.stroke();

  // weapon (drawn behind head for bows/spears reads fine here)
  drawWeapon(ctx, handX, handY, f, s, o.weapon ?? null);

  // head
  const headR = 4 * s;
  const headY = bodyTop - headR * 0.5;
  ctx.fillStyle = o.skin || "#f1c9a0";
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.arc(sx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // eye (facing)
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.beginPath();
  ctx.arc(sx + f * 1.5 * s, headY - 0.2 * s, 0.9 * s, 0, Math.PI * 2);
  ctx.fill();
  // headgear
  drawHat(ctx, sx, headY, headR, f, s, o.hat ?? null, o.color);
}

function drawWolf(ctx: CanvasRenderingContext2D, sx: number, sy: number, f: number, s: number, ph: number, moving: boolean) {
  shadow(ctx, sx, sy, 11 * s);
  const bob = (moving ? Math.sin(ph) : 0) * 1 * s;
  const y = sy - bob;
  const sw = (moving ? Math.sin(ph) : 0) * 2 * s;
  // legs
  ctx.strokeStyle = "#3f3f48";
  ctx.lineWidth = 2 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx - 5 * s, y - 3 * s);
  ctx.lineTo(sx - 5 * s + sw, y);
  ctx.moveTo(sx + 4 * s, y - 3 * s);
  ctx.lineTo(sx + 4 * s - sw, y);
  ctx.moveTo(sx - 1 * s, y - 3 * s);
  ctx.lineTo(sx - 1 * s - sw, y);
  ctx.moveTo(sx + 1 * s, y - 3 * s);
  ctx.lineTo(sx + 1 * s + sw, y);
  ctx.stroke();
  // tail
  ctx.strokeStyle = "#5b5b66";
  ctx.lineWidth = 2.6 * s;
  ctx.beginPath();
  ctx.moveTo(sx - f * 7 * s, y - 7 * s);
  ctx.lineTo(sx - f * 12 * s, y - 11 * s);
  ctx.stroke();
  // body
  ctx.fillStyle = "#5b5b66";
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.ellipse(sx, y - 7 * s, 8 * s, 4.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // head
  ctx.beginPath();
  ctx.ellipse(sx + f * 7 * s, y - 9 * s, 4 * s, 3.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // snout
  ctx.fillStyle = "#4a4a54";
  ctx.beginPath();
  ctx.moveTo(sx + f * 9 * s, y - 10 * s);
  ctx.lineTo(sx + f * 13 * s, y - 8.5 * s);
  ctx.lineTo(sx + f * 9 * s, y - 7 * s);
  ctx.closePath();
  ctx.fill();
  // ear
  ctx.beginPath();
  ctx.moveTo(sx + f * 6 * s, y - 12 * s);
  ctx.lineTo(sx + f * 7.5 * s, y - 15 * s);
  ctx.lineTo(sx + f * 9 * s, y - 12 * s);
  ctx.closePath();
  ctx.fill();
  // eye
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(sx + f * 8 * s, y - 9.5 * s, 1 * s, 0, Math.PI * 2);
  ctx.fill();
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  world: World,
  now: number,
  opts: RenderOpts,
) {
  ctx.clearRect(0, 0, w, h);
  // background sky/ground gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#243018");
  bg.addColorStop(1, "#1a230f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // zoom is applied with a canvas transform so every size/font scales uniformly
  const z = world.zoom || 1;
  const camS = worldToScreen(world.cam.x, world.cam.y);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(z, z);
  ctx.translate(-camS.sx, -camS.sy);
  const toScreen = (wx: number, wy: number) => {
    const s = worldToScreen(wx, wy);
    return { x: s.sx, y: s.sy };
  };

  // visible tile bounds: invert the four screen corners through the transform
  const inv = (sx: number, sy: number) =>
    screenToWorld((sx - w / 2) / z + camS.sx, (sy - h / 2) / z + camS.sy);
  const corners = [inv(0, 0), inv(w, 0), inv(0, h), inv(w, h)];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of corners) {
    minX = Math.min(minX, c.wx);
    maxX = Math.max(maxX, c.wx);
    minY = Math.min(minY, c.wy);
    maxY = Math.max(maxY, c.wy);
  }
  const x0 = Math.max(0, Math.floor(minX) - 1);
  const x1 = Math.min(world.W - 1, Math.ceil(maxX) + 1);
  const y0 = Math.max(0, Math.floor(minY) - 1);
  const y1 = Math.min(world.H - 1, Math.ceil(maxY) + 1);

  const town = world.town;

  // ground: real grass tiles (made from the pack), real cobblestone paths
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const s = toScreen(tx, ty);
      if (TILES.ready) {
        const gi = Math.abs(tx * 7 + ty * 13) % TILES.grassBase.length;
        drawTile(ctx, TILES.grassBase[gi], s.x, s.y);
      } else {
        // procedural fallback while the tiles load
        const n = hash(tx, ty, 11);
        ctx.fillStyle = n < 0.5 ? "#46692f" : "#4d7536";
        tileDiamond(ctx, s.x, s.y);
        ctx.fill();
      }
      // cobblestone road — autotiled so the path connects in every direction
      if (town && town.paths.has(`${tx},${ty}`)) {
        const mask =
          (town.paths.has(`${tx},${ty - 1}`) ? 1 : 0) | // N (-y)
          (town.paths.has(`${tx + 1},${ty}`) ? 2 : 0) | // E (+x)
          (town.paths.has(`${tx},${ty + 1}`) ? 4 : 0) | // S (+y)
          (town.paths.has(`${tx - 1},${ty}`) ? 8 : 0); //  W (-x)
        drawTile(ctx, TILES.grass[pathTileForMask(mask)], s.x, s.y);
      }
    }
  }

  // hover highlight
  if (opts.hover) {
    const s = toScreen(opts.hover.wx, opts.hover.wy);
    tileDiamond(ctx, s.x, s.y);
    ctx.fillStyle = opts.ghost
      ? opts.ghost.valid
        ? "rgba(95,209,106,0.35)"
        : "rgba(224,83,63,0.35)"
      : "rgba(244,221,143,0.22)";
    ctx.fill();
    ctx.strokeStyle = opts.ghost ? (opts.ghost.valid ? "#5fd16a" : "#e0533f") : "#f4dd8f";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (opts.ghost) {
      ctx.font = `${Math.floor(TILE_H * 0.9)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.85;
      ctx.fillText(BUILDINGS[opts.ghost.type as keyof typeof BUILDINGS]?.icon ?? "🏗️", s.x, s.y - TILE_H * 0.4);
      ctx.globalAlpha = 1;
    }
  }

  // collect depth-sorted standing objects
  interface Drawable {
    key: number;
    draw: () => void;
  }
  const objs: Drawable[] = [];

  // Draw a walled compound (capital, outpost, or ruin): correctly-oriented
  // straight walls, animated corner flag-towers, interval towers, and — for the
  // capital's south gate — firing cannons. All depth-sorted with the world.
  // round-robin tower-variant dispenser, shared across capital + all outposts
  let towerOrd = 0;
  const nextTower = () => TOWER_TILES[towerOrd++ % TOWER_TILES.length];

  const drawCompound = (c: Pick<Compound, "cx" | "cy" | "R" | "walls" | "gates">, isCapital: boolean) => {
    const { cx, cy, R } = c;
    const flagFrame = Math.floor(now / 130);
    const cannonFrame = Math.floor(now / 70) % CANNON_COLS;
    for (const [key, kind] of c.walls) {
      const [wx, wy] = key.split(",").map(Number);
      const s = toScreen(wx, wy);
      const onSideRun = wx === cx - R || wx === cx + R; // left/right runs vary in y
      // towers punctuate larger perimeters every 4th tile along a straight run
      const interval = R >= 4 && (onSideRun ? (wy - cy) % 4 === 0 : (wx - cx) % 4 === 0);

      // gate-flanking cannon emplacement (capital only, camera-facing gates)
      let cannonRow = -1;
      if (isCapital) {
        for (const g of c.gates) {
          const side = g.y === cy - R ? "N" : g.y === cy + R ? "S" : g.x === cx + R ? "E" : "W";
          const spec = GATE_CANNON[side];
          if (!spec) continue;
          if ((side === "N" || side === "S") && wy === g.y && Math.abs(wx - g.x) === 1) {
            cannonRow = spec[wx < g.x ? 0 : 1];
            break;
          }
          if ((side === "E" || side === "W") && wx === g.x && Math.abs(wy - g.y) === 1) {
            cannonRow = spec[wy < g.y ? 0 : 1];
            break;
          }
        }
      }

      if (cannonRow >= 0) {
        // stone tower flanking the gate, with a firing cannon mounted on top
        const tt = nextTower();
        objs.push({
          key: wx + wy + 0.02,
          draw: () => {
            drawTile(ctx, TILES.wall[tt], s.x, s.y, 1.16);
            drawSheetCell(ctx, TILES.cannon, cannonFrame, cannonRow, CANNON_COLS, CANNON_ROWS, s.x, s.y - 50, 0.8);
          },
        });
      } else if (kind === "corner") {
        // capital corners fly animated flags; outpost/ruin corners use varied towers
        if (isCapital) {
          objs.push({ key: wx + wy, draw: () => drawTileFrame(ctx, TILES.flag, flagFrame, FLAG_FRAMES, s.x, s.y, 1.12) });
        } else {
          const tt = nextTower();
          objs.push({ key: wx + wy, draw: () => drawTile(ctx, TILES.wall[tt], s.x, s.y, 1.16) });
        }
      } else if (interval) {
        // a tower punctuating the wall run — varied across the whole 16-piece set
        const tt = nextTower();
        objs.push({ key: wx + wy, draw: () => drawTile(ctx, TILES.wall[tt], s.x, s.y, 1.16) });
      } else {
        // straight wall run, correctly oriented:
        //   top/bottom runs (varying x) connect E–W  → wall_1 (index 0)
        //   side runs       (varying y) connect N–S  → wall_8 (index 7)
        const tile = onSideRun ? TILES.wall[7] : TILES.wall[0];
        objs.push({ key: wx + wy, draw: () => drawTile(ctx, tile, s.x, s.y, 1.24) });
      }
    }
  };

  if (town && TILES.ready) {
    drawCompound(town, true);
    for (const o of town.outposts) drawCompound(o, false);

    // lone watchtowers out on the diagonals (animated flag towers)
    const flagFrame = Math.floor(now / 130);
    for (const t of town.towers) {
      const s = toScreen(t.x, t.y);
      objs.push({ key: t.x + t.y, draw: () => drawTileFrame(ctx, TILES.flag, flagFrame, FLAG_FRAMES, s.x, s.y, 1.0) });
    }

    // fenced building plots laid out inside the capital walls (varied fence tiles)
    for (const p of town.decorPlots) {
      const s = toScreen(p.x, p.y);
      objs.push({ key: p.x + p.y - 0.01, draw: () => drawTile(ctx, TILES.plot[p.tile], s.x, s.y) });
    }
    // a working windmill inside the town
    const ws = toScreen(town.windmill.x, town.windmill.y);
    objs.push({
      key: town.windmill.x + town.windmill.y,
      draw: () => {
        drawTile(ctx, TILES.plot[1], ws.x, ws.y);
        drawTileFrame(ctx, TILES.windmill, Math.floor(now / 110), WINDMILL_FRAMES, ws.x, ws.y);
      },
    });
  }

  for (const n of world.nodes) {
    const s = toScreen(n.x, n.y);
    objs.push({
      key: n.x + n.y,
      draw: () => {
        if (n.respawnAt > 0) {
          // depleted stump
          shadow(ctx, s.x, s.y, 10);
          ctx.fillStyle = "#5b4a2e";
          ctx.beginPath();
          ctx.ellipse(s.x, s.y - 3, 6, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        shadow(ctx, s.x, s.y, 18);
        ctx.font = "42px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(NODE_GLYPH[n.kind], s.x, s.y);
      },
    });
  }

  for (const b of world.buildings) {
    const s = toScreen(b.x, b.y);
    objs.push({
      key: b.x + b.y,
      draw: () => {
        // fenced plot under every building
        if (isReady(TILES.plot[1])) drawTile(ctx, TILES.plot[1], s.x, s.y);
        if (b.type === "town_center" && isReady(TILES.castle)) {
          const size = 210;
          ctx.drawImage(TILES.castle, s.x - size / 2, s.y + TILE_H / 2 - size + 14, size, size);
        } else if (b.type === "farm" && isReady(TILES.windmill)) {
          drawTileFrame(ctx, TILES.windmill, Math.floor(now / 110), WINDMILL_FRAMES, s.x, s.y);
        } else {
          drawBuilding(ctx, s.x, s.y, b, now);
        }
      },
    });
  }

  for (const u of world.units) {
    if (u.downUntil > 0) continue;
    const s = toScreen(u.x, u.y);
    const sel = world.selected.has(u.id);
    const gear = UNIT_GEAR[u.type] ?? UNIT_GEAR.villager;
    // face toward order / attack target, else the hero
    const en = u.attackId != null ? world.enemies.find((z) => z.id === u.attackId) : null;
    const tx = en ? en.x : u.order ? u.order.x : world.hero.x;
    objs.push({
      key: u.x + u.y,
      draw: () => {
        drawCharacter(ctx, s.x, s.y, {
          color: UNIT_COLOR[u.type] ?? "#aaa",
          facing: tx >= u.x ? 1 : -1,
          scale: 1.5,
          weapon: gear.weapon,
          hat: gear.hat,
          cape: gear.cape,
          skin: gear.skin,
          moving: !!u.order || u.attackId != null,
          attacking: u.swing > 0.25,
          ring: sel ? "#5fd16a" : undefined,
          phase: now * 0.012 + u.id,
        });
        hpBar(ctx, s.x, s.y - 48, u.hp / u.maxHp, 32);
      },
    });
  }

  for (const e of world.enemies) {
    if (e.respawnAt > 0) continue;
    const s = toScreen(e.x, e.y);
    const f = world.hero.x >= e.x ? 1 : -1;
    objs.push({
      key: e.x + e.y,
      draw: () => {
        if (e.kind === "wolf") {
          drawWolf(ctx, s.x, s.y, f, 1.5, now * 0.014 + e.id, e.swing > 0.2);
        } else {
          drawCharacter(ctx, s.x, s.y, {
            color: e.kind === "brigand" ? "#7a2b3a" : "#8a3a2a",
            facing: f,
            scale: 1.5,
            weapon: e.kind === "brigand" ? "sword" : "dagger",
            hat: "hood",
            skin: "#c79a72",
            moving: false,
            attacking: e.swing > 0.4,
            ring: "rgba(224,83,63,0.55)",
            phase: now * 0.012 + e.id,
          });
        }
        hpBar(ctx, s.x, s.y - 48, e.hp / e.maxHp, 34);
      },
    });
  }

  // hero
  {
    const hsx = toScreen(world.hero.x, world.hero.y);
    const dead = world.hero.deadUntil > 0;
    objs.push({
      key: world.hero.x + world.hero.y,
      draw: () => {
        if (dead) return;
        drawCharacter(ctx, hsx.x, hsx.y, {
          color: "#d8a52a",
          facing: world.hero.facing,
          scale: 1.95,
          weapon: "sword",
          hat: "crown",
          cape: true,
          moving: world.hero.state === "move",
          attacking: world.hero.state === "fight",
          ring: "rgba(244,221,143,0.7)",
          phase: now * 0.012,
        });
        hpBar(ctx, hsx.x, hsx.y - 64, world.hero.hp / world.hero.maxHp, 44);
        if (world.hero.state === "harvest") {
          ctx.strokeStyle = "#7CFC8A";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(hsx.x, hsx.y - 28, 26, -Math.PI / 2, -Math.PI / 2 + (world.hero.harvestT / 1.6) * Math.PI * 2);
          ctx.stroke();
        }
      },
    });
  }

  objs.sort((a, b) => a.key - b.key);
  for (const o of objs) o.draw();

  // floating combat/gather text
  ctx.textAlign = "center";
  for (const f of world.floats) {
    const t = (now - f.born) / 1100;
    const s = toScreen(f.x, f.y);
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = f.color;
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(f.text, s.x, s.y - 28 - t * 22);
  }
  ctx.globalAlpha = 1;

  ctx.restore(); // end zoom transform
}

type RoofKind = "peak" | "battlement" | "thatch" | "flat" | "field" | "awning";
interface BStyle {
  wall: string;
  roof: string;
  kind: RoofKind;
  w: number;
  h: number;
  banner?: string;
}
const B_STYLE: Record<string, BStyle> = {
  town_center: { wall: "#c2ad7e", roof: "#8a6a3a", kind: "battlement", w: 40, h: 30, banner: "#c9a227" },
  house: { wall: "#cdaa78", roof: "#9c4a30", kind: "peak", w: 26, h: 18 },
  lumber_camp: { wall: "#9a784a", roof: "#6b4a2a", kind: "thatch", w: 28, h: 18 },
  farm: { wall: "#9c8a4a", roof: "#7c9c3a", kind: "field", w: 40, h: 8 },
  gold_mine: { wall: "#8a8378", roof: "#5a5650", kind: "flat", w: 28, h: 20 },
  quarry: { wall: "#9b9384", roof: "#6b6357", kind: "flat", w: 28, h: 20 },
  barracks: { wall: "#a07a5a", roof: "#7a3a2a", kind: "battlement", w: 34, h: 24, banner: "#9c2b21" },
  archery_range: { wall: "#a07a4a", roof: "#6b4a2a", kind: "thatch", w: 30, h: 20 },
  stable: { wall: "#8a6a44", roof: "#6b3a2a", kind: "peak", w: 32, h: 20 },
  wall: { wall: "#928c7f", roof: "#6b6357", kind: "battlement", w: 30, h: 14 },
  market: { wall: "#b08a4a", roof: "#3f6bb0", kind: "awning", w: 30, h: 18, banner: "#3f6bb0" },
};

function drawRoof(ctx: CanvasRenderingContext2D, sx: number, top: number, bw: number, depth: number, st: BStyle) {
  ctx.fillStyle = st.roof;
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1.2;
  if (st.kind === "peak") {
    ctx.beginPath();
    ctx.moveTo(sx - bw / 2 - 2, top);
    ctx.lineTo(sx, top - 11);
    ctx.lineTo(sx + bw / 2 + 2 + depth, top - depth * 0.6);
    ctx.lineTo(sx + bw / 2 + depth, top - depth * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (st.kind === "thatch") {
    ctx.beginPath();
    ctx.moveTo(sx - bw / 2 - 2, top + 1);
    ctx.quadraticCurveTo(sx, top - 9, sx + bw / 2 + 2, top + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (st.kind === "battlement") {
    ctx.fillRect(sx - bw / 2 - 1, top - 5, bw + 2, 6);
    ctx.strokeRect(sx - bw / 2 - 1, top - 5, bw + 2, 6);
    for (let i = 0; i < 4; i++) ctx.fillRect(sx - bw / 2 + i * (bw / 4) + 1, top - 9, bw / 8, 4);
  } else if (st.kind === "awning") {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? "#e8e0d0" : st.roof;
      ctx.fillRect(sx - bw / 2 + i * (bw / 5), top - 4, bw / 5, 5);
    }
  } else {
    // flat
    ctx.fillRect(sx - bw / 2 - 1, top - 3, bw + 2 + depth, 4);
  }
}

function drawBuilding(ctx: CanvasRenderingContext2D, sx: number, sy: number, b: BuildingView, now: number) {
  const st = B_STYLE[b.type] ?? B_STYLE.house;
  const bw = st.w;
  const bh = st.h;
  shadow(ctx, sx, sy, bw * 0.62);
  // stone footprint
  ctx.fillStyle = "rgba(40,30,18,0.45)";
  tileDiamond(ctx, sx, sy);
  ctx.fill();

  // a farm is a low field of crops rather than a tall building
  if (st.kind === "field") {
    ctx.fillStyle = "#6e5a30";
    roundRect(ctx, sx - bw / 2, sy - 12, bw, 12, 3);
    ctx.fill();
    for (let r = 0; r < 3; r++) {
      ctx.strokeStyle = b.constructing ? "#5a4a28" : "#8fb43a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - bw / 2 + 3, sy - 9 + r * 3.5);
      ctx.lineTo(sx + bw / 2 - 3, sy - 9 + r * 3.5);
      ctx.stroke();
    }
    drawBuildingOverlays(ctx, sx, sy - 18, b, now, bw, 18);
    return;
  }

  const bottom = sy - 2;
  const top = bottom - bh;
  const depth = 6;
  // right depth face
  ctx.fillStyle = shade(st.wall, -0.4);
  ctx.beginPath();
  ctx.moveTo(sx + bw / 2, top);
  ctx.lineTo(sx + bw / 2 + depth, top - depth * 0.6);
  ctx.lineTo(sx + bw / 2 + depth, bottom - depth * 0.6);
  ctx.lineTo(sx + bw / 2, bottom);
  ctx.closePath();
  ctx.fill();
  // front wall
  const grad = ctx.createLinearGradient(sx, top, sx, bottom);
  grad.addColorStop(0, st.wall);
  grad.addColorStop(1, shade(st.wall, -0.28));
  ctx.fillStyle = grad;
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.rect(sx - bw / 2, top, bw, bh);
  ctx.fill();
  ctx.stroke();
  // door
  ctx.fillStyle = "#3a2a1a";
  roundRect(ctx, sx - 4, bottom - Math.min(13, bh - 2), 8, Math.min(13, bh - 2), 3);
  ctx.fill();
  // windows
  if (bh > 16) {
    ctx.fillStyle = "#2b3b4a";
    ctx.fillRect(sx - bw / 2 + 4, top + 5, 5, 5);
    ctx.fillRect(sx + bw / 2 - 9, top + 5, 5, 5);
  }
  drawRoof(ctx, sx, top, bw, depth, st);
  // banner on top (military / town)
  if (st.banner) {
    ctx.strokeStyle = "#5a4a2a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx, top - 9);
    ctx.lineTo(sx, top - 20);
    ctx.stroke();
    ctx.fillStyle = st.banner;
    ctx.beginPath();
    ctx.moveTo(sx, top - 20);
    ctx.lineTo(sx + 9, top - 18);
    ctx.lineTo(sx, top - 14);
    ctx.closePath();
    ctx.fill();
  }
  // small recognisable sign
  ctx.font = "10px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.95;
  ctx.fillText(BUILDINGS[b.type]?.icon ?? "🏠", sx, top + bh / 2);
  ctx.globalAlpha = 1;

  drawBuildingOverlays(ctx, sx, top, b, now, bw + depth, bh);
}

function drawBuildingOverlays(
  ctx: CanvasRenderingContext2D,
  sx: number,
  top: number,
  b: BuildingView,
  now: number,
  bw: number,
  bh: number,
) {
  // level pips
  if (b.level >= 1 && !b.constructing) {
    for (let i = 0; i < Math.min(b.level, 5); i++) {
      ctx.fillStyle = "#f4dd8f";
      ctx.beginPath();
      ctx.arc(sx - bw / 2 + 4 + i * 5, top + bh - 2, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // construction overlay
  if (b.constructing && b.completesAt) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(sx - bw / 2, top - 4, bw, bh + 4);
    // scaffold
    ctx.strokeStyle = "rgba(220,180,90,0.7)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(sx - bw / 2 + (i * bw) / 3, top);
      ctx.lineTo(sx - bw / 2 + (i * bw) / 3, top + bh);
      ctx.stroke();
    }
    ctx.font = "13px serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("🔨", sx, top + bh / 2 - 3);
    const remain = Math.max(0, Math.ceil((b.completesAt - now) / 1000));
    ctx.font = "bold 9px sans-serif";
    ctx.fillStyle = "#f4dd8f";
    ctx.fillText(remain < 60 ? `${remain}s` : `${Math.ceil(remain / 60)}m`, sx, top + bh + 3);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// lighten (amt>0) / darken (amt<0) a hex colour
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

// Draw a small top-down minimap into a separate canvas context.
export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  size: number,
  world: World,
) {
  ctx.clearRect(0, 0, size, size);
  const sc = size / world.W;
  ctx.fillStyle = "#2f4a2c";
  ctx.fillRect(0, 0, size, size);
  // nodes
  for (const n of world.nodes) {
    if (n.respawnAt > 0) continue;
    ctx.fillStyle = n.kind === "tree" ? "#3f7a4d" : n.kind === "rock" ? "#9b9384" : n.kind === "gold" ? "#e8c75a" : "#7c9c3a";
    ctx.fillRect(n.x * sc - 1, n.y * sc - 1, 2, 2);
  }
  // buildings
  for (const b of world.buildings) {
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(b.x * sc - 1.5, b.y * sc - 1.5, 3, 3);
  }
  // enemies
  ctx.fillStyle = "#e0533f";
  for (const e of world.enemies) {
    if (e.respawnAt > 0) continue;
    ctx.fillRect(e.x * sc - 1, e.y * sc - 1, 2, 2);
  }
  // hero
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(world.hero.x * sc, world.hero.y * sc, 2.5, 0, Math.PI * 2);
  ctx.fill();
}
