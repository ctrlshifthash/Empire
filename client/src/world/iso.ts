// Isometric projection helpers. World coordinates are in continuous tile units
// (x to the right-down, y to the left-down on screen).
export const TILE_W = 64; // diamond width in px
export const TILE_H = 32; // diamond height in px

export function worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
  return { sx: (wx - wy) * (TILE_W / 2), sy: (wx + wy) * (TILE_H / 2) };
}

export function screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
  return { wx: sx / TILE_W + sy / TILE_H, wy: sy / TILE_H - sx / TILE_W };
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
