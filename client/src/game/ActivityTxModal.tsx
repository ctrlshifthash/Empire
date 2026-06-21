import { characterType, RARITY_META } from "@shared/gamedata";
import type { MarketActivity } from "@shared/types";

const rarityColor = (r?: string) => (RARITY_META as Record<string, { color: string }>)[r ?? ""]?.color ?? "#9aa4ad";
const short = (w?: string) => (w ? `${w.slice(0, 4)}…${w.slice(-4)}` : "—");
const ago = (at: number) => {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const kindLabel: Record<MarketActivity["kind"], string> = { bought: "Sold", listed: "Listed", sold: "Sold" };

function WalletRow({ label, wallet }: { label: string; wallet: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2">
      <span className="text-parchment-300/55">{label}</span>
      <a href={`https://solscan.io/account/${wallet}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-parchment-100 hover:text-gold-light">
        {short(wallet)} ↗
      </a>
    </div>
  );
}

// Kintara-style transaction popup — click a marketplace activity entry to see the
// NFT that changed hands, the wallets, the amount, and a link to the on-chain tx.
export default function ActivityTxModal({ a, rumbleUsd, onClose, onView }: {
  a: MarketActivity;
  rumbleUsd: number | null;
  onClose: () => void;
  onView?: () => void;
}) {
  const char = a.refType ? characterType(a.refType) : undefined;
  const rumble = a.priceUsd != null && rumbleUsd ? Math.round(a.priceUsd / rumbleUsd) : null;
  const isListed = a.kind === "listed";

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="panel relative w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
        style={{ borderColor: `${rarityColor(char?.rarity)}66` }}
      >
        <button onClick={onClose} className="absolute right-3 top-3 text-lg text-parchment-300/55 hover:text-parchment-100">✕</button>

        {/* artwork */}
        {char?.image ? (
          <img src={char.image} alt={char.name} className="mx-auto h-44 w-44 rounded-xl object-cover" style={{ border: `2px solid ${rarityColor(char.rarity)}` }} />
        ) : (
          <div className="mx-auto grid h-44 w-44 place-items-center rounded-xl bg-black/30 text-5xl" style={{ border: `2px solid ${rarityColor(char?.rarity)}` }}>📜</div>
        )}

        {/* name + rarity + serial */}
        <div className="mt-3 text-center">
          <div className="font-display text-xl font-bold text-parchment-100">
            {char?.name ?? "Marketplace item"}
            {a.serial != null && <span className="text-parchment-300/50"> #{a.serial}</span>}
          </div>
          {char && <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: rarityColor(char.rarity) }}>{char.rarity}</div>}
          {!char && <div className="mt-0.5 truncate px-2 text-xs text-parchment-300/55">{a.text}</div>}
        </div>

        {/* badge + amount */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${isListed ? "bg-sky-400/15 text-sky-300" : "bg-emerald-400/15 text-emerald-300"}`}>
            {kindLabel[a.kind]}
          </span>
          {a.priceUsd != null && <span className="font-display text-xl font-bold text-gold-light">${a.priceUsd.toFixed(2)}</span>}
        </div>
        {rumble != null && <div className="mt-0.5 text-center text-[11px] text-parchment-300/50">≈ {rumble.toLocaleString()} $RUMBLE</div>}

        {/* wallets */}
        <div className="mt-4 space-y-1.5 text-sm">
          {a.fromWallet && <WalletRow label={isListed ? "Lister" : "Seller"} wallet={a.fromWallet} />}
          {a.toWallet && <WalletRow label="Buyer" wallet={a.toWallet} />}
        </div>

        {/* on-chain proof + jump */}
        {a.signature && (
          <a href={`https://solscan.io/tx/${a.signature}`} target="_blank" rel="noreferrer" className="btn-gold btn-sm mt-4 block w-full text-center">
            View transaction ↗
          </a>
        )}
        {onView && (
          <button onClick={onView} className="btn-ghost btn-sm mt-2 w-full">
            {isListed ? "View listing" : "View character"}
          </button>
        )}
        <div className="mt-3 text-center text-[11px] text-parchment-300/40">{ago(a.at)}</div>
      </div>
    </div>
  );
}
