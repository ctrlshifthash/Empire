// ─────────────────────────────────────────────────────────────────────────────
// Real-time local world simulation. The player controls a hero who walks the
// world, harvests resource nodes, fights enemies and is followed by their army.
// Buildings come from the authoritative server snapshot; harvesting/loot is
// reported back to the server via callbacks. Runs at the client frame rate.
// ─────────────────────────────────────────────────────────────────────────────
import type { Building, ResourceKind, UnitType } from "@shared/types";
import { LOCAL_WORLD } from "@shared/types";
import { dist, screenToWorld } from "./iso";

export type NodeKind = "tree" | "rock" | "gold" | "bush";
export const NODE_RESOURCE: Record<NodeKind, ResourceKind> = {
  tree: "wood",
  rock: "stone",
  gold: "gold",
  bush: "food",
};

export interface ResNode {
  id: number;
  kind: NodeKind;
  x: number;
  y: number;
  amount: number;
  max: number;
  respawnAt: number; // ms, 0 = available
}

export interface Hero {
  x: number;
  y: number;
  tx: number;
  ty: number;
  hp: number;
  maxHp: number;
  speed: number;
  state: "idle" | "move" | "harvest" | "fight";
  facing: number; // -1 left, 1 right
  harvestId: number | null;
  harvestT: number;
  attackId: number | null;
  swing: number; // attack animation timer
  deadUntil: number;
}

export interface Unit {
  id: number;
  type: UnitType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  atk: number;
  attackId: number | null;
  order: { x: number; y: number } | null; // manual move order (right-click)
  swing: number;
  downUntil: number; // knocked out until ms
  ox: number; // formation offset
  oy: number;
}

export interface Enemy {
  id: number;
  kind: "bandit" | "wolf" | "brigand";
  x: number;
  y: number;
  hx: number; // home (camp)
  hy: number;
  hp: number;
  maxHp: number;
  speed: number;
  atk: number;
  targetKind: "hero" | "unit" | null;
  targetId: number | null;
  swing: number;
  respawnAt: number;
  loot: Partial<Record<ResourceKind, number>>;
  icon: string;
}

export interface BuildingView {
  id: string;
  type: Building["type"];
  level: number;
  x: number;
  y: number;
  constructing: boolean;
  completesAt: number | null;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
}

// deterministic PRNG so the world is stable across reloads
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UNIT_COMBAT: Record<UnitType, { atk: number; hp: number; speed: number }> = {
  villager: { atk: 4, hp: 30, speed: 3.2 },
  spearman: { atk: 11, hp: 60, speed: 3.0 },
  archer: { atk: 16, hp: 42, speed: 3.2 },
  knight: { atk: 26, hp: 120, speed: 3.6 },
};

export class World {
  W = LOCAL_WORLD.width;
  H = LOCAL_WORLD.height;
  hero: Hero;
  units: Unit[] = [];
  enemies: Enemy[] = [];
  nodes: ResNode[] = [];
  buildings: BuildingView[] = [];
  floats: FloatText[] = [];
  cam = { x: 0, y: 0 };
  zoom = 0.62; // tiles are 128px; start zoomed out so you can see the town
  camFree = false; // true when the player has panned the camera away from the hero
  selected: Set<number> = new Set(); // selected unit ids
  // the player's walled town layout (built once, deterministic)
  town!: {
    cx: number;
    cy: number;
    R: number;
    walls: Map<string, "corner" | "h" | "v">;
    paths: Set<string>;
    gate: { x: number; y: number };
  };
  private focus: { x: number; y: number } | null = null;
  private focusTime = 0;

  private rng: () => number;
  private nextId = 1;
  private armyCounts: Record<UnitType, number> = { villager: 0, spearman: 0, archer: 0, knight: 0 };

  // hero combat / gathering power, driven by skills + tools (set from snapshot)
  heroStats: { dmg: number; yield: Record<ResourceKind, number> } = {
    dmg: 12,
    yield: { wood: 4, food: 4, stone: 4, gold: 4 },
  };

  // callbacks to the outside world (server)
  onGather: (r: ResourceKind) => void = () => {};
  onSlay: (kind: string) => void = () => {};
  onToast: (text: string) => void = () => {};

