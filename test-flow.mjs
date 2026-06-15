// End-to-end gameplay test against the running server (port 4000).
import { io } from "socket.io-client";

const BASE = "http://localhost:4000";
const log = (...a) => console.log(...a);

function register() {
  const name = "Tester_" + Math.floor(Math.random() * 100000);
  return fetch(BASE + "/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: name, password: "secret", empireName: name + " Realm" }),
  }).then((r) => r.json());
}

function nextSnapshot(socket, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("snapshot timeout")), timeout);
    socket.once("snapshot", (s) => {
      clearTimeout(t);
      resolve(s);
    });
  });
}

const results = [];
const check = (name, cond) => {
  results.push({ name, ok: !!cond });
  log(`${cond ? "✅" : "❌"} ${name}`);
};

const reg = await register();
check("register returns token+user", reg.ok && reg.token && reg.user);
const token = reg.token;

const socket = io(BASE, { transports: ["websocket", "polling"] });
await new Promise((res) => socket.on("connect", res));
check("socket connected", socket.connected);

const toasts = [];
socket.on("toast", (t) => toasts.push(t));

socket.emit("hello", token);
let snap = await nextSnapshot(socket);
check("received initial snapshot", snap && snap.empire);
check("empire has town center", snap.empire.buildings.some((b) => b.type === "town_center"));
check("empire starts with villagers", snap.empire.army.villager === 3);
check("world has other empires (bots)", snap.others.length >= 5);
const startWood = snap.empire.resources.wood;
log(`   start: wood=${startWood} coins=${snap.empire.coins} buildings=${snap.empire.buildings.length}`);

// 1) build a lumber camp
socket.emit("build", { type: "lumber_camp" });
snap = await nextSnapshot(socket);
const lumber = snap.empire.buildings.find((b) => b.type === "lumber_camp");
check("lumber camp added & under construction", lumber && lumber.completesAt != null);
check("wood was deducted for build", snap.empire.resources.wood < startWood);

// 2) rush the lumber camp with coins
socket.emit("rush", { kind: "building", id: lumber.id });
snap = await nextSnapshot(socket);
// let a tick finish the now-completed job
await new Promise((r) => setTimeout(r, 2500));
socket.emit("build", { type: "house" }); // trigger a fresh snapshot
snap = await nextSnapshot(socket);
const lumber2 = snap.empire.buildings.find((b) => b.id === lumber.id);
check("rushed lumber camp finished (level 1, active)", lumber2 && lumber2.level === 1 && lumber2.completesAt == null);

// 3) quest "Timber!" should now be complete & claimable
const timber = snap.empire.quests.find((q) => q.questId === "q_first_lumber");
check("first-lumber quest completed", timber && timber.completed);
const coinsBefore = snap.empire.coins;
socket.emit("claimQuest", { questId: "q_first_lumber" });
snap = await nextSnapshot(socket);
check("quest reward granted coins", snap.empire.coins > coinsBefore || snap.empire.quests.find((q)=>q.questId==="q_first_lumber").claimed);

// 4) train a spearman (need barracks first)
socket.emit("build", { type: "barracks" });
snap = await nextSnapshot(socket);
const barracks = snap.empire.buildings.find((b) => b.type === "barracks");
socket.emit("rush", { kind: "building", id: barracks.id });
await new Promise((r) => setTimeout(r, 2500));
socket.emit("train", { building: "barracks", unit: "spearman", quantity: 2 });
snap = await nextSnapshot(socket);
check("spearman training queued", snap.empire.trainQueue.some((o) => o.unit === "spearman"));

// 5) launch a raid on the nearest bot using villagers
const target = snap.others[0];
socket.emit("attack", { targetEmpireId: target.id, units: { villager: 2 } });
snap = await nextSnapshot(socket);
check("raid march created (outgoing)", snap.outgoingMarches.length >= 1);
check("villagers left home army for the march", snap.empire.army.villager <= 1);

// 6) invalid action should produce a warning toast
socket.emit("train", { building: "stable", unit: "knight", quantity: 1 });
await new Promise((r) => setTimeout(r, 800));
check("invalid action returns a warning toast", toasts.some((t) => t.kind === "warn"));

log("\n— summary —");
const passed = results.filter((r) => r.ok).length;
log(`${passed}/${results.length} checks passed`);
socket.disconnect();
process.exit(passed === results.length ? 0 : 1);
