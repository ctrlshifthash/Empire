import { useGame } from "../lib/store";
import { RARITY_META } from "@shared/gamedata";
import CharacterAvatar from "./CharacterAvatar";

const rarityColor = (r: string) => (RARITY_META as Record<string, { color: string }>)[r]?.color ?? "#9aa4ad";

// The characters a player owns, with a Wear/Unequip toggle. Collect as many as
// you like; wearing one sets your hub-avatar look. Shown on the dashboard and in
// the Marketplace's Characters tab.
export default function OwnedCharactersGrid({ emptyText }: { emptyText?: string }) {
  const owned = useGame((s) => s.snapshot?.characters ?? []);
  const equipCharacter = useGame((s) => s.equipCharacter);

  if (owned.length === 0) {
    return (
      <div className="rounded-lg border border-parchment-300/10 bg-black/20 p-6 text-center text-sm text-parchment-300/55">
        {emptyText ?? "No characters yet — collect them in the Marketplace, then wear one in the hub."}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {owned.map((c) => (
        <div key={c.instanceId} className="flex items-center gap-3 rounded-lg border bg-black/20 p-3" style={{ borderColor: `${rarityColor(c.rarity)}40` }}>
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
            </div>
          </div>
          <button className={c.equipped ? "btn-ghost btn-sm" : "btn-gold btn-sm"} onClick={() => equipCharacter(c.instanceId)}>
            {c.equipped ? "Unequip" : "Wear"}
          </button>
        </div>
      ))}
    </div>
  );
}