  constructor(seed: number) {
    this.rng = mulberry32(seed || 1);
    const cx = LOCAL_WORLD.centerX;
    const cy = LOCAL_WORLD.centerY;
    this.hero = {
      x: cx,
      y: cy + 2.2,
      tx: cx,
      ty: cy + 2.2,
      hp: 100,
      maxHp: 100,
      speed: 4.2,
      state: "idle",
      facing: 1,
      harvestId: null,
      harvestT: 0,
      attackId: null,
      swing: 0,
      deadUntil: 0,
    };
    this.generate();
    this.generateTown();
  }

  private id() {
    return this.nextId++;
  }

  // A walled compound around the town centre: stone perimeter with corner
  // towers, a gate on the south edge, and a road network inside.
  private generateTown() {
    const cx = LOCAL_WORLD.centerX;
    const cy = LOCAL_WORLD.centerY;
    const R = 8;
    const walls = new Map<string, "corner" | "h" | "v">();
    const gate = { x: cx, y: cy + R };
    for (let x = cx - R; x <= cx + R; x++) {
      for (let y = cy - R; y <= cy + R; y++) {
        const edge = x === cx - R || x === cx + R || y === cy - R || y === cy + R;
        if (!edge) continue;
        if (x === gate.x && y === gate.y) continue; // leave the gate open
        const corner = (x === cx - R || x === cx + R) && (y === cy - R || y === cy + R);
        if (corner) walls.set(`${x},${y}`, "corner");
        else if (y === cy - R || y === cy + R) walls.set(`${x},${y}`, "h");
        else walls.set(`${x},${y}`, "v");
      }
    }
    const paths = new Set<string>();
    for (let y = cy; y <= cy + R; y++) paths.add(`${cx},${y}`); // gate -> centre
    for (let x = cx - R + 1; x <= cx + R - 1; x++) paths.add(`${x},${cy}`); // cross road
    this.town = { cx, cy, R, walls, paths, gate };
  }

  private generate() {
    const cx = LOCAL_WORLD.centerX;
    const cy = LOCAL_WORLD.centerY;
    const rng = this.rng;
    const farFromCenter = (x: number, y: number, d: number) => dist(x, y, cx, cy) > d;

    // resource node clusters
    const clusters: Array<{ kind: NodeKind; count: number; spread: number }> = [
      { kind: "tree", count: 7, spread: 2.4 },
      { kind: "tree", count: 6, spread: 2.2 },
      { kind: "rock", count: 5, spread: 2.0 },
      { kind: "gold", count: 3, spread: 1.6 },
      { kind: "bush", count: 6, spread: 2.6 },
      { kind: "tree", count: 6, spread: 2.4 },
      { kind: "rock", count: 4, spread: 1.8 },
      { kind: "bush", count: 5, spread: 2.4 },
    ];
    for (const c of clusters) {
      // cluster center somewhere away from the town clearing
      let ccx = 0;
      let ccy = 0;
      for (let tries = 0; tries < 30; tries++) {
        ccx = 5 + rng() * (this.W - 10);
        ccy = 5 + rng() * (this.H - 10);
        if (farFromCenter(ccx, ccy, 5.5)) break;
      }
      for (let i = 0; i < c.count; i++) {
        const x = ccx + (rng() - 0.5) * c.spread * 2;
        const y = ccy + (rng() - 0.5) * c.spread * 2;
        if (x < 2 || y < 2 || x > this.W - 2 || y > this.H - 2) continue;
        if (!farFromCenter(x, y, 4.5)) continue;
        // amount = number of "strikes" before the node is depleted
        const max = c.kind === "gold" ? 4 : c.kind === "rock" ? 7 : 8;
        this.nodes.push({ id: this.id(), kind: c.kind, x, y, amount: max, max, respawnAt: 0 });
      }
    }

    // a bandit camp
    let bx = cx;
    let by = cy;
    for (let tries = 0; tries < 40; tries++) {
      const ang = rng() * Math.PI * 2;
      const rad = 11 + rng() * 5;
      bx = cx + Math.cos(ang) * rad;
      by = cy + Math.sin(ang) * rad;
      if (bx > 4 && by > 4 && bx < this.W - 4 && by < this.H - 4) break;
    }
    for (let i = 0; i < 4; i++) {
      this.spawnEnemy(bx + (rng() - 0.5) * 2.5, by + (rng() - 0.5) * 2.5);
    }
    // a couple of lone wolves roaming
    for (let i = 0; i < 3; i++) {
      const ang = rng() * Math.PI * 2;
      const rad = 7 + rng() * 6;
      this.spawnEnemy(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, "wolf");
    }

    this.cam.x = this.hero.x;
    this.cam.y = this.hero.y;
  }

