// ─────────────────────────────────────────────────────────────────────────────
// Realm Rumble — Shared type contracts (used by both client and server)
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
  | "tower"
  | "gate"
  | "market"
  | "keep"
  | "temple"
  | "wonder";

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
  razed?: string[]; // buildings destroyed/damaged in the raid (weakens the foe)
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
  // bot difficulty tier (1 = rookie … 5 = conqueror); undefined for human players
  tier?: number;
  // bought equipment: per-unit-type army weapon (attack) & armour (defense),
  // plus the hero's own helmet & armour (extra HP). Undefined on old saves.
  armoury?: {
    weapon: Partial<Record<UnitType, number>>;
    armour: Partial<Record<UnitType, number>>;
    helmet: number;
    heroArmour: number;
  };
  // learned hero traits/perks (ids from gamedata TRAITS)
  traits?: string[];
  // temporary buffs bought in the token shop (e.g. a timed harvest multiplier)
  boosts?: { gatherMult?: number; gatherUntil?: number };
  // alliance this empire belongs to (id into state.alliances), if any
  allianceId?: string;
  // unlocked achievement ids (see ACHIEVEMENTS in gamedata)
  achievements?: string[];
  // highest renown-rank index reached (for rank-up relic drops)
  lastRankIdx?: number;
  // number of world-boss kills this empire took part in
  bossKills?: number;
  // holder-tier name (Bronze…Diamond) from the linked wallet's on-chain holdings,
  // refreshed on connect/dashboard view. Grants in-game perks; undefined = none.
  holderTier?: string;
  // wagered-arena record
  duelsWon?: number;
  duelsLost?: number;
  duelStreak?: number; // current arena win streak
  bestStreak?: number; // best arena win streak
  lastArenaBonusDay?: number; // UTC day index of the last daily-win bonus claimed
  // equipped marketplace relic instance ids (up to EQUIP_SLOTS); their effects stack
  equipped?: string[];
  // equipped character cNFT instance id (your hub avatar skin), if any
  equippedCharacter?: string;
  // lifetime marketplace trading record
  marketStats?: {
    bought: number;
    sold: number;
    earned: { SOL: number; USDC: number };
    spent: { SOL: number; USDC: number };
  };
}

// ── Alliances ───────────────────────────────────────────────────────────────
export interface AllianceChatMsg {
  id: string;
  from: string; // empire id
  fromName: string;
  text: string;
  at: number;
}

// Global social hub: a shared chat lobby every player lands in before entering
// their world.
export interface HubMessage {
  id: string;
  fromId: string; // empire id
  fromName: string;
  banner: string; // sender's banner colour
  text: string;
  at: number;
}

export interface HubPlayer {
  id: string;
  name: string;
  banner: string;
  power: number;
  rank: string;
}

// A player's avatar in the spatial hub (a shared walkable plaza). Positions are
// in continuous tile units, synced in real time.
export interface HubAvatar {
  id: string;
  name: string;
  level: number;
  banner: string;
  x: number;
  y: number;
  facing: number; // 1 = facing right, -1 = left
  moving: boolean;
  // equipped character skin, if any (look drives the placeholder sprite)
  character?: { icon: string; color: string; hat: "crown" | "helmet" | "hood" | "cap" | null; cape: boolean };
}

export interface Alliance {
  id: string;
  name: string;
  tag: string; // short 2–5 char badge shown next to members
  banner: string; // hex colour
  leaderId: string; // empire id of the leader
  memberIds: string[]; // empire ids (includes the leader)
  createdAt: number;
  chat: AllianceChatMsg[]; // recent messages (trimmed)
}

export interface AllianceMemberPublic {
  id: string;
  name: string;
  power: number;
  rank: string;
  online: boolean;
  leader: boolean;
}

export interface AlliancePublic {
  id: string;
  name: string;
  tag: string;
  banner: string;
  leaderId: string;
  members: AllianceMemberPublic[];
  totalPower: number;
  memberCount: number;
  createdAt: number;
  chat: AllianceChatMsg[];
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
  // difficulty tier + its label, for bots (so players can pick fair targets)
  tier?: number;
  rank?: string;
  // alliance membership (so allies can be shown/skipped as raid targets)
  allianceId?: string;
  allianceTag?: string;
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
  // stable external identity (Solana wallet address or email) for Privy logins;
  // these accounts have no password and are matched on this instead
  externalId?: string;
  // true for throwaway demo/guest accounts (worthless in-game coins only)
  demo?: boolean;
}

export type AuthUser = Pick<User, "id" | "username" | "empireId"> & { demo?: boolean };

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

// ── World Boss (server-wide PvE event) ───────────────────────────────────────
export interface BossContribution {
  empireId: string;
  name: string;
  banner: string;
  damage: number;
  lastAt: number; // last time this empire struck (for the per-empire cooldown)
}

export interface WorldBoss {
  id: string;
  name: string;
  tier: number;
  maxHp: number;
  hp: number;
  spawnedAt: number;
  status: "alive" | "slain";
  slainAt?: number;
  respawnAt?: number;
  slayerName?: string; // who landed the killing blow
  contributions: Record<string, BossContribution>;
}

export interface BossPublic {
  id: string;
  name: string;
  tier: number;
  maxHp: number;
  hp: number;
  status: "alive" | "slain";
  respawnAt?: number;
  slayerName?: string;
  totalContributors: number;
  topDamage: { name: string; banner: string; damage: number }[];
  yourDamage: number;
  yourCooldownMs: number; // remaining strike cooldown for the viewing empire
}

