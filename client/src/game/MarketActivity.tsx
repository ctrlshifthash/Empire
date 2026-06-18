import { useEffect, useState } from "react";
import { SERVER_URL } from "../lib/config";
import type { MarketActivity as Activity } from "@shared/types";

const ago = (at: number) => {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

const dot: Record<Activity["kind"], string> = {
  listed: "bg-sky-400",
  bought: "bg-emerald-400",
  sold: "bg-gold",
};

// Live feed of recent marketplace activity for one category (relic/coin/character)
// — fires whenever something is listed, bought or sold.
export default function MarketActivity({ category }: { category: Activity["category"] }) {
  const [items, setItems] = useState<Activity[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`${SERVER_URL}/api/market/activity?category=${category}`)
        .then((r) => r.json())
        .then((d) => alive && d?.ok && setItems(d.activity))
        .catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [category]);

  return (
    <div className="panel p-4">
      <div className="mb-2 font-display text-lg font-bold text-gold-gradient">📜 Activity</div>
      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {items === null && <div className="text-sm text-parchment-300/50">Loading…</div>}
        {items?.length === 0 && <div className="text-sm text-parchment-300/50">No activity yet — be the first.</div>}
        {items?.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-sm">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot[a.kind]}`} />
            <span className="min-w-0 flex-1 truncate text-parchment-200">{a.text}</span>
            <span className="shrink-0 text-[11px] text-parchment-300/45">{ago(a.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
