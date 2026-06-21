import { useEffect, useState } from "react";
import { useGame } from "../lib/store";
import { RARITY_META } from "@shared/gamedata";
import { SERVER_URL } from "../lib/config";
import CharacterAvatar from "./CharacterAvatar";
import OwnedCharactersGrid from "./OwnedCharactersGrid";

type Hat = "crown" | "helmet" | "hood" | "cap" | null;
type CatalogItem = {
  id: string;
  name: string;
  icon: string;
  color: string;
  hat: Hat;
  cape: boolean;
  rarity: string;
  priceCoins: number;
  priceRumble: number;
  maxSupply: number;
  image?: string;
  minted: number;
  remaining: number;
  desc: string;
};

const rarityColor = (r: string) => (RARITY_META as Record<string, { color: string }>)[r]?.color ?? "#9aa4ad";
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

// The character cNFT shop: buy a character (coins now, $RUMBLE soon), wear it as
// your hub avatar, own it as a compressed NFT, and resell it later.
export default function CharacterShop() {
  const buyCharacter = useGame((s) => s.buyCharacter);
  const coins = useGame((s) => s.snapshot?.empire?.coins ?? 0);
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    fetch(`${SERVER_URL}/api/characters/config`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) return;
        setCatalog(d.characters);
        setLocked(!!d.locked);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 text-sm text-parchment-200">
        <span className="font-semibold text-gold-light">🎭 Characters{locked && " · locked"}</span> · Buy a
        character, wear it as your <strong>hub avatar</strong>, and own it. Each is a <strong>compressed NFT</strong>{" "}
        you hold in your wallet and can resell here.{" "}
        {locked
          ? "Previewing the roster now — sales open shortly."
          : "Buy now to lock in a low serial."}
      </div>

      {/* catalog */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {catalog === null && <div className="panel p-8 text-center text-sm text-parchment-300/60">Loading…</div>}
        {catalog?.map((c) => {
          const soldOut = c.remaining <= 0;
          const cantAfford = coins < c.priceCoins;
          return (
            <div key={c.id} className="panel flex flex-col p-4" style={{ borderColor: `${rarityColor(c.rarity)}40` }}>
              <div className="flex items-center gap-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg" style={{ background: `${c.color}22`, border: `1px solid ${c.color}` }}>
                  <CharacterAvatar color={c.color} hat={c.hat} cape={c.cape} image={c.image} size={52} />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-parchment-100">{c.name}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: rarityColor(c.rarity) }}>
                    {c.rarity}
                  </div>
                </div>
              </div>
              <p className="mt-2 flex-1 text-xs text-parchment-300/65">{c.desc}</p>
              <div className="mt-2 text-[11px] text-parchment-300/50">
                {fmt(c.minted)} / {fmt(c.maxSupply)} minted{soldOut ? " · sold out" : ""}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-sm">
                  <div className="font-display font-bold text-gold-light">🪙 {fmt(c.priceCoins)}</div>
                  <div className="text-[10px] text-parchment-300/45">or {fmt(c.priceRumble)} $RUMBLE (soon)</div>
                </div>
                {locked ? (
                  <button className="btn-ghost btn-sm cursor-not-allowed opacity-70" disabled title="Characters unlock soon">
                    🔒 Locked
                  </button>
                ) : (
                  <button
                    className="btn-gold btn-sm"
                    disabled={soldOut || cantAfford}
                    onClick={() => buyCharacter(c.id)}
                    title={cantAfford ? "Not enough coins" : ""}
                  >
                    {soldOut ? "Sold out" : cantAfford ? "Need coins" : "Buy"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* owned */}
      <div>
        <h3 className="mb-2 font-display text-lg font-semibold">Your characters</h3>
        <OwnedCharactersGrid emptyText="You don't own a character yet — collect them above (once unlocked) to wear in the hub." />
      </div>
    </div>
  );
}