// ── Governance (token-weighted polls) ────────────────────────────────────────
export interface PollOption {
  id: string;
  label: string;
}
export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdAt: number;
  endsAt: number;
  status: "open" | "closed";
  votes: Record<string, string>; // wallet -> optionId (one vote each, changeable)
  weights: Record<string, number>; // wallet -> token-holding weight at vote time
}
export interface PollResult {
  id: string;
  question: string;
  createdAt: number;
  endsAt: number;
  status: "open" | "closed";
  totalVoters: number;
  totalWeight: number;
  options: { id: string; label: string; weight: number; pct: number }[];
  yourVote: string | null;
}

// ── Bug reports & feedback ───────────────────────────────────────────────────
export interface BugReport {
  id: string;
  kind: "bug" | "feedback"; // both land in the same admin inbox
  message: string;
  page?: string; // route the user was on
  contact?: string; // optional handle/email so you can follow up
  at: number;
  ua?: string; // browser user-agent
}

// ── Wagered Arena (PvP coin duels) ───────────────────────────────────────────
export interface Duel {
  id: string;
  challengerId: string;
  challengerName: string;
  challengerBanner: string;
  stake: number; // coins staked by each side (winner takes ~both, minus rake)
  army: Partial<Record<UnitType, number>>; // army the challenger committed
  status: "open" | "resolved";
  createdAt: number;
  opponentId?: string;
  opponentName?: string;
  winnerId?: string;
  resolvedAt?: number;
}
export interface DuelPublic {
  id: string;
  challengerId: string;
  challengerName: string;
  challengerBanner: string;
  stake: number;
  armySize: number; // challenger's committed army size (shown so you can decide)
  createdAt: number;
}

// A rolling single-elimination tournament. Players pay a coin entry fee; when it
// fills it auto-runs and the champion takes the pot (minus rake), then it resets.
export interface TournamentEntrant {
  empireId: string;
  name: string;
  banner: string;
  power: number; // battle-power snapshot at entry
}
export interface TournamentChampion {
  name: string;
  banner: string;
  prize: number;
  size: number;
  at: number;
}
export interface Tournament {
  id: string;
  entryFee: number;
  size: number;
  entrants: TournamentEntrant[];
  createdAt: number;
  lastChampion?: TournamentChampion;
}
export interface TournamentPublic {
  id: string;
  entryFee: number;
  size: number;
  count: number;
  entrants: { name: string; banner: string }[];
  joined: boolean;
  lastChampion: TournamentChampion | null;
}

// ── Player Marketplace ───────────────────────────────────────────────────────
export type MarketCurrency = "SOL" | "USDC";

export interface ItemInstance {
  id: string;
  typeId: string;
  ownerId: string; // empire id
  serial: number; // #N of the type's max supply
  mintedAt: number;
}

// A character cNFT a player owns. `assetId` is the on-chain compressed-NFT asset
// id once minted (null in beta / before the mint goes live).
export interface CharacterInstance {
  id: string;
  typeId: string;
  ownerId: string; // empire id
  serial: number;
  assetId: string | null; // on-chain cNFT asset id (Bubblegum) — set when minted
  mintedAt: number;
}

// Snapshot view of a character a player owns.
export interface OwnedCharacter {
  instanceId: string;
  typeId: string;
  name: string;
  icon: string;
  color: string;
  hat: "crown" | "helmet" | "hood" | "cap" | null;
  cape: boolean;
  rarity: string;
  serial: number;
  equipped: boolean;
  onChain: boolean; // true once it's a real cNFT
}
export interface Listing {
  id: string;
  instanceId: string;
  typeId: string;
  sellerId: string; // empire id
  sellerName: string;
  sellerWallet: string; // payout address
  price: number; // human units of the currency
  currency: MarketCurrency;
  status: "active" | "sold";
  reservedBy?: string; // buyer wallet during a pending purchase
  reservedUntil?: number;
  createdAt: number;
}
export interface ListingPublic {
  id: string;
  typeId: string;
  name: string;
  icon: string;
  rarity: string;
  serial: number;
  price: number;
  currency: MarketCurrency;
  sellerName: string;
  effect: string; // what the relic does when equipped
  reserved: boolean;
}
export interface InventoryItem {
  instanceId: string;
  typeId: string;
  name: string;
  icon: string;
  rarity: string;
  serial: number;
  listed: boolean;
  equipped: boolean;
  effect: string; // human summary of its equipped effects
  canEquip: boolean; // whether your rank is high enough to equip it
  reqRank: string; // rank needed to equip this rarity
}

// ── Coin Exchange (sell in-game coins for the $RUMBLE token, P2P) ─────────────
export interface CoinListing {
  id: string;
  sellerId: string; // empire id
  sellerName: string;
  sellerWallet: string; // payout address
  coinAmount: number; // in-game coins offered
  rumblePrice: number; // whole $RUMBLE asked
  status: "active" | "sold";
  reservedBy?: string;
  reservedUntil?: number;
  createdAt: number;
}
export interface CoinListingPublic {
  id: string;
  sellerName: string;
  coinAmount: number;
  rumblePrice: number;
  reserved: boolean;
}

export interface GameSnapshot {
  empire: Empire;
  world: WorldMeta;
  others: EmpirePublic[];
  incomingMarches: March[];
  outgoingMarches: March[];
  serverTime: number;
  // the player's alliance (members, chat, total power) or null if not in one
  alliance: AlliancePublic | null;
  // the current server-wide world boss (alive or in respawn cooldown)
  boss: BossPublic | null;
  // open wagered-arena duels anyone can accept
  duels: DuelPublic[];
  // the current rolling arena tournament
  tournament: TournamentPublic | null;
  // the player's owned marketplace items
  inventory: InventoryItem[];
  // the player's owned character cNFTs
  characters: OwnedCharacter[];
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
export const LOCAL_WORLD = { width: 80, height: 80, centerX: 24, centerY: 24 } as const;
