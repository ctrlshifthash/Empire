// ─────────────────────────────────────────────────────────────────────────────
// Empires Eternal — server entry point.
// Express REST for auth + public stats, Socket.IO for the live game, and two
// timers that drive the persistent 24/7 world (engine tick + bot AI).
// ─────────────────────────────────────────────────────────────────────────────
import "dotenv/config"; // load server/.env (TOKEN_MINT, TREASURY_SECRET_KEY, …) before anything reads it
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";
import { Server as SocketServer } from "socket.io";

import type { Army } from "../../shared/combat.ts";
import { loadState, save, scheduleSave, state } from "./store.ts";
import { claim, payoutsLive, rewardStatus, rewardsConfigured } from "./rewards.ts";
import { spawnBot } from "./world.ts";
import { authUser, login, register, userByToken } from "./auth.ts";
import { onlineEmpires } from "./presence.ts";
import {
  actAdvanceAge,
  actAttack,
  actBuild,
  actClaimQuest,
  actGather,
  actRush,
  actBuyArmoury,
  actBuyTrait,
  actSlay,
  actTrain,
  actUpgrade,
  actUpgradeTool,
  refreshEmpire,
  snapshotFor,
  tick,
} from "./engine.ts";
import { stepBots } from "./ai.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;
const TARGET_BOTS = 16;

// ── world bootstrap ─────────────────────────────────────────────────────────

function ensureBots(target: number): void {
  let count = Object.values(state.empires).filter((e) => e.isBot).length;
  while (count < target) {
    spawnBot();
    count++;
  }
}

function bootstrap(): void {
  const loaded = loadState();
  if (!loaded) {
    state.world = { width: 40, height: 40, seed: 1337, tick: 0 };
    console.log("[boot] fresh world created");
  } else {
    console.log(`[boot] world loaded (tick ${state.world.tick}, ${Object.keys(state.empires).length} empires)`);
  }
  ensureBots(TARGET_BOTS);
  // bring everyone current after any downtime
  for (const e of Object.values(state.empires)) refreshEmpire(e);
  save();
}

bootstrap();

// ── express app ─────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

function bearer(req: express.Request): string | undefined {
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ")) return h.slice(7);
  return (req.query.token as string) || undefined;
}

app.post("/api/register", (req, res) => {
  const { username, password, empireName } = req.body ?? {};
  const result = register(username, password, empireName);
  res.status(result.ok ? 200 : 400).json(result);
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body ?? {};
  const result = login(username, password);
  res.status(result.ok ? 200 : 400).json(result);
});

app.get("/api/me", (req, res) => {
  const user = authUser(bearer(req));
  if (!user) return res.status(401).json({ ok: false, error: "Not authenticated." });
  res.json({ ok: true, user });
});

// Public live stats for the landing page.
app.get("/api/stats", (_req, res) => {
  const empires = Object.values(state.empires);
  const players = empires.filter((e) => !e.isBot);
  res.json({
    ok: true,
    worldTick: state.world.tick,
    totalEmpires: empires.length,
    players: players.length,
    bots: empires.length - players.length,
    online: onlineEmpires.size,
    activeMarches: state.marches.length,
    totalArmies: empires.reduce(
      (s, e) => s + e.army.villager + e.army.spearman + e.army.archer + e.army.knight,
      0,
    ),
  });
});

// Public leaderboard.
app.get("/api/leaderboard", (_req, res) => {
  const rows = Object.values(state.empires)
    .map((e) => ({
      name: e.name,
      banner: e.banner,
      isBot: e.isBot,
      age: e.age,
      power: e.power,
      raidsWon: e.raidsWon,
      online: e.isBot ? false : onlineEmpires.has(e.id),
    }))
    .sort((a, b) => b.power - a.power)
    .slice(0, 25);
  res.json({ ok: true, rows });
});

// ── Token-holder rewards (Solana) ───────────────────────────────────────────
app.get("/api/rewards/config", (_req, res) => res.json({ ok: true, configured: rewardsConfigured(), payouts: payoutsLive() }));
app.get("/api/rewards/:address", async (req, res) => {
  try {
    res.json({ ok: true, ...(await rewardStatus(req.params.address)) });
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});
app.post("/api/rewards/:address/claim", async (req, res) => {
  try {
    res.json(await claim(req.params.address));
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});

// Serve the built client in production (single-port deploy).
const clientDist = join(__dirname, "..", "..", "client", "dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(join(clientDist, "index.html")));
  console.log("[boot] serving client build from", clientDist);
}

// ── socket.io realtime ──────────────────────────────────────────────────────

const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"] },
});

function pushSnapshot(empireId: string): void {
  const snap = snapshotFor(empireId);
  if (!snap) return;
  io.to(`emp:${empireId}`).emit("snapshot", snap);
}

