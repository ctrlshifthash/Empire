# ⚔ Empires Eternal

A persistent, **24/7 Age of Empires–style strategy game** with an award‑winning landing page.
Found your own empire on a shared world map, gather resources, advance through four ages,
raise armies and raid rival players **and** AI empires — in a world that keeps running even
while you're offline.

> Built as a TypeScript monorepo: a Node + Socket.IO game server with a live simulation tick,
> and a Vite + React + Tailwind client with a canvas‑rendered world.

---

## ✨ What's inside

- **Award‑winning landing page** — animated ember hero, live world stats, feature grid, the four
  ages, a live leaderboard preview, and clear calls to action.
- **Easy navigation** — a sticky, responsive navbar links every page (Home · Play · Leaderboard ·
  Guide) plus account controls, with a mobile menu.
- **A living world** — the server simulates every empire on a tick loop. Resources accrue, buildings
  finish, armies march and battles resolve **whether you're watching or not**. State is persisted to
  disk, so the world survives restarts.
- **Full game loop**
  - Gather **wood, food, gold, stone** from buildings that produce over time.
  - **Build & upgrade** 11 building types (town center, houses, lumber camp, farm, mines, barracks,
    archery range, stable, walls, market…).
  - **Advance four ages** — Dark → Feudal → Castle → Imperial, each unlocking new buildings & units.
  - **Train & command** villagers, spearmen, archers and knights.
  - **Raid** other empires for plunder; **defend** with troops and walls. Combat is a deterministic
    power‑ratio model with a home/wall advantage.
  - **Quests & coins** — complete quests for coins + resources; spend coins to *rush* construction,
    training and research.
- **Players vs. bots** — AI empires grow, advance ages, build armies and launch their own raids, so
  the world is always full of rivals.