  private spawnEnemy(x: number, y: number, kind: Enemy["kind"] = "bandit") {
    x = Math.max(2, Math.min(this.W - 2, x));
    y = Math.max(2, Math.min(this.H - 2, y));
    const stats =
      kind === "wolf"
        ? { hp: 40, atk: 6, speed: 3.6, icon: "🐺", loot: { food: 8 } as Partial<Record<ResourceKind, number>> }
        : kind === "brigand"
          ? { hp: 90, atk: 12, speed: 2.8, icon: "🦹", loot: { gold: 20, wood: 10 } }
          : { hp: 60, atk: 8, speed: 2.6, icon: "🗡️", loot: { gold: 10, wood: 12, food: 8 } };
    this.enemies.push({
      id: this.id(),
      kind,
      x,
      y,
      hx: x,
      hy: y,
      hp: stats.hp,
      maxHp: stats.hp,
      speed: stats.speed,
      atk: stats.atk,
      targetKind: null,
      targetId: null,
      swing: 0,
      respawnAt: 0,
      loot: stats.loot,
      icon: stats.icon,
    });
  }

  // ── external sync ─────────────────────────────────────────────────────────

  setBuildings(buildings: Building[]) {
    this.buildings = buildings
      .filter((b) => b.wx != null && b.wy != null)
      .map((b) => ({
        id: b.id,
        type: b.type,
        level: b.level,
        x: b.wx as number,
        y: b.wy as number,
        constructing: b.completesAt != null,
        completesAt: b.completesAt ?? null,
      }));
  }

  setHeroStats(stats: { dmg: number; maxHp: number; yield: Record<ResourceKind, number> }) {
    this.heroStats.dmg = stats.dmg;
    this.heroStats.yield = stats.yield;
    const wasFull = this.hero.hp >= this.hero.maxHp;
    this.hero.maxHp = stats.maxHp;
    if (wasFull) this.hero.hp = stats.maxHp;
    else this.hero.hp = Math.min(this.hero.hp, stats.maxHp);
  }

  setArmy(counts: Record<UnitType, number>) {
    this.armyCounts = { ...counts };
    // cap the number of avatars so big armies stay performant/readable
    const CAP = 24;
    const order: UnitType[] = ["knight", "spearman", "archer", "villager"];
    const desired: UnitType[] = [];
    let total = 0;
    for (const t of order) {
      const n = Math.min(counts[t] || 0, 12);
      for (let i = 0; i < n && total < CAP; i++, total++) desired.push(t);
    }
    // reconcile existing avatars to desired list by type
    const have: Record<UnitType, Unit[]> = { villager: [], spearman: [], archer: [], knight: [] };
    for (const u of this.units) have[u.type].push(u);
    const want: Record<UnitType, number> = { villager: 0, spearman: 0, archer: 0, knight: 0 };
    for (const t of desired) want[t]++;

    const next: Unit[] = [];
    for (const t of order) {
      const list = have[t];
      for (let i = 0; i < want[t]; i++) {
        if (list[i]) next.push(list[i]);
        else next.push(this.makeUnit(t));
      }
    }
    // assign formation offsets in a ring behind the hero
    next.forEach((u, i) => {
      const ring = Math.floor(i / 8) + 1;
      const a = (i % 8) * (Math.PI / 4) + ring * 0.6;
      u.ox = Math.cos(a) * (0.9 + ring * 0.7);
      u.oy = Math.sin(a) * (0.9 + ring * 0.7);
    });
    this.units = next;
  }

  private makeUnit(type: UnitType): Unit {
    const s = UNIT_COMBAT[type];
    return {
      id: this.id(),
      type,
      x: this.hero.x + (this.rng() - 0.5) * 2,
      y: this.hero.y + (this.rng() - 0.5) * 2,
      hp: s.hp,
      maxHp: s.hp,
      speed: s.speed,
      atk: s.atk,
      attackId: null,
      order: null,
      swing: 0,
      downUntil: 0,
      ox: 0,
      oy: 0,
    };
  }

  // ── selection & commands (RTS-style) ────────────────────────────────────────

