// ─────────────────────────────────────────────────────────────────────────────
// Loads the real isometric tileset (128x200 px tiles) from /public/tiles and
// exposes the loaded images to the renderer. Everything fails soft: until the
// images load (or if they 404) the renderer falls back to procedural drawing.
// ─────────────────────────────────────────────────────────────────────────────

// Each source tile image is 128 wide x 200 tall. The flat isometric diamond
// (the tile "footprint") is 128 wide x 64 tall and sits near the bottom of the
// canvas; tall objects (walls/towers) rise into the upper transparent area.
export const TILE_IMG_W = 128;
export const TILE_IMG_H = 200;
// where the centre of the diamond footprint sits inside the 200px-tall image
// (tuned so tiles line up edge-to-edge). y measured from the top of the image.
export const DIAMOND_CY = 150;

function load(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

function loadList(prefix: string, n: number): HTMLImageElement[] {
  // 1-indexed files (grass_path_1.png ...)
  const arr: HTMLImageElement[] = [];
  for (let i = 1; i <= n; i++) arr.push(load(`${prefix}${i}.png`));
  return arr;
}

export const TILES = {
  ready: false,
  grassBase: [load("/tiles/grass_base_1.png"), load("/tiles/grass_base_2.png"), load("/tiles/grass_base_3.png")], // plain grass (made from the pack)
  grass: loadList("/tiles/grass/grass_path_", 16), // grass + cobblestone paths
  wall: loadList("/tiles/wall/wall_", 16), // stone walls & towers
  plot: loadList("/tiles/plot/weat_", 16), // wooden fenced building plots
  castle: load("/tiles/castle.png"), // 600x600 keep
  windmill: load("/tiles/windmill.png"), // 896x200 sheet (7 frames of 128)
  flag: load("/tiles/flag.png"), // 1792x200 sheet (14 frames of 128)
};

// mark ready once the core tiles have loaded
let pending = 0;
const all: HTMLImageElement[] = [
  ...TILES.grassBase,
  ...TILES.grass,
  ...TILES.wall,
  ...TILES.plot,
  TILES.castle,
  TILES.windmill,
  TILES.flag,
];
pending = all.length;
for (const img of all) {
  const done = () => {
    pending--;
    if (pending <= 0) TILES.ready = true;
  };
  if (img.complete && img.naturalWidth > 0) done();
  else {
    img.onload = done;
    img.onerror = done; // fail soft
  }
}

export function isReady(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth > 0;
}

// windmill / flag animation frame count (128px wide frames)
export const WINDMILL_FRAMES = 7;
export const FLAG_FRAMES = 14;

// Draw a full 128x200 tile image anchored so its diamond footprint centre sits
// at the tile's screen position (sx, sy). `scale` lets big sprites (castle) span
// more than one tile.
export function drawTile(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx: number,
  sy: number,
  scale = 1,
  yOffset = 0,
) {
  if (!isReady(img)) return false;
  const w = TILE_IMG_W * scale;
  const h = TILE_IMG_H * scale;
  ctx.drawImage(img, sx - w / 2, sy - DIAMOND_CY * scale + yOffset, w, h);
  return true;
}

// Draw one 128-wide frame from a horizontal sprite sheet, anchored like a tile.
export function drawTileFrame(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  frame: number,
  frameCount: number,
  sx: number,
  sy: number,
  scale = 1,
) {
  if (!isReady(sheet)) return false;
  const fw = sheet.naturalWidth / frameCount;
  const fh = sheet.naturalHeight;
  const f = ((frame % frameCount) + frameCount) % frameCount;
  ctx.drawImage(
    sheet,
    f * fw,
    0,
    fw,
    fh,
    sx - (TILE_IMG_W * scale) / 2,
    sy - DIAMOND_CY * scale,
    TILE_IMG_W * scale,
    (fh / fw) * TILE_IMG_W * scale,
  );
  return true;
}
