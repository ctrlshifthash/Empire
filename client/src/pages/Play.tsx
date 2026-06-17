import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../lib/store";
import ResourceBar from "../game/ResourceBar";
import LiveWorld from "../game/LiveWorld";
import EmpireView from "../game/EmpireView";
import HeroView from "../game/HeroView";
import WorldView from "../game/WorldView";
import MilitaryView from "../game/MilitaryView";
import ArmouryView from "../game/ArmouryView";
import TokenShop from "../game/TokenShop";
import AllianceView from "../game/AllianceView";
import WorldBossView from "../game/WorldBossView";
import AchievementsView from "../game/AchievementsView";
import RewardsPanel from "../game/RewardsPanel";
import QuestsView from "../game/QuestsView";
import LogView from "../game/LogView";
import OperationsPanel from "../game/OperationsPanel";
import BattleSpectate from "../game/BattleSpectate";
import TutorialOverlay from "../components/TutorialOverlay";
import { armyTotal } from "../game/derive";

type Tab =
  | "live"
  | "hero"
  | "empire"
  | "world"
  | "boss"
  | "military"
  | "armoury"
  | "tokenshop"
  | "alliance"
  | "titles"
  | "quests"
  | "log"
  | "rewards";

const TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: "live", label: "Play", icon: "🌍", desc: "Your live world — walk around, harvest and fight" },
  { id: "hero", label: "My Hero", icon: "🦸", desc: "Customise your character: gear, skills & tools" },
  { id: "empire", label: "Buildings", icon: "🏰", desc: "Build & upgrade your settlement, advance ages" },
  { id: "world", label: "Attack", icon: "🗡️", desc: "Pick a rival empire and invade it" },
  { id: "boss", label: "World Boss", icon: "👹", desc: "Team up against a server-wide boss for in-game spoils" },
  { id: "military", label: "Army", icon: "⚔️", desc: "Train soldiers for your army" },
  { id: "armoury", label: "Armoury", icon: "🛒", desc: "Buy weapons & armour for your army with coins" },
  { id: "tokenshop", label: "Token Shop", icon: "💎", desc: "Spend the project token on packs, boosts, armies & traits" },
  { id: "alliance", label: "Alliance", icon: "🛡️", desc: "Band together — allies can't raid each other & climb the alliance ranks" },
  { id: "titles", label: "Titles", icon: "🏅", desc: "Achievements & milestones you've unlocked" },
  { id: "quests", label: "Quests", icon: "📜", desc: "Goals to complete for coins & resources" },
  { id: "log", label: "Battles", icon: "📖", desc: "Watch replays of your battles & event history" },
  { id: "rewards", label: "Rewards", icon: "💰", desc: "Connect your wallet & claim SOL token rewards" },
];

