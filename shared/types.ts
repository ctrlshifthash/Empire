// ─────────────────────────────────────────────────────────────────────────────
// Empires Eternal — Shared type contracts (used by both client and server)
// ─────────────────────────────────────────────────────────────────────────────

export type ResourceKind = "wood" | "food" | "gold" | "stone";

export type Resources = Record<ResourceKind, number>;

export type AgeId = "dark" | "feudal" | "castle" | "imperial";

export type BuildingType =
  | "town_center"
  | "house"
  | "lumber_camp"
  | "farm"
  | "gold_mine"
  | "quarry"
  | "barracks"
  | "archery_range"
  | "stable"
  | "wall"
  | "market";

export type UnitType = "villager" | "spearman" | "archer" | "knight";

// ── Hero progression ────────────────────────────────────────────────────────
export type SkillId = "woodcutting" | "mining" | "foraging" | "combat" | "construction";
export type ToolId = "axe" | "pickaxe" | "sickle" | "sword";

export interface HeroState {
  skills: Record<SkillId, number>; // accumulated xp per skill
  tools: Record<ToolId, number>; // tier 1..MAX_TIER
}

// A single placed building inside an empire.
export interface Building {
  id: string;
  type: BuildingType;
  level: number;
  // grid position within the empire base view (dashboard)
  x: number;
  y: number;
  // position in the live, walkable local world (tile coords). Assigned when the
  // building is placed in-world; backfilled for older saves.
  wx?: number;
  wy?: number;
  // if the building is currently being constructed/upgraded, this is the
  // unix-ms timestamp when it completes. null/undefined => idle.
  completesAt?: number | null;
  // what the pending job is producing ("build" for new, "upgrade" for level up)
  job?: "build" | "upgrade" | null;
}

// A queued unit-training order at a military building.
export interface TrainOrder {
  id: string;
  unit: UnitType;
  quantity: number;
  completesAt: number; // unix ms when the whole batch finishes
  startedAt: number;
}

// An army on the move toward a target empire (attack march).
export interface March {
  id: string;
  fromEmpireId: string;
  fromName: string;
  toEmpireId: string;
  toName: string;
  units: Partial<Record<UnitType, number>>;
  departsAt: number;
  arrivesAt: number;
  kind: "attack" | "return";
  // populated for a "return" march carrying loot home
  loot?: Resources;
  survivors?: Partial<Record<UnitType, number>>;
}

// A record of a resolved raid, kept on both empires so it can be replayed.
export interface BattleReport {
  id: string;
  at: number;
  attackerName: string;
  defenderName: string;
  role: "attacker" | "defender"; // perspective of the empire holding this report
  attackerArmy: Partial<Record<UnitType, number>>;
  defenderArmy: Partial<Record<UnitType, number>>;
  attackerLosses: Partial<Record<UnitType, number>>;
  defenderLosses: Partial<Record<UnitType, number>>;
  attackerWon: boolean;
  loot: Resources;
  razed?: string | null;
  attackPower: number;
  defendPower: number;
}

export interface QuestProgress {
  questId: string;
  progress: number;
  goal: number;
  completed: boolean;
  claimed: boolean;
}

// A line in the empire's event log (battles, quests, raids, etc.)
export interface LogEntry {
  id: string;
  at: number;
  kind: "battle" | "quest" | "build" | "train" | "raid" | "system";
  text: string;
}

export interface Empire {
  id: string;
  userId: string;
  name: string;
  banner: string; // hex color for the empire banner/theme
  isBot: boolean;
  age: AgeId;
  // position on the shared world map
  tileX: number;
  tileY: number;
  resources: Resources;
  // last time the engine applied passive resource production to this empire
  lastTick: number;
  buildings: Building[];
  army: Record<UnitType, number>;
  trainQueue: TrainOrder[];
  // research in progress toward the next age (completesAt) or null
  ageUpCompletesAt?: number | null;
  coins: number;
  hero: HeroState;
  quests: QuestProgress[];
  battles: BattleReport[];
  log: LogEntry[];
  // lifetime stats
  power: number; // derived score used for leaderboard ranking
  raidsWon: number;
  raidsLost: number;
  createdAt: number;
}

