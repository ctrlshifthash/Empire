import { useEffect, useState } from "react";
import { RARITY_META } from "@shared/gamedata";
import { SERVER_URL } from "../lib/config";

type MountItem = {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  priceCoins: number;
  maxSupply: number;
  minted: number;
  remaining: number;
  desc: string;
};

const rarityColor = (r: string) => (RARITY_META as Record<string, { color: string }>)[r]?.color ?? "#9aa4ad";
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

// Mounts & Pets marketplace. Preview the collectible roster; collecting (drops)
// and equipping unlock once the mounts feature goes live.
export default function MountShop() {
  const [catalog, setCatalog] = useState<MountItem[] | null>(null);
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    fetch(`${SERVER_URL}/api/mounts/config`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) return;
        setCatalog(d.mounts);
        setLocked(!!d.locked);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 text-sm text-parchment-200">
        <span className="font-semibold text-gold-light">🐎 Mounts &amp; Pets — beta {locked && "· locked"}</span> · Rare
        companions that ride beside your hero. Each will be a <strong>compressed NFT</strong> you hold in your wallet and can
        resell here.{" "}
        {locked
          ? "Previewing the roster now — collecting and equipping unlock once the feature goes live."
          : "Buy now to lock in a low serial."}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {catalog === null && <div className="panel p-8 text-center text-sm text-parchment-300/60">Loading…</div>}
        {catalog?.map((m) => {
          const soldOut = m.remaining <= 0;
          return (
            <div key={m.id} className="panel flex flex-col p-4" style={{ borderColor: `${rarityColor(m.rarity)}40` }}>
              <div className="flex items-center gap-3">
                <span
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-lg text-3xl"
                  style={{ background: `${rarityColor(m.rarity)}18`, border: `1px solid ${rarityColor(m.rarity)}` }}
                >
                  {m.icon}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-parchment-100">{m.name}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: rarityColor(m.rarity) }}>
                    {m.rarity}
                  </div>
                </div>
              </div>
              <p className="mt-2 flex-1 text-xs text-parchment-300/65">{m.desc}</p>
              <div className="mt-2 text-[11px] text-parchment-300/50">
                {fmt(m.minted)} / {fmt(m.maxSupply)} minted{soldOut ? " · sold out" : ""}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="font-display font-bold text-gold-light">🪙 {fmt(m.priceCoins)}</div>
                <button className="btn-ghost btn-sm cursor-not-allowed opacity-70" disabled title="Mounts unlock soon">
                  🔒 Locked
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
