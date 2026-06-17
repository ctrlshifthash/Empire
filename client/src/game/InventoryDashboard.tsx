import { Link } from "react-router-dom";
import { RARITY_META, EQUIP_SLOTS, RELIC_CAP } from "@shared/gamedata";
import { marketItem } from "@shared/gamedata";
import { useGame } from "../lib/store";

const rarityColor = (r: string) => (RARITY_META as Record<string, { color: string }>)[r]?.color ?? "#9aa4ad";
const fmtN = (n: number, d = 3) => (n || 0).toLocaleString("en-US", { maximumFractionDigits: d });

export default function InventoryDashboard() {
  const inventory = useGame((s) => s.snapshot?.inventory ?? []);
  const stats = useGame((s) => s.snapshot?.empire?.marketStats);
  const equippedCount = inventory.filter((i) => i.equipped).length;

  const netSol = (stats?.earned.SOL ?? 0) - (stats?.spent.SOL ?? 0);
  const netUsdc = (stats?.earned.USDC ?? 0) - (stats?.spent.USDC ?? 0);

  return (
    <div className="mt-6 rounded-2xl border border-parchment-300/10 bg-ink-800/60 p-5 shadow-panel">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-gold-gradient">Relics &amp; trading</h2>
        <Link to="/market" className="btn-ghost btn-sm">Open market</Link>
      </div>

      {/* trading stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Relics held" value={`${inventory.length}/${RELIC_CAP}`} />
        <Stat label="Equipped" value={`${equippedCount}/${EQUIP_SLOTS}`} />
        <Stat label="Bought" value={String(stats?.bought ?? 0)} />
        <Stat label="Sold" value={String(stats?.sold ?? 0)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-parchment-300/10 bg-black/20 p-3">
          <div className="text-[11px] text-parchment-300/55">Net P/L · SOL</div>
          <div className={`font-display text-lg font-bold ${netSol >= 0 ? "text-emerald-400" : "text-blood-light"}`}>
            {netSol >= 0 ? "+" : ""}{fmtN(netSol, 4)} SOL
          </div>
          <div className="text-[10px] text-parchment-300/45">earned {fmtN(stats?.earned.SOL ?? 0, 3)} · spent {fmtN(stats?.spent.SOL ?? 0, 3)}</div>
        </div>
        <div className="rounded-lg border border-parchment-300/10 bg-black/20 p-3">
          <div className="text-[11px] text-parchment-300/55">Net P/L · USDC</div>
          <div className={`font-display text-lg font-bold ${netUsdc >= 0 ? "text-emerald-400" : "text-blood-light"}`}>
            {netUsdc >= 0 ? "+" : ""}{fmtN(netUsdc, 2)} USDC
          </div>
          <div className="text-[10px] text-parchment-300/45">earned {fmtN(stats?.earned.USDC ?? 0, 2)} · spent {fmtN(stats?.spent.USDC ?? 0, 2)}</div>
        </div>
      </div>

      {/* inventory grid */}
      <div className="mt-5">
        <div className="mb-2 text-xs uppercase tracking-wider text-parchment-300/55">Your relics</div>
        {inventory.length === 0 ? (
          <div className="rounded-lg border border-parchment-300/10 bg-black/20 p-6 text-center text-sm text-parchment-300/55">
            No relics yet — win tournaments &amp; boss fights, complete quests, or rank up to earn them. Or buy on the{" "}
            <Link to="/market" className="text-gold-light hover:underline">market</Link>.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {inventory.map((it) => {
              const def = marketItem(it.typeId);
              return (
                <div key={it.instanceId} className="flex items-center gap-2.5 rounded-lg border bg-black/20 p-3" style={{ borderColor: `${rarityColor(it.rarity)}40` }}>
                  <span className="text-2xl">{it.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-parchment-100">
                      {it.name} <span className="text-parchment-300/45">#{it.serial}</span>
                    </div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: rarityColor(it.rarity) }}>
                      {it.rarity}{it.equipped && " · equipped"}{it.listed && " · listed"}{!it.equipped && !it.canEquip && ` · 🔒 ${it.reqRank}`}
                    </div>
                    <div className="text-[11px] text-parchment-300/65">{it.effect}{def && def.maxSupply ? ` · ${def.maxSupply} ever` : ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-parchment-300/10 bg-black/20 p-3 text-center">
      <div className="font-display text-xl font-bold text-gold-light">{value}</div>
      <div className="text-[11px] text-parchment-300/55">{label}</div>
    </div>
  );
}