// Public, trimmed view of an empire shown on the world map / to opponents.
export interface EmpirePublic {
  id: string;
  name: string;
  banner: string;
  isBot: boolean;
  age: AgeId;
  tileX: number;
  tileY: number;
  power: number;
  armySize: number;
  online: boolean;
}

export interface WorldMeta {
  width: number;
  height: number;
  seed: number;
  tick: number;
}

export interface User {
  id: string;
  username: string;
  // scrypt hash, never sent to the client
  passHash?: string;
  empireId: string;
  createdAt: number;
}

export type AuthUser = Pick<User, "id" | "username" | "empireId">;

// ── Definition tables (static, shared) ──────────────────────────────────────

export interface BuildingDef {
  type: BuildingType;
  name: string;
  description: string;
  icon: string; // emoji placeholder until sprite sheet is wired
  baseCost: Partial<Resources>;
  // resource produced per minute at level 1 (scales with level)
  produces?: { kind: ResourceKind; perMinute: number };
  populationProvided?: number; // houses / town center
  buildSeconds: number;
  requiresAge: AgeId;
  maxLevel: number;
  // military buildings can train these units
  trains?: UnitType[];
  defenseBonus?: number; // walls
  unique?: boolean; // only one allowed (town center)
}

export interface UnitDef {
  type: UnitType;
  name: string;
  description: string;
  icon: string;
  cost: Partial<Resources>;
  population: number;
  attack: number;
  defense: number;
  hp: number;
  carry: number; // loot capacity
  trainSeconds: number;
  requiresAge: AgeId;
  trainedAt: BuildingType;
}

export interface AgeDef {
  id: AgeId;
  name: string;
  order: number;
  cost: Partial<Resources>;
  researchSeconds: number;
  blurb: string;
}

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  goal: number;
  reward: { coins?: number } & Partial<Resources>;
  // how progress is measured
  metric:
    | { kind: "building_count"; building: BuildingType }
    | { kind: "building_level"; building: BuildingType }
    | { kind: "resource_total"; resource: ResourceKind }
    | { kind: "army_size" }
    | { kind: "raids_won" }
    | { kind: "reach_age"; age: AgeId };
}

// ── Socket / API payloads ───────────────────────────────────────────────────

export interface GameSnapshot {
  empire: Empire;
  world: WorldMeta;
  others: EmpirePublic[];
  incomingMarches: March[];
  outgoingMarches: March[];
  serverTime: number;
}

// Server -> client realtime events
export interface ServerToClient {
  snapshot: (s: GameSnapshot) => void;
  worldUpdate: (empires: EmpirePublic[]) => void;
  log: (entry: LogEntry) => void;
  error: (msg: string) => void;
  toast: (msg: { kind: "info" | "success" | "warn"; text: string }) => void;
}

// Client -> server actions
export interface ClientToServer {
  hello: (token: string) => void;
  build: (p: { type: BuildingType; wx?: number; wy?: number }) => void;
  upgrade: (p: { buildingId: string }) => void;
  train: (p: { building: BuildingType; unit: UnitType; quantity: number }) => void;
  advanceAge: () => void;
  attack: (p: { targetEmpireId: string; units: Partial<Record<UnitType, number>> }) => void;
  rush: (p: { kind: "building" | "age" | "train"; id?: string }) => void; // spend coins to finish instantly
  claimQuest: (p: { questId: string }) => void;
  gather: (p: { resource: ResourceKind }) => void; // harvest a world node (server computes yield)
  upgradeTool: (p: { tool: ToolId }) => void; // spend resources/coins to improve a tool
  slay: (p: { kind: string }) => void; // report a world enemy kill for combat xp
}

// Dimensions of the live, walkable local world (tiles), shared so the server
// can place buildings the client will render.
export const LOCAL_WORLD = { width: 64, height: 64, centerX: 24, centerY: 24 } as const;
