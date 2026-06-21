import { useState } from "react";
import { useGame } from "../lib/store";
import { RARITY_META } from "@shared/gamedata";
import CharacterAvatar from "./CharacterAvatar";

const rarityColor = (r: string) => (RARITY_META as Record<string, { color: string }>)[r]?.color ?? "#9aa4ad";

// The characters a player owns, with Wear/Unequip plus resale (list/delist). Each
// is a cNFT — you can resell it on the marketplace in $RUMBLE (95% to you, 5%
// burned). Shown on the dashboard and in the Marketplace's Characters tab.
export default function OwnedCharactersGrid({ emptyText }: { emptyText?: string }) {
  const owned = useGame((s) => s.snapshot?.characters ?? []);
  const equipCharacter = useGame((s) => s.equipCharacter);
  const sellCharacter = useGame((s) => s.sellCharacter);
  const delistCharacter = useGame((s) => s.delistCharacter);
  const [sellFor, setSellFor] = useState<string | null>(null);
  const [price, setPrice] = useState("");

  if (owned.length === 0) {
    return (
      <div className="rounded-lg border border-parchment-300/10 bg-black/20 p-6 text-center text-sm text-parchment-300/55">
        {emptyText ?? "No characters yet — collect them in the Marketplace, then wear one in the hub."}
      </div>
    );
  }

  const submitSell = (instanceId: string) => {
    const p = Number(price);
    if (!(p > 0)) return;
    sellCharacter(instanceId, p);
    setSellFor(null);
    setPrice("");
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {owned.map((c) => (
        <div key={c.instanceId} className="flex flex-col gap-2 rounded-lg border bg-black/20 p-3" style={{ borderColor: `${rarityColor(c.rarity)}40` }}>
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg" style={{ background: `${c.color}22`, border: `1px solid ${c.color}` }}>
              <CharacterAvatar color={c.color} hat={c.hat} cape={c.cape} size={46} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-parchment-100">
                {c.name} <span className="text-parchment-300/50">#{c.serial}</span>
              </div>
              <div className="text-[10px] capitalize" style={{ color: rarityColor(c.rarity) }}>
                {c.rarity}
                <span className="text-parchment-300/55">{c.onChain ? " · on-chain cNFT" : " · cNFT pending"}</span>
                {c.equipped && <span className="text-emerald-300"> · worn</span>}
                {c.listed && <span className="text-amber-300"> · listed for sale</span>}
              </div>
            </div>
          </div>

          {sellFor === c.instanceId ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-parchment-300/60">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitSell(c.instanceId)}
                  placeholder="Price in USD"
                  className="w-full rounded border border-parchment-300/20 bg-black/40 px-2 py-1 text-sm text-parchment-100 outline-none focus:border-gold/50"
                />
              </div>
              <div className="flex gap-2">
                <button className="btn-gold btn-sm flex-1" onClick={() => submitSell(c.instanceId)}>List</button>
                <button className="btn-ghost btn-sm" onClick={() => { setSellFor(null); setPrice(""); }}>Cancel</button>
              </div>
              <p className="text-[10px] text-parchment-300/40">Settled in $RUMBLE at the live rate · 5% burned, 95% to you</p>
            </div>
          ) : c.listed ? (
            <button className="btn-ghost btn-sm w-full" onClick={() => delistCharacter(c.instanceId)}>Remove listing</button>
          ) : (
            <div className="flex gap-2">
              <button className={`flex-1 btn-sm ${c.equipped ? "btn-ghost" : "btn-gold"}`} onClick={() => equipCharacter(c.instanceId)}>
                {c.equipped ? "Unequip" : "Wear"}
              </button>
              <button className="btn-ghost btn-sm" onClick={() => { setSellFor(c.instanceId); setPrice(""); }}>Sell</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
