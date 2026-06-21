// ─────────────────────────────────────────────────────────────────────────────
// Sprite-sheet characters for the Hub avatar. Each character has a 4-direction
// walk cycle (front / back / left / right, N frames) sliced from its sheet. A
// player renders the character they have EQUIPPED; falls back to the voxel hero
// until frames load (or if nothing is equipped). Left/right are their own frames.
// ─────────────────────────────────────────────────────────────────────────────

// Registry keyed by the character's type id (matches gamedata CHARACTERS ids).
const CHARS: Record<string, { folder: string; frames: number; scale: number }> = {
  alon: { folder: "alon", frames: 4, scale: 0.34 },
  frank: { folder: "frank", frames: 6, scale: 0.66 },
  ansem: { folder: "ansem", frames: 6, scale: 0.42 },
  cobie: { folder: "cobie", frames: 6, scale: 0.42 },
  fibonacki: { folder: "fibonacki", frames: 6, scale: 0.42 },
  gake: { folder: "gake", frames: 6, scale: 0.42 },
  json1444: { folder: "json1444", frames: 6, scale: 0.42 },
  mert: { folder: "mert", frames: 6, scale: 0.42 },
  pingu: { folder: "pingu", frames: 6, scale: 0.42 },
  rains: { folder: "rains", frames: 6, scale: 0.42 },
  remus: { folder: "remus", frames: 6, scale: 0.42 },
  sling: { folder: "sling", frames: 6, scale: 0.42 },
};
const DIRS = ["front", "back", "left", "right"] as const;
export type Facing = (typeof DIRS)[number];

const cache = new Map<string, HTMLImageElement>(); // key: `${id}/${dir}_${i}`
const requested = new Set<string>();

// Preload a character's frames. Idempotent; also called lazily on first draw.
export function loadCharSprite(id?: string): void {
  if (!id || !CHARS[id] || requested.has(id)) return;
  requested.add(id);
  const c = CHARS[id];
  for (const d of DIRS) for (let i = 0; i < c.frames; i++) {
    const img = new Image();
    img.src = `/characters/${c.folder}/${d}_${i}.png`;
    cache.set(`${id}/${d}_${i}`, img);
  }
}

// Pick a facing from screen-space movement (sdx = dx-dy, sdy = dx+dy in iso).
export function facingFromMove(sdx: number, sdy: number, prev: Facing): Facing {
  if (sdx === 0 && sdy === 0) return prev;
  if (Math.abs(sdy) >= Math.abs(sdx)) return sdy > 0 ? "front" : "back";
  return sdx > 0 ? "right" : "left";
}

// Draw the equipped character `id` with its feet at (x, y). Returns false (so the
// caller draws the voxel hero) if there's no sprite for this id or it isn't loaded.
export function drawCharSprite(ctx: CanvasRenderingContext2D, x: number, y: number, dir: Facing, moving: boolean, phase: number, id?: string): boolean {
  if (!id || !CHARS[id]) return false;
  loadCharSprite(id); // lazy-load (e.g. a remote player's character)
  const c = CHARS[id];
  const frame = moving ? Math.floor(phase) % c.frames : 0; // cycle while walking, stand on 0
  const img = cache.get(`${id}/${dir}_${frame}`);
  if (!img || !img.complete || !img.width) return false;

  const w = img.width * c.scale;
  const h = img.height * c.scale;

  // ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.3, w * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.imageSmoothingEnabled = false; // crisp pixels
  ctx.drawImage(img, x - w / 2, y - h, w, h);
  ctx.restore();
  return true;
}
