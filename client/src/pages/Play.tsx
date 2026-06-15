import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../lib/store";
import ResourceBar from "../game/ResourceBar";
import LiveWorld from "../game/LiveWorld";
import EmpireView from "../game/EmpireView";
import HeroView from "../game/HeroView";
import WorldView from "../game/WorldView";
import MilitaryView from "../game/MilitaryView";
import QuestsView from "../game/QuestsView";
import LogView from "../game/LogView";
import OperationsPanel from "../game/OperationsPanel";
import TutorialOverlay from "../components/TutorialOverlay";
import { armyTotal } from "../game/derive";

type Tab = "live" | "hero" | "empire" | "world" | "military" | "quests" | "log";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "live", label: "Adventure", icon: "🌍" },
  { id: "hero", label: "Hero", icon: "🦸" },
  { id: "empire", label: "Empire", icon: "🏰" },
  { id: "world", label: "Invade", icon: "🗡️" },
  { id: "military", label: "Military", icon: "⚔️" },
  { id: "quests", label: "Quests", icon: "📜" },
  { id: "log", label: "Chronicle", icon: "📖" },
];

export default function Play() {
  const snapshot = useGame((s) => s.snapshot);
  const connected = useGame((s) => s.connected);
  const token = useGame((s) => s.token);
  const connect = useGame((s) => s.connect);
  const logout = useGame((s) => s.logout);
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
      <ResourceBar empire={empire} />

      <div className={`container-x ${tab === "live" ? "pt-4 pb-3" : "py-5"}`}>
        {/* tab nav */}
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
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

      {/* The Adventure world is full-bleed & immersive; other tabs use the grid. */}
      {tab === "live" ? (
        <LiveWorld snapshot={snapshot} onInvade={() => setTab("world")} />
      ) : (
        <div className="container-x pb-6">
          <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
            <div className="min-w-0">
              {tab === "hero" && <HeroView empire={empire} />}
              {tab === "empire" && <EmpireView empire={empire} />}
              {tab === "world" && <WorldView snapshot={snapshot} />}
              {tab === "military" && <MilitaryView empire={empire} />}
              {tab === "quests" && <QuestsView empire={empire} />}
              {tab === "log" && <LogView empire={empire} />}
            </div>

            <aside className="hidden xl:block">
              <div className="sticky top-32">
                <OperationsPanel snapshot={snapshot} />
              </div>
            </aside>
          </div>
        </div>
      )}

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