  selectUnits(ids: number[]) {
    this.selected = new Set(ids);
  }
  clearSelection() {
    this.selected.clear();
  }
  focusOn(x: number, y: number) {
    this.focus = { x, y };
    this.focusTime = 2.6;
  }

  // pan the camera by a screen-space delta (px), used by edge-scroll / arrows /
  // drag. Detaches the camera from the hero until recentered.
  panByScreen(dsx: number, dsy: number) {
    const wd = screenToWorld(dsx / this.zoom, dsy / this.zoom);
    this.cam.x = Math.max(0, Math.min(this.W, this.cam.x + wd.wx));
    this.cam.y = Math.max(0, Math.min(this.H, this.cam.y + wd.wy));
    this.camFree = true;
    this.focus = null;
  }

  recenterCam() {
    this.camFree = false;
  }

  commandMoveSelected(x: number, y: number) {
    const ids = [...this.selected];
    ids.forEach((id, i) => {
      const u = this.units.find((z) => z.id === id);
      if (!u) return;
      const ring = Math.floor(i / 8);
      const a = (i % 8) * (Math.PI / 4) + ring * 0.5;
      u.order = { x: x + Math.cos(a) * (ring * 0.8), y: y + Math.sin(a) * (ring * 0.8) };
      u.attackId = null;
    });
  }
  commandAttackSelected(enemyId: number) {
    for (const id of this.selected) {
      const u = this.units.find((z) => z.id === id);
      if (!u) continue;
      u.attackId = enemyId;
      u.order = null;
    }
  }

  // ── interaction ───────────────────────────────────────────────────────────

