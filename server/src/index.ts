// ─────────────────────────────────────────────────────────────────────────────
// Realm Rumble — server entry point.
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
import { claim, payoutsLive, rewardStatus, rewardsConfigured, refreshHolderTier } from "./rewards.ts";
import { shopConfig, buyShopItem } from "./shop.ts";
import {
  createAlliance,
  joinAlliance,
  leaveAlliance,
  kickMember,
  disbandAlliance,
  postChat,
  allianceLeaderboard,
} from "./alliances.ts";
import { attackBoss, tickBoss } from "./boss.ts";
import { createPoll, castVote, pollResults, seedGovernance } from "./governance.ts";
import { submitBug, listBugs } from "./bugs.ts";
import { spawnBot } from "./world.ts";
import { authUser, demoLogin, login, privyLogin, register, userByToken } from "./auth.ts";
import { onlineEmpires } from "./presence.ts";
import { rankForPower } from "../../shared/gamedata.ts";
import {
  actAdvanceAge,
  actAttack,
  actBuild,
  actDemolish,
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
const TARGET_BOTS = 3;

// ── world bootstrap ─────────────────────────────────────────────────────────

function removeEmpire(empireId: string): void {
  delete state.empires[empireId];
  state.marches = state.marches.filter(
    (m) => m.fromEmpireId !== empireId && m.toEmpireId !== empireId,
  );
}

// Keep the AI population at exactly `target`: spawn up if short, or trim the
// excess (spread across the power range, strong → weak) if over — e.g. after
// lowering the target so the world is mostly real players.
function ensureBots(target: number): void {
  const bots = Object.values(state.empires).filter((e) => e.isBot);
  if (bots.length > target) {
    const sorted = [...bots].sort((a, b) => b.power - a.power);
    const keep = new Set<string>();
    for (let i = 0; i < target; i++) {
      const idx = target <= 1 ? 0 : Math.round((i * (sorted.length - 1)) / (target - 1));
      keep.add(sorted[idx].id);
    }
    for (const e of bots) if (!keep.has(e.id)) removeEmpire(e.id);
    scheduleSave(0);
  } else {
    for (let i = bots.length; i < target; i++) spawnBot();
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
  seedGovernance(); // ensure there's always a community poll to vote on
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

// Privy login (Solana wallet or email). Identity is the verified wallet address
// or email from Privy; the same identity always maps to the same empire.
app.post("/api/auth/privy", (req, res) => {
  const { identity, label } = req.body ?? {};
  const result = privyLogin(identity, label);
  res.status(result.ok ? 200 : 400).json(result);
});

// Demo mode — a throwaway empire with worthless in-game coins, no wallet needed.
app.post("/api/auth/demo", (req, res) => {
  const { label } = req.body ?? {};
  const result = demoLogin(label);
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

// Public alliance directory + leaderboard (chat stripped — that stays private).
app.get("/api/alliances", (_req, res) => {
  const alliances = allianceLeaderboard().map(({ chat: _chat, ...rest }) => rest);
  res.json({ ok: true, alliances });
});

// ── Token-weighted governance (community polls) ─────────────────────────────
app.get("/api/governance", (req, res) => {
  const address = typeof req.query.address === "string" ? req.query.address : undefined;
  res.json({ ok: true, polls: pollResults(address) });
});
app.post("/api/governance/vote", async (req, res) => {
  try {
    const { pollId, address, optionId } = (req.body ?? {}) as Record<string, unknown>;
    if (!pollId || !address || !optionId)
      return res.status(400).json({ ok: false, error: "Missing pollId, address or optionId." });
    res.json(await castVote(String(pollId), String(address), String(optionId)));
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});
// Admin-only: create a poll (guard with the ADMIN_KEY env var via x-admin-key).
app.post("/api/governance/poll", (req, res) => {
  const adminKey = (process.env.ADMIN_KEY || "").trim();
  if (!adminKey || req.headers["x-admin-key"] !== adminKey)
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  const { question, options, durationDays } = (req.body ?? {}) as Record<string, unknown>;
  const days = Number(durationDays) || 7;
  res.json(createPoll(String(question ?? ""), (options as string[]) ?? [], days * 24 * 60 * 60 * 1000));
});

// ── Bug reports ─────────────────────────────────────────────────────────────
app.post("/api/bugs", (req, res) => {
  const { kind, message, page, contact } = (req.body ?? {}) as Record<string, unknown>;
  res.json(
    submitBug({
      kind: typeof kind === "string" ? kind : "bug",
      message: typeof message === "string" ? message : "",
      page: typeof page === "string" ? page : undefined,
      contact: typeof contact === "string" ? contact : undefined,
      ua: req.headers["user-agent"],
    }),
  );
});
// Admin-only: read submitted bug reports (x-admin-key header).
app.get("/api/admin/bugs", (req, res) => {
  const adminKey = (process.env.ADMIN_KEY || "").trim();
  if (!adminKey || req.headers["x-admin-key"] !== adminKey)
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  res.json({ ok: true, bugs: listBugs() });
});

// ── Empires browser (public) ────────────────────────────────────────────────
// A summary of every empire on the map so anyone can scout players & bots.
app.get("/api/empires", (_req, res) => {
  const rows = Object.values(state.empires)
    .map((e) => ({
      id: e.id,
      name: e.name,
      banner: e.banner,
      isBot: e.isBot,
      age: e.age,
      power: e.power,
      rank: rankForPower(e.power).name,
      tier: e.tier,
      raidsWon: e.raidsWon,
      raidsLost: e.raidsLost,
      armySize: e.army.villager + e.army.spearman + e.army.archer + e.army.knight,
      buildings: e.buildings.length,
      tileX: e.tileX,
      tileY: e.tileY,
      online: e.isBot ? false : onlineEmpires.has(e.id),
    }))
    .sort((a, b) => b.power - a.power);
  res.json({ ok: true, rows });
});

// Full public detail of one empire (incl. base layout) so others can spectate
// its world. Empire state holds no secrets (passwords live on the user record).
app.get("/api/empires/:id", (req, res) => {
  const e = state.empires[req.params.id];
  if (!e) return res.status(404).json({ ok: false, error: "Empire not found." });
  res.json({
    ok: true,
    empire: e,
    rank: rankForPower(e.power).name,
    online: e.isBot ? false : onlineEmpires.has(e.id),
  });
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

// ── Token shop (pay for items with the SPL token) ───────────────────────────
app.get("/api/shop/config", async (_req, res) => {
  try {
    res.json(await shopConfig());
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});
app.post("/api/shop/buy", async (req, res) => {
  try {
    const { address, signature, itemId } = (req.body ?? {}) as Record<string, unknown>;
    if (!address || !signature || !itemId)
      return res.status(400).json({ ok: false, error: "Missing address, signature or itemId." });
    const result = await buyShopItem(String(address), String(signature), String(itemId));
    // push fresh empire state to the player's live game so the item shows at once
    if (result.ok && result.empireId) pushSnapshot(result.empireId);
    res.json(result);
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
    // refresh holder-tier perks from chain, then re-push so they apply this session
    if (user.externalId) {
      const eid = empireId;
      void refreshHolderTier(user.externalId).then(() => pushSnapshot(eid));
    }
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
  socket.on("demolish", (p: { buildingId: string }) =>
    withEmpire((id) => handle(actDemolish(state.empires[id], p?.buildingId), "Building demolished.")),
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
  socket.on("attackBoss", (p: { units: Army }) =>
    withEmpire((id) => {
      const r = attackBoss(state.empires[id], p?.units || {});
      if (r.ok && r.slain) socket.emit("toast", { kind: "success", text: "You landed the killing blow — spoils incoming!" });
      else if (r.ok) socket.emit("toast", { kind: "success", text: `Struck for ${(r.damage ?? 0).toLocaleString()} damage!` });
      else if (r.error) socket.emit("toast", { kind: "warn", text: r.error });
      scheduleSave();
      pushSnapshot(id);
    }),
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

  // Alliance changes touch every member, so refresh all affected snapshots.
  function handleAlliance(result: { ok: boolean; error?: string; members?: string[] }, successMsg?: string) {
    if (!result.ok && result.error) socket.emit("toast", { kind: "warn", text: result.error });
    else if (successMsg) socket.emit("toast", { kind: "success", text: successMsg });
    scheduleSave();
    const ids = result.members ?? (empireId ? [empireId] : []);
    for (const id of ids) pushSnapshot(id);
  }
  socket.on("alliance:create", (p: { name?: string; tag?: string }) =>
    withEmpire((id) => handleAlliance(createAlliance(state.empires[id], p?.name ?? "", p?.tag ?? ""), "Alliance founded!")),
  );
  socket.on("alliance:join", (p: { allianceId?: string }) =>
    withEmpire((id) => handleAlliance(joinAlliance(state.empires[id], String(p?.allianceId ?? "")), "Joined the alliance!")),
  );
  socket.on("alliance:leave", () =>
    withEmpire((id) => handleAlliance(leaveAlliance(state.empires[id]), "You left the alliance.")),
  );
  socket.on("alliance:kick", (p: { targetId?: string }) =>
    withEmpire((id) => handleAlliance(kickMember(state.empires[id], String(p?.targetId ?? "")), "Member removed.")),
  );
  socket.on("alliance:disband", () =>
    withEmpire((id) => handleAlliance(disbandAlliance(state.empires[id]), "Alliance disbanded.")),
  );
  socket.on("alliance:chat", (p: { text?: string }) =>
    withEmpire((id) => handleAlliance(postChat(state.empires[id], String(p?.text ?? "")))),
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
    tickBoss(); // spawn / respawn the world boss
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
  console.log(`\n  ⚔  Realm Rumble server running on http://localhost:${PORT}`);
  console.log(`     Tick: ${TICK_MS}ms · AI: ${AI_MS}ms · Bots: ${TARGET_BOTS}\n`);
});