export default function Play() {
  const snapshot = useGame((s) => s.snapshot);
  const connected = useGame((s) => s.connected);
  const token = useGame((s) => s.token);
  const connect = useGame((s) => s.connect);
  const logout = useGame((s) => s.logout);
  const pendingBattle = useGame((s) => s.pendingBattle);
  const clearPendingBattle = useGame((s) => s.clearPendingBattle);
  const locate = useGame((s) => s.locate);
  const invadeTarget = useGame((s) => s.invadeTarget);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("live");
  const [stuck, setStuck] = useState(false);
  const [showTut, setShowTut] = useState(() => {
    try {
      return localStorage.getItem("ee_tutorial_done") !== "1";
    } catch {
      return true;
    }
  });

  // make sure we have a live connection
  useEffect(() => {
    if (token && !snapshot) connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // opening an invasion from the Empires page jumps straight to the Attack tab
  useEffect(() => {
    if (invadeTarget) setTab("world");
  }, [invadeTarget]);

  // if the world never loads (dead token, server down), offer a way out
  useEffect(() => {
    if (snapshot) {
      setStuck(false);
      return;
    }
    const id = setTimeout(() => setStuck(true), 7000);
    return () => clearTimeout(id);
  }, [snapshot]);

  if (!snapshot) {
    if (stuck) {
      return (
        <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="text-4xl">🏰</div>
          <div>
            <h2 className="text-xl font-bold">We couldn't load your empire</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-parchment-300/70">
              {connected
                ? "Your session may have expired, or the world was reset. Try again, or log in to start fresh."
                : "Can't reach the game server. Make sure it's running (npm run dev), then retry."}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              className="btn-ghost"
              onClick={() => {
                setStuck(false);
                connect();
              }}
            >
              ↻ Retry
            </button>
            <button
              className="btn-gold"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Log in again
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
        <div className="text-parchment-300/70">
          {connected ? "Summoning your empire…" : "Connecting to the world…"}
        </div>
      </div>
    );
  }

  const { empire } = snapshot;
  const claimable = empire.quests.filter((q) => q.completed && !q.claimed).length;
  const incoming = snapshot.incomingMarches.length;

  return (
    <div>
      <ResourceBar
        empire={empire}
        onLocate={(kind) => {
          setTab("live");
          locate(kind);
        }}
      />

      <div className="container-x pt-4 pb-3">
        {/* tab nav */}
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              title={t.desc}
              className={`relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                tab === t.id
                  ? "bg-gradient-to-b from-gold-light to-gold text-ink shadow-gold"
                  : "border border-parchment-300/10 bg-white/5 text-parchment-100/80 hover:bg-white/10"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
              {t.id === "quests" && claimable > 0 && (
                <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blood px-1 text-[10px] font-bold text-white">
                  {claimable}
                </span>
              )}
              {t.id === "world" && incoming > 0 && (
                <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blood px-1 text-[10px] font-bold text-white animate-pulseGlow">
                  {incoming}
                </span>
              )}
              {t.id === "log" && (empire.battles?.length ?? 0) > 0 && (
                <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">
                  {empire.battles.length}
                </span>
              )}
            </button>
          ))}

          <button
            className="ml-auto rounded-lg border border-parchment-300/10 bg-white/5 px-3 py-2 text-sm font-medium text-parchment-100/80 hover:border-gold/40 hover:text-gold-light"
            onClick={() => setShowTut(true)}
            title="Replay the tutorial"
          >
            ❔ Tutorial
          </button>
          <div className="hidden items-center gap-2 text-xs text-parchment-300/50 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-blood"}`} />
            {connected ? "Live" : "Reconnecting…"}
            <span className="text-parchment-300/30">·</span>
            <span>⚔ {armyTotal(empire)} troops</span>
          </div>
        </div>
      </div>

      {/* The Adventure world stays mounted & running underneath everything, so
          opening Hero / Empire / Military etc. never leaves the live game. */}
      <LiveWorld snapshot={snapshot} onInvade={() => setTab("world")} onOpenTab={(t) => setTab(t as Tab)} />

      {/* Dashboard views overlay the live world (which keeps running behind) at
          full dashboard width, so nothing is cramped and you never leave the game. */}
      {tab !== "live" && (
        <div
          className="fixed inset-0 top-16 z-40 overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={() => setTab("live")}
        >
          <div className="container-x py-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                  <span>{TABS.find((t) => t.id === tab)?.icon}</span>
                  {TABS.find((t) => t.id === tab)?.label}
                </h2>
                <p className="mt-0.5 text-sm text-parchment-300/60">{TABS.find((t) => t.id === tab)?.desc}</p>
              </div>
              <button
                className="rounded-lg border border-parchment-300/10 bg-white/5 px-4 py-2 text-sm font-medium text-parchment-100/80 hover:border-gold/40 hover:text-gold-light"
                onClick={() => setTab("live")}
              >
                ✕ Close
              </button>
            </div>
            <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
              <div className="min-w-0">
                {tab === "hero" && <HeroView empire={empire} />}
                {tab === "empire" && <EmpireView empire={empire} />}
                {tab === "world" && <WorldView snapshot={snapshot} />}
                {tab === "boss" && <WorldBossView empire={empire} />}
                {tab === "military" && <MilitaryView empire={empire} />}
                {tab === "armoury" && <ArmouryView empire={empire} />}
                {tab === "tokenshop" && <TokenShop />}
                {tab === "alliance" && <AllianceView empire={empire} />}
                {tab === "titles" && <AchievementsView empire={empire} />}
                {tab === "quests" && <QuestsView empire={empire} />}
                {tab === "log" && <LogView empire={empire} />}
                {tab === "rewards" && <RewardsPanel />}
              </div>
              <aside className="hidden xl:block">
                <div className="sticky top-4">
                  <OperationsPanel snapshot={snapshot} />
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {/* In-world battle spectate — auto-opens for your own invasions, or via the Chronicle. */}
      {pendingBattle && <BattleSpectate report={pendingBattle} onClose={clearPendingBattle} />}

      {showTut && (
        <TutorialOverlay
          snapshot={snapshot}
          currentTab={tab}
          onTab={(t) => setTab(t as Tab)}
          onFinish={() => {
            try {
              localStorage.setItem("ee_tutorial_done", "1");
            } catch {
              /* ignore */
            }
            setShowTut(false);
          }}
        />
      )}
    </div>
  );
}
