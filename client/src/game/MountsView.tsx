import { useEffect } from "react";
import { useGame } from "../lib/store";
import { MOUNTS, RARITY_META } from "@shared/gamedata";
import type { ItemRarity } from "@shared/gamedata";

// Mounts & Pets (beta). Rare drops earned by winning raids — own them, equip one
// beside your hero in the hub. Locked behind the `mounts` beta flag.
export default function MountsView() {
  const state = useGame((s) => s.mountsState);
  const getMounts = useGame((s) => s.getMounts);
  const equipMount = useGame((s) => s.equipMount);

  useEffect(() => {
    getMounts();
    const t = setInterval(getMounts, 6000); // pick up fresh drops
    return () => clearInterval(t);
  }, [getMounts]);

  const locked = state?.locked;
  const owned = state?.mounts ?? [];
  const rar = (r: string) => RARITY_META[r as ItemRarity] ?? { label: r, color: "#888" };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-display text-2xl font-bold text-gold-gradient">Mounts & Pets</h2>
        <span className="rounded-full border border-purple-400/40 bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-200">Beta</span>
      </div>
      <p className="mb-5 text-sm text-parchment-300/65">Rare companions dropped when you win raids. Collect them, equip one beside your hero, and own each as a cNFT.</p>

      {locked && (
        <div className="panel mb-5 grid place-items-center gap-2 p-8 text-center">
          <div className="text-4xl">🔒</div>
          <div className="font-semibold text-parchment-100">In beta — coming soon</div>
          <p className="max-w-sm text-sm text-parchment-300/55">Mounts are built and ready. Drops switch on when this is released.</p>
        </div>
      )}

      {/* your stable */}
      {!locked && (
        <>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-parchment-300/55">Your stable ({owned.length})</h3>
          {owned.length === 0 ? (
            <p className="mb-6 text-sm text-parchment-300/55">No mounts yet — win raids for a chance to drop one.</p>
          ) : (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {owned.map((m) => (
                <div key={m.instanceId} className="panel flex flex-col items-center gap-1 p-3 text-center" style={{ borderColor: `${rar(m.rarity).color}55` }}>
                  <div className="text-4xl">{m.icon}</div>
                  <div className="text-sm font-semibold text-parchment-100">{m.name}</div>
                  <div className="text-[11px]" style={{ color: rar(m.rarity).color }}>{rar(m.rarity).label} · #{m.serial}</div>
                  <button
                    className={m.equipped ? "btn-ghost btn-sm mt-1 w-full" : "btn-gold btn-sm mt-1 w-full"}
                    onClick={() => equipMount(m.instanceId)}
                  >
                    {m.equipped ? "Equipped ✓" : "Equip"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* what can drop */}
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-parchment-300/55">Droppable from raids</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {MOUNTS.map((m) => (
          <div key={m.id} className="panel flex items-center gap-3 p-3" style={{ borderColor: `${rar(m.rarity).color}40` }}>
            <div className="text-3xl">{m.icon}</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-parchment-100">{m.name}</div>
              <div className="text-[11px]" style={{ color: rar(m.rarity).color }}>{rar(m.rarity).label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
