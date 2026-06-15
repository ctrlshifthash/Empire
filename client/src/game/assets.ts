// ─────────────────────────────────────────────────────────────────────────────
// Sprite / tile-map integration point.
//
// The game renders with clean procedural art out of the box. When you have a
// sprite sheet + tile map, drop the image into client/public/ and fill in the
// mappings below, then call configureAssets() once at startup (see the comment
// at the bottom). The renderer automatically uses sprites when available and
// falls back to procedural drawing otherwise.
// ─────────────────────────────────────────────────────────────────────────────
import type { BuildingType, UnitType } from "@shared/types";

export class SpriteSheet {
  image: HTMLImageElement | null = null;
  ready = false;
  constructor(
    public url: string,
    public tileSize: number,
    public columns: number,
  ) {}

  load(): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this.ready = true;
        resolve();
      };
      img.onerror = () => resolve(); // fail soft -> procedural fallback
      img.src = this.url;
    });
  }

  // Draw tile `index` (row-major in the sheet) into the destination rect.
  draw(ctx: CanvasRenderingContext2D, index: number, dx: number, dy: number, dw: number, dh: number) {
    if (!this.image || !this.ready) return false;
    const sx = (index % this.columns) * this.tileSize;
    const sy = Math.floor(index / this.columns) * this.tileSize;
    ctx.drawImage(this.image, sx, sy, this.tileSize, this.tileSize, dx, dy, dw, dh);
    return true;
  }
}

export interface GameAssets {
  terrain: SpriteSheet | null;
  buildings: SpriteSheet | null;
  units: SpriteSheet | null;
  // terrain tile index by terrain kind
  terrainIndex: Record<string, number>;
  // building sprite index by building type
  buildingIndex: Partial<Record<BuildingType, number>>;
  // unit sprite index by unit type
  unitIndex: Partial<Record<UnitType, number>>;
}

export const gameAssets: GameAssets = {
  terrain: null,
  buildings: null,
  units: null,
  terrainIndex: { grass: 0, forest: 1, hills: 2, water: 3, sand: 4 },
  buildingIndex: {},
  unitIndex: {},
};

export interface AssetConfig {
  terrain?: { url: string; tileSize: number; columns: number; index?: Record<string, number> };
  buildings?: { url: string; tileSize: number; columns: number; index?: Partial<Record<BuildingType, number>> };
  units?: { url: string; tileSize: number; columns: number; index?: Partial<Record<UnitType, number>> };
}

export async function configureAssets(cfg: AssetConfig): Promise<void> {
  const loads: Promise<void>[] = [];
  if (cfg.terrain) {
    gameAssets.terrain = new SpriteSheet(cfg.terrain.url, cfg.terrain.tileSize, cfg.terrain.columns);
    if (cfg.terrain.index) gameAssets.terrainIndex = cfg.terrain.index;
    loads.push(gameAssets.terrain.load());
  }
  if (cfg.buildings) {
    gameAssets.buildings = new SpriteSheet(cfg.buildings.url, cfg.buildings.tileSize, cfg.buildings.columns);
    if (cfg.buildings.index) gameAssets.buildingIndex = cfg.buildings.index;
    loads.push(gameAssets.buildings.load());
  }
  if (cfg.units) {
    gameAssets.units = new SpriteSheet(cfg.units.url, cfg.units.tileSize, cfg.units.columns);
    if (cfg.units.index) gameAssets.unitIndex = cfg.units.index;
    loads.push(gameAssets.units.load());
  }
  await Promise.all(loads);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE — once you have art, call this from client/src/pages/Play.tsx on mount:
//
//   import { configureAssets } from "../game/assets";
//   configureAssets({
//     terrain:   { url: "/tiles.png",     tileSize: 64, columns: 8,
//                  index: { grass: 0, forest: 1, hills: 2, water: 3, sand: 4 } },
//     buildings: { url: "/buildings.png", tileSize: 64, columns: 8,
//                  index: { town_center: 0, house: 1, lumber_camp: 2, farm: 3,
//                           gold_mine: 4, quarry: 5, barracks: 6, archery_range: 7,
//                           stable: 8, wall: 9, market: 10 } },
//   });
// ─────────────────────────────────────────────────────────────────────────────