  nodeAt(wx: number, wy: number, r = 0.9): ResNode | null {
    let best: ResNode | null = null;
    let bd = r;
    for (const n of this.nodes) {
      if (n.respawnAt > 0) continue;
      const d = dist(n.x, n.y, wx, wy);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  enemyAt(wx: number, wy: number, r = 0.9): Enemy | null {
    let best: Enemy | null = null;
    let bd = r;
    for (const e of this.enemies) {
      if (e.respawnAt > 0) continue;
      const d = dist(e.x, e.y, wx, wy);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  // primary left-click handler in world coords
  interact(wx: number, wy: number) {
    if (this.hero.deadUntil > 0) return;
    const enemy = this.enemyAt(wx, wy);
    if (enemy) {
      this.hero.attackId = enemy.id;
      this.hero.harvestId = null;
      this.hero.state = "move";
      // rally the army onto the target
      for (const u of this.units) u.attackId = enemy.id;
      return;
    }
    const node = this.nodeAt(wx, wy);
    if (node) {
      this.hero.harvestId = node.id;
      this.hero.attackId = null;
      this.hero.harvestT = 0;
      this.hero.state = "move";
      return;
    }
    // otherwise walk there
    this.moveTo(wx, wy);
  }

  moveTo(wx: number, wy: number) {
    if (this.hero.deadUntil > 0) return;
    this.hero.tx = Math.max(1, Math.min(this.W - 1, wx));
    this.hero.ty = Math.max(1, Math.min(this.H - 1, wy));
    this.hero.harvestId = null;
    this.hero.attackId = null;
    this.hero.state = "move";
    for (const u of this.units) u.attackId = null;
  }

  // continuous movement from keyboard (dx,dy already normalised-ish)
  nudge(dx: number, dy: number, dt: number) {
    if (this.hero.deadUntil > 0 || (dx === 0 && dy === 0)) return;
    const h = this.hero;
    h.harvestId = null;
    h.attackId = null;
    const len = Math.hypot(dx, dy) || 1;
    h.x = Math.max(1, Math.min(this.W - 1, h.x + (dx / len) * h.speed * dt));
    h.y = Math.max(1, Math.min(this.H - 1, h.y + (dy / len) * h.speed * dt));
    h.tx = h.x;
    h.ty = h.y;
    if (dx !== 0) h.facing = dx > 0 ? 1 : -1;
    h.state = "move";
  }

  private float(x: number, y: number, text: string, color: string, now: number) {
    this.floats.push({ x, y, text, color, born: now });
    if (this.floats.length > 40) this.floats.shift();
  }

  // ── per-frame update ──────────────────────────────────────────────────────

  update(dt: number, now: number) {
    dt = Math.min(dt, 0.05); // clamp big frame gaps
    this.updateHero(dt, now);
    this.updateUnits(dt, now);
    this.updateEnemies(dt, now);
    this.respawnNodes(now);
    this.floats = this.floats.filter((f) => now - f.born < 1100);

    // camera eases toward a temporary focus (e.g. a building you just placed),
    // otherwise it follows the hero.
    if (this.focus) {
      this.focusTime -= dt;
      if (this.focusTime <= 0) this.focus = null;
    }
    // follow the hero unless the camera has been panned free (then it stays put)
    const tgt = this.focus ?? (this.camFree ? this.cam : this.hero);
    this.cam.x += (tgt.x - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (tgt.y - this.cam.y) * Math.min(1, dt * 6);
  }

  private moveToward(
    e: { x: number; y: number },
    tx: number,
    ty: number,
    speed: number,
    dt: number,
    stop: number,
  ): boolean {
    const d = dist(e.x, e.y, tx, ty);
    if (d <= stop) return true;
    const step = Math.min(d - stop, speed * dt);
    e.x += ((tx - e.x) / d) * step;
    e.y += ((ty - e.y) / d) * step;
    return false;
  }

  private updateHero(dt: number, now: number) {
    const h = this.hero;
    if (h.deadUntil > 0) {
      if (now >= h.deadUntil) {
        h.deadUntil = 0;
        h.hp = h.maxHp;
        h.x = h.tx = LOCAL_WORLD.centerX;
        h.y = h.ty = LOCAL_WORLD.centerY + 2;
        h.state = "idle";
      }
      return;
    }
    if (h.swing > 0) h.swing -= dt;

    // attacking an enemy
    if (h.attackId != null) {
      const e = this.enemies.find((x) => x.id === h.attackId && x.respawnAt === 0);
      if (!e) {
        h.attackId = null;
        h.state = "idle";
      } else {
        h.facing = e.x >= h.x ? 1 : -1;
        const reached = this.moveToward(h, e.x, e.y, h.speed, dt, 0.85);
        if (reached) {
          h.state = "fight";
          if (h.swing <= 0) {
            e.hp -= this.heroStats.dmg;
            h.swing = 0.5;
            if (e.hp <= 0) this.killEnemy(e, now);
          }
        } else {
          h.state = "move";
        }
        return;
      }
    }

    // harvesting a node
    if (h.harvestId != null) {
      const n = this.nodes.find((x) => x.id === h.harvestId);
      if (!n || n.respawnAt > 0) {
        h.harvestId = null;
        h.state = "idle";
      } else {
        h.facing = n.x >= h.x ? 1 : -1;
        const reached = this.moveToward(h, n.x, n.y, h.speed, dt, 0.8);
        if (reached) {
          h.state = "harvest";
          h.harvestT += dt;
          if (h.harvestT >= 1.6) {
            h.harvestT = 0;
            const res = NODE_RESOURCE[n.kind];
            const gain = this.heroStats.yield[res] ?? 4;
            n.amount -= 1;
            this.onGather(res);
            this.float(n.x, n.y, `+${gain}`, "#7CFC8A", now);
            if (n.amount <= 0) {
              n.respawnAt = now + 22000;
              h.harvestId = null;
              h.state = "idle";
            }
          }
        } else {
          h.state = "move";
        }
        return;
      }
    }

    // plain movement to a target
    if (h.state === "move" || dist(h.x, h.y, h.tx, h.ty) > 0.05) {
      if (h.tx >= h.x) h.facing = 1;
      else h.facing = -1;
      const reached = this.moveToward(h, h.tx, h.ty, h.speed, dt, 0.02);
      if (reached) h.state = "idle";
    }
  }

  private updateUnits(dt: number, now: number) {
    const h = this.hero;
    for (const u of this.units) {
      if (u.downUntil > 0) {
        if (now >= u.downUntil) {
          u.downUntil = 0;
          u.hp = u.maxHp;
          u.x = h.x + u.ox;
          u.y = h.y + u.oy;
        }
        continue;
      }
      if (u.swing > 0) u.swing -= dt;
      if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + dt * 4); // slow regen out of combat

      // pick a target: explicit attack order first
      let target: Enemy | null = u.attackId != null
        ? this.enemies.find((e) => e.id === u.attackId && e.respawnAt === 0) ?? null
        : null;

      // manual move order (right-click): march there and ignore aggro en route
      if (!target && u.order) {
        const reached = this.moveToward(u, u.order.x, u.order.y, u.speed, dt, 0.18);
        if (reached) u.order = null;
        continue;
      }

      // otherwise auto-engage nearby enemies
      if (!target) {
        let bd = 4.5;
        for (const e of this.enemies) {
          if (e.respawnAt > 0) continue;
          const d = dist(e.x, e.y, u.x, u.y);
          if (d < bd) {
            bd = d;
            target = e;
          }
        }
      }

      if (target) {
        const reached = this.moveToward(u, target.x, target.y, u.speed, dt, 0.8);
        if (reached && u.swing <= 0) {
          target.hp -= u.atk;
          u.swing = 0.6;
          if (target.hp <= 0) this.killEnemy(target, now);
        }
      } else {
        // follow the hero in formation
        const fx = h.x + u.ox;
        const fy = h.y + u.oy;
        if (dist(u.x, u.y, fx, fy) > 0.4) this.moveToward(u, fx, fy, u.speed, dt, 0.1);
      }
    }
  }

  private updateEnemies(dt: number, now: number) {
    const h = this.hero;
    for (const e of this.enemies) {
      if (e.respawnAt > 0) {
        if (now >= e.respawnAt) {
          e.respawnAt = 0;
          e.hp = e.maxHp;
          e.x = e.hx;
          e.y = e.hy;
          e.targetId = null;
          e.targetKind = null;
        }
        continue;
      }
      if (e.swing > 0) e.swing -= dt;

      // acquire a target within aggro range
      const aggro = 5;
      let tx: number | null = null;
      let ty: number | null = null;
      let isHero = false;
      let bestD = aggro;
      if (h.deadUntil === 0) {
        const dh = dist(h.x, h.y, e.x, e.y);
        if (dh < bestD) {
          bestD = dh;
          tx = h.x;
          ty = h.y;
          isHero = true;
        }
      }
      let targetUnit: Unit | null = null;
      for (const u of this.units) {
        if (u.downUntil > 0) continue;
        const d = dist(u.x, u.y, e.x, e.y);
        if (d < bestD) {
          bestD = d;
          tx = u.x;
          ty = u.y;
          isHero = false;
          targetUnit = u;
        }
      }

      if (tx == null || ty == null) {
        // return home / idle
        if (dist(e.x, e.y, e.hx, e.hy) > 0.5) this.moveToward(e, e.hx, e.hy, e.speed * 0.7, dt, 0.1);
        continue;
      }

      const reached = this.moveToward(e, tx, ty, e.speed, dt, 0.85);
      if (reached && e.swing <= 0) {
        e.swing = 0.8;
        if (isHero) {
          h.hp -= e.atk;
          this.float(h.x, h.y, `-${e.atk}`, "#ff6b6b", now);
          if (h.hp <= 0) {
            h.hp = 0;
            h.deadUntil = now + 3500;
            h.attackId = null;
            h.harvestId = null;
            this.onToast("Your hero fell! Respawning at your town…");
          }
        } else if (targetUnit) {
          targetUnit.hp -= e.atk;
          if (targetUnit.hp <= 0) {
            targetUnit.hp = 0;
            targetUnit.downUntil = now + 5000;
          }
        }
      }
    }
  }

  private killEnemy(e: Enemy, now: number) {
    e.respawnAt = now + 18000;
    e.hp = 0;
    e.targetId = null;
    this.onSlay(e.kind); // combat XP
    // award loot (each resource via a gather call so the server credits it)
    const parts: string[] = [];
    for (const [r, amt] of Object.entries(e.loot)) {
      if (!amt) continue;
      this.onGather(r as ResourceKind);
      parts.push(`+${r}`);
    }
    this.float(e.x, e.y, parts.join(" ") || "slain", "#f4dd8f", now);
    // clear references
    if (this.hero.attackId === e.id) {
      this.hero.attackId = null;
      this.hero.state = "idle";
    }
    for (const u of this.units) if (u.attackId === e.id) u.attackId = null;
  }

  private respawnNodes(now: number) {
    for (const n of this.nodes) {
      if (n.respawnAt > 0 && now >= n.respawnAt) {
        n.respawnAt = 0;
        n.amount = n.max;
      }
    }
  }

  // minimap helpers
  get armyAlive(): number {
    return this.units.filter((u) => u.downUntil === 0).length;
  }
}
