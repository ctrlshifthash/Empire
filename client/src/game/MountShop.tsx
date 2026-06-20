import { useEffect, useState } from "react";
import { RARITY_META } from "@shared/gamedata";
import { SERVER_URL } from "../lib/config";

type Trait = { kind: "gather" | "speed" | "sol"; value: number; label: string };
type MountItem = {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  priceUsd: number;
  maxSupply: number;
  minted: number;
  remaining: number;
  trait: Trait;
  desc: string;
};

const rarityColor = (r: string) => (RARITY_META as Record<string, { color: string }>)[r]?.color ?? "#9aa4ad";
const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const traitIcon = (k: Trait["kind"]) => (k === "gather" ? "🌾" : k === "speed" ? "⚡" : "◎");
const traitColor = (k: Trait["kind"]) => (k === "gather" ? "#3fb950" : k === "speed" ? "#58a6ff" : "#e8c75a");

// Mounts & Pets marketplace. A pet rides beside your hero AND gives a real
// equipped perk (its own slot, stacks with relics). Strictly limited supply.
export default function MountShop() {
  const [catalog, setCatalog] = useState<MountItem[] | null>(null);

  useEffect(() => {
    fetch(`${SERVER_URL}/api/mounts/config`)
      .then((r) => r.json())
      .then((d) => d?.ok && setCatalog(d.mounts))
      .catch(() => {});
  }, []);

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 text-sm text-parchment-200">
        <span className="font-semibold text-gold-light">🐎 Mounts &amp; Pets</span> · A companion that rides beside your hero
        and gives a real <strong>equipped perk</strong> — its own slot, so it stacks on top of your relics. Strictly limited
        supply: once they&apos;re minted, they&apos;re gone. Each is a <strong>compressed NFT</strong> you own and can resell.
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

              {/* the perk — its use */}
              <div
                className="mt-2.5 flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold"
                style={{ borderColor: `${traitColor(m.trait.kind)}55`, background: `${traitColor(m.trait.kind)}12`, color: traitColor(m.trait.kind) }}
              >
                <span>{traitIcon(m.trait.kind)}</span>
                <span>{m.trait.label}</span>
              </div>

              <p className="mt-2 flex-1 text-xs text-parchment-300/65">{m.desc}</p>
              <div className="mt-2 text-[11px] text-parchment-300/50">
                {fmt(m.minted)} / {fmt(m.maxSupply)} minted · <span className="text-parchment-300/70">{fmt(m.remaining)} left</span>
                {soldOut ? " · sold out" : ""}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div>
                  <div className="font-display font-bold text-gold-light">${fmt(m.priceUsd)}</div>
                  <div className="text-[10px] text-parchment-300/45">in $RUMBLE</div>
                </div>
                <button className="btn-ghost btn-sm cursor-not-allowed opacity-70" disabled title="Buying goes live shortly">
                  Soon
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
