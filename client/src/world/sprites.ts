// Character sprite sheets (itch.io medieval pack). Each sheet is a 64×64 grid;
// row 0 is a 7-frame front-facing animation, which we cycle for idle/move. We
// load the images lazily and draw an animated frame anchored at the feet, with
// a soft shadow. drawSpriteChar() returns false until the image has loaded so
// callers can fall back to the procedural character renderer.

const FRAME = 64;
const ROW0_FRAMES = 7;

export type SheetKey = "royal-guard" | "knight" | "gold-knight" | "king" | "captain" | "king2";

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

// Which sheet represents each in-game unit type.
export const UNIT_SHEET: Record<string, SheetKey> = {
  villager: "king",
  spearman: "captain",
  archer: "gold-knight",
  knight: "knight",
};

export interface SpriteOpts {
  scale: number; // overall size (1 ≈ 64px tall)
  moving: boolean; // cycle the animation faster while moving
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

  const size = FRAME * o.scale;
  const frameMs = o.moving ? 90 : 220;
  const frame = Math.floor((o.now + o.seed * 53) / frameMs) % ROW0_FRAMES;
  const bob =
    (o.moving ? Math.sin(o.now * 0.02 + o.seed) * 1.5 : Math.sin(o.now * 0.006 + o.seed) * 0.7) * o.scale;

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
  ctx.drawImage(img, frame * FRAME, 0, FRAME, FRAME, sx - size / 2, sy - size * 0.86 - bob, size, size);
  ctx.imageSmoothingEnabled = prevSmooth;
  return true;
}