io.on("connection", (socket) => {
  let empireId: string | null = null;

  socket.on("hello", (tok: string) => {
    const user = userByToken(tok);
    if (!user) {
      // token no longer valid (e.g. world reset / expired) — tell the client to
      // re-authenticate instead of leaving it hanging.
      socket.emit("unauthorized");
      return;
    }
    empireId = user.empireId;
    socket.data.empireId = empireId;
    socket.join(`emp:${empireId}`);
    onlineEmpires.add(empireId);
    pushSnapshot(empireId);
  });

  function withEmpire(fn: (id: string) => void) {
    if (!empireId || !state.empires[empireId]) {
      socket.emit("error", "Not authenticated.");
      return;
    }
    fn(empireId);
  }

  function handle(result: { ok: boolean; error?: string }, successMsg?: string) {
    if (!empireId) return;
    if (!result.ok && result.error) {
      socket.emit("toast", { kind: "warn", text: result.error });
    } else if (successMsg) {
      socket.emit("toast", { kind: "success", text: successMsg });
    }
    scheduleSave();
    pushSnapshot(empireId);
  }

  socket.on("build", (p: { type: any; wx?: number; wy?: number }) =>
    withEmpire((id) => handle(actBuild(state.empires[id], p?.type, { wx: p?.wx, wy: p?.wy }))),
  );
  socket.on("upgrade", (p: { buildingId: string }) =>
    withEmpire((id) => handle(actUpgrade(state.empires[id], p?.buildingId))),
  );
  socket.on("train", (p: { building: any; unit: any; quantity: number }) =>
    withEmpire((id) => handle(actTrain(state.empires[id], p?.building, p?.unit, p?.quantity))),
  );
  socket.on("advanceAge", () => withEmpire((id) => handle(actAdvanceAge(state.empires[id]))));
  socket.on("attack", (p: { targetEmpireId: string; units: Army }) =>
    withEmpire((id) => handle(actAttack(state.empires[id], p?.targetEmpireId, p?.units || {}))),
  );
  socket.on("rush", (p: { kind: any; id?: string }) =>
    withEmpire((id) => handle(actRush(state.empires[id], p?.kind, p?.id))),
  );
  socket.on("claimQuest", (p: { questId: string }) =>
    withEmpire((id) => handle(actClaimQuest(state.empires[id], p?.questId), "Reward claimed!")),
  );
  socket.on("gather", (p: { resource: any }) =>
    withEmpire((id) => handle(actGather(state.empires[id], p?.resource))),
  );
  socket.on("upgradeTool", (p: { tool: any }) =>
    withEmpire((id) => handle(actUpgradeTool(state.empires[id], p?.tool), "Tool upgraded!")),
  );
  socket.on("slay", (p: { kind: any }) =>
    withEmpire((id) => handle(actSlay(state.empires[id], p?.kind))),
  );
  socket.on("buyArmoury", (p: { kind: any; unit?: any }) =>
    withEmpire((id) => handle(actBuyArmoury(state.empires[id], p?.kind, p?.unit), "Equipment forged!")),
  );
  socket.on("buyTrait", (p: { traitId: any }) =>
    withEmpire((id) => handle(actBuyTrait(state.empires[id], p?.traitId), "Trait learned!")),
  );

  socket.on("disconnect", () => {
    if (!empireId) return;
    // only mark offline if this empire has no other live sockets
    const room = io.sockets.adapter.rooms.get(`emp:${empireId}`);
    if (!room || room.size === 0) onlineEmpires.delete(empireId);
  });
});

// ── timers: the heartbeat of the persistent world ───────────────────────────

const TICK_MS = 2000;
const AI_MS = 8000;

setInterval(() => {
  try {
    tick();
    // push fresh snapshots to everyone connected
    for (const id of onlineEmpires) pushSnapshot(id);
  } catch (err) {
    console.error("[tick] error (world continues):", err);
  }
}, TICK_MS);

setInterval(() => {
  try {
    stepBots();
  } catch (err) {
    console.error("[ai] error (world continues):", err);
  }
}, AI_MS);

// periodic durable save as a safety net
setInterval(() => save(), 30000);

process.on("SIGINT", () => {
  console.log("\n[shutdown] saving world…");
  save();
  process.exit(0);
});

// Keep the persistent world alive through unexpected errors.
process.on("uncaughtException", (err) => console.error("[uncaught]", err));
process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));

httpServer.listen(PORT, () => {
  console.log(`\n  ⚔  Empires Eternal server running on http://localhost:${PORT}`);
  console.log(`     Tick: ${TICK_MS}ms · AI: ${AI_MS}ms · Bots: ${TARGET_BOTS}\n`);
});
