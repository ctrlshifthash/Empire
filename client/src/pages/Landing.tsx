import { useEffect, useState } from "react";
import Hero from "../components/landing/Hero";
import { Ages, Features, FinalCTA, HowItWorks, LeaderboardPreview } from "../components/landing/Sections";
import { api } from "../lib/api";

type Stats = Awaited<ReturnType<typeof api.stats>>;
type Board = Awaited<ReturnType<typeof api.leaderboard>>;

export default function Landing() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [board, setBoard] = useState<Board | null>(null);

  useEffect(() => {
    let alive = true;
    const loadStats = () => api.stats().then((s) => alive && setStats(s)).catch(() => {});
    const loadBoard = () => api.leaderboard().then((b) => alive && setBoard(b)).catch(() => {});
    loadStats();
    loadBoard();
    const id = setInterval(loadStats, 6000);
    const id2 = setInterval(loadBoard, 12000);
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(id2);
    };
  }, []);

  return (
    <div>
      <Hero stats={stats} />
      <Features />
      <HowItWorks />
      <Ages />
      <LeaderboardPreview rows={board?.rows ?? []} />
      <FinalCTA />
    </div>
  );
}