- **Sprite‑ready** — ships with clean procedural art; drop in your tile map + sprite sheet later
  (see [Adding your art](#-adding-your-tile-map--sprite-sheet)).

---

## 🚀 Quick start

Requires **Node.js 18+** (tested on Node 24).

```bash
# from the project root
npm install        # installs the server + client workspaces
npm run dev        # starts the game server AND the client (hot reload)
```

Then open **http://localhost:5173** and click **Play Free** to found your empire.

> The server runs on **http://localhost:4000** and the Vite client on **http://localhost:5173**.
> In development the client talks to the server cross‑origin automatically.

### One‑port production preview

```bash
npm run build      # builds the client to client/dist
npm start          # server serves the built client at http://localhost:4000
```

(`npm run preview` does both in one step.)

---

## 🎮 How to play

There are two ways to play, and they share the same empire:

### 🌍 Adventure mode (the **Adventure** tab — you, in the world)

You control a **hero** inside a live, walkable isometric world:

| Action | How |
| --- | --- |
| **Move your hero** | Left‑click the ground, or use **WASD** |
| **Look around (camera)** | Move the mouse to the **screen edges**, use **arrow keys**, or **middle‑drag**. Press **Space** (or ⌖) to re‑center on your hero |
| **Zoom** | **Mouse wheel** (or the **+ / −** buttons) |
| **Fullscreen** | The **⛶** button (top of the zoom controls) |
| **Harvest** | Left‑click a 🌲 tree, 🪨 rock, 💎 gold vein or 🌿 bush; your hero walks over and gathers it |
| **Build in the world** | Pick a building from the **Build** bar, then click a spot — the camera flies to your new building as it rises |
| **Fight** | Left‑click an enemy (bandits 🗡️, wolves 🐺); your trained army assists, and you get loot |
| **Command your army (RTS)** | **Drag a box** to select your units, then **right‑click** to move them or attack an enemy |
| **Cancel placing / deselect** | Right‑click or press **Esc** |

> 🆕 **First‑time tutorial:** a guided, step‑by‑step tour pops up the first time you enter the game
> (replay it any time via the **❔ Tutorial** button). It walks you through moving, harvesting, building,
> leveling up and invading.

Your hero respawns at the town if defeated, and resource nodes regrow over time.

**Level up your hero (the 🦸 Hero tab):** everything you do earns XP across five skills —
**Combat** (slaying enemies & beating rival empires), **Woodcutting**, **Mining**, **Foraging**
and **Construction**. Higher skill levels gather more per swing and make your hero hit harder.
You also carry four **tools** — Sword, Axe, Pickaxe, Sickle — which you upgrade through five tiers
(Crude → Bronze → Iron → Steel → Mythril) with resources and coins for bigger yields and more
damage. The Hero tab shows every skill's XP bar, your tools, and your current gather rates.

### 🏰 Command mode (the dashboard tabs)

Prefer to manage from above? The dashboard is still here:

1. **Empire** — build & upgrade from a menu, advance through the four ages.
2. **Map** — the wider world of rival empires; **zoom (wheel) and drag to pan**, click a rival and launch a **raid**. Winning plunders resources, earns Combat XP + coins, and a **decisive victory razes one of their buildings** — cutting their power so you climb the leaderboard. Every battle is saved as a report you can **watch as an animated replay** in the **📖 Chronicle** tab.
3. **Military** — train villagers, spearmen, archers and knights.
4. **Quests** — claim coin & resource rewards; spend coins to *rush* anything building.

Everything is shared: a building you place in Adventure mode shows up in the dashboard, and an army
you train in the dashboard marches beside you in the world. The full handbook (every building, unit,
age and combat rule) is on the **Guide** page in‑app.

---

## 🗂 Project structure

```
Empires Eternal/
├─ package.json            # workspaces + root scripts (dev / build / start)
├─ shared/                 # types + game data shared by client and server
│  ├─ types.ts             # all game model types + socket payloads
│  ├─ gamedata.ts          # buildings, units, ages, quests, balance formulas
│  ├─ progression.ts       # hero skills, tools, XP curve, yield/damage formulas
│  └─ combat.ts            # deterministic battle resolution
├─ server/                 # Node + Express + Socket.IO game server
│  └─ src/
│     ├─ index.ts          # bootstrap, REST API, sockets, world tick + AI timers
│     ├─ engine.ts         # the simulation: production, build/train, ages, raids, quests
│     ├─ ai.ts             # bot behaviour
│     ├─ world.ts          # world gen + empire creation
│     ├─ auth.ts           # register / login (scrypt, no native deps)
│     └─ store.ts          # JSON persistence
└─ client/                 # Vite + React + Tailwind app
   └─ src/
      ├─ pages/            # Landing, AuthPage, Play, Leaderboard, Guide
      ├─ components/       # Navbar, Footer, Toaster, landing sections
      ├─ world/            # the live Adventure world: engine.ts (real-time sim),
      │                    #   draw.ts (isometric renderer), iso.ts (projection)
      ├─ game/             # LiveWorld + dashboard views + canvas HUD
      └─ lib/              # api client, socket store (zustand), helpers
```

There are **no native dependencies**, so it runs cleanly on Windows/macOS/Linux. The persistent
world is stored in `server/data/state.json` (created on first run, git‑ignored).

---

## 🎨 Adding your tile map & sprite sheet

The game renders with procedural art out of the box and is built to accept real art with no code
changes elsewhere.

1. Drop your images into `client/public/` (e.g. `tiles.png`, `buildings.png`).
2. In `client/src/pages/Play.tsx`, call `configureAssets(...)` once on mount, mapping each tile /
   building to its index in the sheet. A ready‑to‑edit example lives at the bottom of
   `client/src/game/assets.ts`:

```ts
import { configureAssets } from "../game/assets";

configureAssets({
  terrain:   { url: "/tiles.png",     tileSize: 64, columns: 8,
               index: { grass: 0, forest: 1, hills: 2, water: 3, sand: 4 } },
  buildings: { url: "/buildings.png", tileSize: 64, columns: 8,
               index: { town_center: 0, house: 1, lumber_camp: 2, farm: 3,
                        gold_mine: 4, quarry: 5, barracks: 6, archery_range: 7,
                        stable: 8, wall: 9, market: 10 } },
});
```

The renderer automatically uses sprites when they're loaded and falls back to procedural drawing
otherwise — so the game always looks good, even mid‑integration.

---

## 🧪 Smoke test

Two scripted checks are included:

```bash
# 1) deterministic engine test — drives a full raid to resolution (combat,
#    plunder, return march) plus age advancement. No server needed:
node --import tsx server/sim-test.mjs

# 2) live end-to-end loop (register → build → rush → quest → train → raid)
#    against a running server (start it first with npm start or npm run dev):
node test-flow.mjs
```

---

## 🛠 Tech

- **Server:** Node, Express, Socket.IO, TypeScript (run with `tsx`), JSON persistence.
- **Client:** Vite, React 18, TypeScript, Tailwind CSS, Framer Motion, Zustand, React Router.
- **Rendering:** HTML5 Canvas (procedural, sprite‑ready).

Enjoy your reign. 👑
