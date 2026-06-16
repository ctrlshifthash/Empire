// Character sprite sheets (medieval pack). Each sheet is a 64×64 grid laid out
// as animation groups of 4 directions (down, left, up, right) plus a death row:
//   rows 0-3  move     (7 frames)
//   rows 4-7  shield    (8)
//   rows 8-11 attack — sword swing (9)
//   rows 12-15 block    (6)
//   rows 16-19 idle     (13)
//   row  20    death    (6)
// In-game characters only face left/right, so we use the down-facing row of
// each animation. drawSpriteChar() returns false until the image has loaded so
// callers can fall back to the procedural renderer.

const FRAME = 64;

export type SheetKey = "royal-guard" | "knight" | "gold-knight" | "king" | "captain" | "king2";
export type AnimState = "idle" | "move" | "attack";

// Group base row + frame count + speed. Direction order within each group is
// [up, left, down, right], so the actual row is base + dir (front = base + 2).
const ANIM: Record<AnimState, { base: number; frames: number; fps: number }> = {
  idle: { base: 16, frames: 13, fps: 6 },
  move: { base: 0, frames: 7, fps: 11 },
  attack: { base: 8, frames: 9, fps: 14 },
};

// Map a world-space movement vector to a sprite direction (0=up,1=left,2=down,
// 3=right) using the isometric projection. Defaults to front (down) when still.
export function spriteDir(dx: number, dy: number): number {
  const sx = dx - dy; // screen-x component
  const sy = (dx + dy) * 0.5; // screen-y component (2:1 iso → halve)
  if (Math.abs(sx) < 0.02 && Math.abs(sy) < 0.02) return 2;
  if (Math.abs(sy) >= Math.abs(sx)) return sy > 0 ? 2 : 0;
  return sx > 0 ? 3 : 1;
}

const KEYS: SheetKey[] = ["royal-guard", "knight", "gold-knight", "king", "captain", "king2"];
const sheets: Partial<Record<SheetKey, HTMLImageElement>> = {};
const ready: Partial<Record<SheetKey, boolean>> = {};

if (typeof Image !== "undefined") {
  for (const key of KEYS) {
    const img = new Image();
    img.onload = () => {
      ready[key] = true;
    };
    img.src = `/sprites/${key}.png`;
    sheets[key] = img;
  }
}

// Which sheet represents each in-game unit type (the four 13×21 sheets).
export const UNIT_SHEET: Record<string, SheetKey> = {
  villager: "king",
  spearman: "king",
  archer: "gold-knight",
  knight: "knight",
};

export interface SpriteOpts {
  scale: number; // overall size (1 ≈ 64px tall)
  state: AnimState; // idle / move / attack
  dir: number; // facing: 0=up, 1=left, 2=down, 3=right
  now: number; // current time (ms) for animation
  seed: number; // per-entity offset so they don't animate in lockstep
  ring?: string; // selection / team ring under the feet
}

export function drawSpriteChar(
  ctx: CanvasRenderingContext2D,
  key: SheetKey,
  sx: number,
  sy: number,
  o: SpriteOpts,
): boolean {
  const img = sheets[key];
  if (!img || !ready[key]) return false;

  const a = ANIM[o.state];
  const row = a.base + (o.dir & 3);
  const size = FRAME * o.scale;
  const frame = Math.floor((o.now + o.seed * 53) / (1000 / a.fps)) % a.frames;
  const moving = o.state !== "idle";
  const bob = (moving ? Math.sin(o.now * 0.02 + o.seed) * 1.4 : Math.sin(o.now * 0.006 + o.seed) * 0.6) * o.scale;

  // shadow
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(sx, sy, size * 0.22, size * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (o.ring) {
    ctx.strokeStyle = o.ring;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sx, sy, size * 0.24, size * 0.11, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  // anchor the feet (~86% down the frame) at (sx, sy)
  ctx.drawImage(img, frame * FRAME, row * FRAME, FRAME, FRAME, sx - size / 2, sy - size * 0.86 - bob, size, size);
  ctx.imageSmoothingEnabled = prevSmooth;
  return true;
}
