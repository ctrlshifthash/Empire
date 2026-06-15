// Deterministic engine test: drive a full raid to resolution by advancing the
// world tick with explicit timestamps (no real-time waiting). Run with tsx:
//   node --import tsx server/sim-test.mjs
import { state } from "./src/store.ts";
import { createEmpire } from "./src/world.ts";
import { actAdvanceAge, actAttack, actBuild, actGather, actTrain, actUpgradeTool, produce, tick } from "./src/engine.ts";

const results = [];
const check = (name, cond, extra = "") => {
  results.push(cond);
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? "  — " + extra : ""}`);
};

// fresh world
state.world = { width: 40, height: 40, seed: 1, tick: 0 };
state.empires = {};
state.marches = [];

const atk = createEmpire({ userId: "u_atk", name: "Attacker", isBot: false });
const def = createEmpire({ userId: "u_def", name: "Defender", isBot: false });
atk.tileX = 5; atk.tileY = 5;
def.tileX = 6; def.tileY = 5;
atk.army.knight = 25; // strong force
def.army.spearman = 3; // weak garrison
def.resources = { wood: 1000, food: 1000, gold: 500, stone: 500 };
const defStartTotal = 1000 + 1000 + 500 + 500;
state.empires[atk.id] = atk;
state.empires[def.id] = def;

// launch the raid
const res = actAttack(atk, def.id, { knight: 25 });
check("attack action accepted", res.ok, res.error || "");
check("army detached from attacker home", atk.army.knight === 0);
const march = state.marches.find((m) => m.kind === "attack");
check("attack march queued", !!march);

// resolve the battle by ticking just past arrival
tick(march.arrivesAt + 1);
check("attacker won the raid (raidsWon)", atk.raidsWon === 1, `raidsWon=${atk.raidsWon}`);
check("defender recorded a loss (raidsLost)", def.raidsLost === 1);
check("defender garrison took casualties", def.army.spearman < 3, `spearmen left=${def.army.spearman}`);
const defNowTotal = def.resources.wood + def.resources.food + def.resources.gold + def.resources.stone;
check("defender was plundered", defNowTotal < defStartTotal, `before=${defStartTotal} after=${defNowTotal}`);
const ret = state.marches.find((m) => m.kind === "return" && m.fromEmpireId === atk.id);
check("survivors are returning home with loot", !!ret && (ret.loot.wood + ret.loot.food + ret.loot.gold + ret.loot.stone) > 0,
  ret ? `loot=${ret.loot.wood + ret.loot.food + ret.loot.gold + ret.loot.stone}` : "no return march");

// resolve the return march
const beforeReturnWood = atk.resources.wood;
tick(ret.arrivesAt + 1);
check("knights returned to attacker army", atk.army.knight > 0, `knights home=${atk.army.knight}`);
check("loot delivered to attacker stores", atk.resources.wood >= beforeReturnWood);

// age advancement
def.resources = { wood: 5000, food: 5000, gold: 5000, stone: 5000 };
const adv = actAdvanceAge(def);
check("advance-age accepted (Dark→Feudal)", adv.ok, adv.error || "");
check("age research is in progress", def.ageUpCompletesAt != null);
tick(def.ageUpCompletesAt + 1);
check("empire advanced to Feudal Age", def.age === "feudal", `age=${def.age}`);

// a hopelessly weak attacker should LOSE against a strong defender
const weak = createEmpire({ userId: "u_weak", name: "Weak", isBot: false });
weak.tileX = 10; weak.tileY = 10;
const fort = createEmpire({ userId: "u_fort", name: "Fortress", isBot: false });
fort.tileX = 11; fort.tileY = 10;
fort.army.knight = 30;
weak.army.spearman = 1;
state.empires[weak.id] = weak;
state.empires[fort.id] = fort;
actAttack(weak, fort.id, { spearman: 1 });
const wm = state.marches.find((m) => m.kind === "attack" && m.fromEmpireId === weak.id);
tick(wm.arrivesAt + 1);
check("strong defender repelled the weak attacker", fort.raidsLost === 0 && weak.raidsLost === 1,
  `fortRaidsLost=${fort.raidsLost} weakRaidsLost=${weak.raidsLost}`);

// ── regression guards for review fixes ──────────────────────────────────────

// passive production must accrue even for sub-1/tick producers (the floor bug)
const prod = createEmpire({ userId: "u_prod", name: "Farmer", isBot: false });
state.empires[prod.id] = prod;
prod.buildings.push({ id: "farm1", type: "farm", level: 1, x: 0, y: 0, completesAt: null, job: null });
const T0 = 2_000_000_000_000;
prod.lastTick = T0;
const foodBefore = prod.resources.food;
// simulate 60s of real time in 30 small 2s ticks (the conditions that broke it)
for (let i = 1; i <= 30; i++) produce(prod, T0 + i * 2000);
const foodGain = prod.resources.food - foodBefore;
check("a single Farm actually produces food over many small ticks", foodGain > 20,
  `gained ${foodGain.toFixed(1)} food in 60s (expected ~28)`);

// villagers can be trained at the town center
const vt = createEmpire({ userId: "u_vt", name: "Villagers", isBot: false });
state.empires[vt.id] = vt;
const tr = actTrain(vt, "town_center", "villager", 1);
check("villagers can be trained at the town center", tr.ok, tr.error || "");

// malformed / fractional attack payload is sanitised, not crashing or duped
const sani = createEmpire({ userId: "u_sani", name: "Sani", isBot: false });
const saniTarget = createEmpire({ userId: "u_st", name: "SaniTarget", isBot: false });
sani.tileX = 20; sani.tileY = 20; saniTarget.tileX = 21; saniTarget.tileY = 20;
sani.army.spearman = 3; sani.army.knight = 2;
state.empires[sani.id] = sani;
state.empires[saniTarget.id] = saniTarget;
const bad = actAttack(sani, saniTarget.id, { spearman: 2, knight: 1.9, evil: 999 });
const sm = state.marches.find((m) => m.kind === "attack" && m.fromEmpireId === sani.id);
check("malformed attack accepted & sanitised (no crash)", bad.ok && !!sm);
check("unknown unit key ignored in march", sm && sm.units.evil === undefined);
check("fractional count floored (knight 1.9 -> 1)", sm && sm.units.knight === 1);
check("home army correctly debited (integers only)", sani.army.spearman === 1 && sani.army.knight === 1);
// resolving it must not throw
let threw = false;
try { tick(sm.arrivesAt + 1); } catch { threw = true; }
check("resolving sanitised march does not throw", !threw);

// in-world harvesting grants resources (server-computed yield) + skill xp
const gatherer = createEmpire({ userId: "u_g", name: "Gatherer", isBot: false });
state.empires[gatherer.id] = gatherer;
const w0 = gatherer.resources.wood;
actGather(gatherer, "wood");
check("gathering adds resources (server-computed yield)", gatherer.resources.wood === w0 + 4, `+${gatherer.resources.wood - w0}`);
check("gathering awards woodcutting xp", (gatherer.hero.skills.woodcutting ?? 0) > 0);

// upgrading a tool increases yield per swing (kept under the storage cap)
gatherer.resources = { wood: 500, food: 500, gold: 500, stone: 500 };
gatherer.coins = 9999;
const upg = actUpgradeTool(gatherer, "axe");
check("tool upgrade accepted (axe tier 1 -> 2)", upg.ok && gatherer.hero.tools.axe === 2);
const b2 = gatherer.resources.wood;
actGather(gatherer, "wood");
check("a better axe yields more wood per swing", gatherer.resources.wood - b2 > 4, `+${gatherer.resources.wood - b2}`);

// beating a rival empire grants combat xp + razes a building on a decisive win
const fighter = createEmpire({ userId: "u_f", name: "Fighter", isBot: false });
const prey = createEmpire({ userId: "u_prey", name: "Prey", isBot: false });
fighter.tileX = 30; fighter.tileY = 30; prey.tileX = 31; prey.tileY = 30;
fighter.army.knight = 20; prey.army.spearman = 1;
prey.buildings.push({ id: "preyhouse", type: "house", level: 1, x: 1, y: 1, wx: 25, wy: 23, completesAt: null, job: null });
state.empires[fighter.id] = fighter;
state.empires[prey.id] = prey;
const preyBuildingsBefore = prey.buildings.length;
const fighterCoinsBefore = fighter.coins;
actAttack(fighter, prey.id, { knight: 20 });
const fm = state.marches.find((m) => m.kind === "attack" && m.fromEmpireId === fighter.id);
tick(fm.arrivesAt + 1);
check("beating a rival empire grants combat xp", (fighter.hero.skills.combat ?? 0) > 0, `combat xp=${fighter.hero.skills.combat}`);
check("a decisive invasion razes a rival building", prey.buildings.length < preyBuildingsBefore, `${preyBuildingsBefore} -> ${prey.buildings.length}`);
check("a victorious invasion grants coins", fighter.coins > fighterCoinsBefore, `coins ${fighterCoinsBefore} -> ${fighter.coins}`);

// town-built buildings get a live-world position assigned
const placed = createEmpire({ userId: "u_p", name: "Placer", isBot: false });
placed.resources = { wood: 9999, food: 9999, gold: 9999, stone: 9999 };
state.empires[placed.id] = placed;
const rb = actBuild(placed, "house", { wx: 26, wy: 22 });
const houseB = placed.buildings.find((x) => x.type === "house");
check("in-world build places at the chosen tile", rb.ok && houseB && houseB.wx === 26 && houseB.wy === 22);

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} engine checks passed`);
process.exit(passed === results.length ? 0 : 1);
