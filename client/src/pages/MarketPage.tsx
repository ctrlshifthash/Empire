import { useEffect, useState } from "react";
import bs58 from "bs58";
import { usePrivy } from "@privy-io/react-auth";
import { useSignAndSendTransaction, useWallets } from "@privy-io/react-auth/solana";
import type { ListingPublic, InventoryItem } from "@shared/types";
import { RARITY_META, MARKET_ITEMS, FUSE_COUNT, FUSE_COINS, CRAFT_COST, RELIC_CAP, nextRarity } from "@shared/gamedata";
import { privyConfigured, useWallet } from "../lib/web3";
import { useGame } from "../lib/store";
import { fetchListings, reserve, buildPaymentTx, postBuy } from "../lib/market";

const rarityColor = (r: string) => (RARITY_META as Record<string, { color: string }>)[r]?.color ?? "#9aa4ad";

export default function MarketPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      <div className="absolute inset-0 bg-grid opacity-10" />
      <div className="container-x relative max-w-5xl py-14">
        <div className="text-center">
          <span className="kicker">🏛️ Player marketplace</span>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
            The <span className="text-gold-gradient">Bazaar</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-parchment-300/70">
            Trade scarce, limited-supply <strong className="text-parchment-200">relics</strong> with other rulers — paid
            wallet-to-wallet in SOL or USDC. Items go straight to your inventory; the coins go straight to the seller.
          </p>
          <div className="mx-auto mt-5 grid max-w-3xl gap-2 text-left text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-parchment-300/12 bg-black/20 p-3">
              <div className="font-semibold text-gold-light">⚔️ Equip for power</div>
              <div className="mt-0.5 text-xs text-parchment-300/65">Wear up to 3 relics for stacking power (→ rank → more SOL), harvest &amp; speed.</div>
            </div>
            <div className="rounded-xl border border-parchment-300/12 bg-black/20 p-3">
              <div className="font-semibold text-gold-light">💰 Or sell for real money</div>
              <div className="mt-0.5 text-xs text-parchment-300/65">Scarce relics hold value — list yours below for SOL or USDC, paid straight to your wallet.</div>
            </div>
            <div className="rounded-xl border border-parchment-300/12 bg-black/20 p-3">
              <div className="font-semibold text-gold-light">🎁 Earned, not bought</div>
              <div className="mt-0.5 text-xs text-parchment-300/65">Relics drop from rank-ups, quests, bosses &amp; tournaments — then trade here. (Boosts &amp; packs are the Token Shop.)</div>
            </div>
          </div>
        </div>
        {privyConfigured ? <Market /> : <p className="mt-10 text-center text-sm text-parchment-300/60">Wallet trading isn’t configured on this build.</p>}
      </div>
    </div>
  );
}

function Market() {
  const address = useWallet((s) => s.address);
  const { login } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const pushToast = useGame((s) => s.pushToast);
  const inventory = useGame((s) => s.snapshot?.inventory ?? []);
  const coins = useGame((s) => s.snapshot?.empire?.coins ?? 0);
  const fuseRelics = useGame((s) => s.fuseRelics);
  const craftRelic = useGame((s) => s.craftRelic);
  const [listings, setListings] = useState<ListingPublic[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => fetchListings().then(setListings);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, []);

  async function buy(l: ListingPublic) {
    if (!address) {
      pushToast({ kind: "warn", text: "Connect a wallet to buy." });
      return;
    }
    const wallet = wallets.find((w) => w.address === address);
    if (!wallet) {
      pushToast({ kind: "warn", text: "Reconnect your wallet and try again." });
      return;
    }
    setBusy(l.id);
    try {
      const r = await reserve(l.id, address);
      if (!r.ok || !r.payment) {
        pushToast({ kind: "warn", text: r.error ?? "Couldn’t reserve." });
        return;
      }
      const tx = await buildPaymentTx(r.payment, address);
      const { signature } = await signAndSendTransaction({ transaction: tx, wallet });
      pushToast({ kind: "success", text: "Payment sent — confirming…" });
      const res = await postBuy(l.id, address, bs58.encode(signature));
      if (res.ok) {
        pushToast({ kind: "success", text: `${l.name} #${l.serial} is yours!` });
        refresh();
      } else {
        pushToast({ kind: "warn", text: res.error ?? "Purchase failed." });
      }
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      pushToast({ kind: "warn", text: /reject|denied|cancel|closed/i.test(msg) ? "Payment cancelled." : "Couldn’t complete the purchase." });
    } finally {
      setBusy(null);
    }
  }

  const spare = inventory.filter((i) => !i.listed && !i.equipped);
  const spareOf = (r: string) => spare.filter((i) => i.rarity === r).length;
  const canCraft = coins >= CRAFT_COST.coins;

  return (
   <>
    <div className="mt-10 grid gap-6 lg:grid-cols-3">
      {/* listings */}
      <div className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">On sale</h2>
          {address ? (
            <span className="chip font-mono text-xs">👛 {address.slice(0, 4)}…{address.slice(-4)}</span>
          ) : (
            <button className="btn-gold btn-sm" onClick={() => login()}>Connect wallet</button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {listings === null && <div className="panel p-8 text-center text-sm text-parchment-300/60">Loading…</div>}
          {listings?.length === 0 && <div className="panel p-8 text-center text-sm text-parchment-300/60">Nothing listed yet. List one from your inventory.</div>}
          {listings?.map((l) => (
            <div key={l.id} className="panel flex flex-col p-4" style={{ borderColor: `${rarityColor(l.rarity)}40` }}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{l.icon}</span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-parchment-100">{l.name} <span className="text-parchment-300/50">#{l.serial}</span></div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: rarityColor(l.rarity) }}>{l.rarity}</div>
                </div>
              </div>
              <div className="mt-1.5 text-xs text-emerald-300/80">{l.effect}</div>
              <div className="mt-1 text-xs text-parchment-300/55">Seller: {l.sellerName}</div>
              <div className="mt-3 flex items-center justify-between">
                <div className="font-display text-lg font-bold text-gold-light">{l.price} {l.currency}</div>
                <button className="btn-gold btn-sm" disabled={busy !== null || l.reserved} onClick={() => buy(l)}>
                  {busy === l.id ? "…" : l.reserved ? "Reserved" : "Buy"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* inventory */}
      <div>
        <h2 className="font-display text-lg font-semibold">
          Your inventory <span className={inventory.length >= RELIC_CAP ? "text-blood-light" : "text-parchment-300/45"}>({inventory.length}/{RELIC_CAP})</span>
        </h2>
        <p className="mb-3 text-xs text-parchment-300/55">
          Hold up to {RELIC_CAP}. {inventory.length >= RELIC_CAP ? "Full — sell or forge to make room. " : ""}Tap <b className="text-parchment-200">Sell</b> to list a relic.
        </p>
        <div className="space-y-2">
          {inventory.length === 0 && <div className="panel p-6 text-center text-sm text-parchment-300/55">No relics yet — win tournaments, bosses &amp; quests, or rank up to earn drops.</div>}
          {inventory.map((it) => <InventoryRow key={it.instanceId} it={it} />)}
        </div>
      </div>
    </div>

    {/* forge + how-to-collect */}
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <div className="panel p-5">
        <div className="font-display text-lg font-bold text-gold-gradient">🔨 The Forge</div>
        <p className="mt-1 text-sm text-parchment-300/65">
          Combine relics into something greater, or craft one from raw materials. Forging <strong>burns</strong> the inputs —
          that's what keeps relics scarce and valuable.
        </p>
        <div className="mt-4 space-y-2">
          {(["common", "rare", "epic"] as const).map((r) => {
            const have = spareOf(r);
            const cost = FUSE_COINS[r] ?? 0;
            const up = nextRarity(r as never);
            const ok = have >= FUSE_COUNT && coins >= cost;
            return (
              <div key={r} className="flex items-center justify-between rounded-lg border border-parchment-300/10 bg-black/20 px-3 py-2">
                <div className="text-sm">
                  <span className="font-semibold capitalize" style={{ color: rarityColor(r) }}>{r}</span>
                  <span className="text-parchment-300/55"> → {up} · you have {have} spare</span>
                  <div className="text-[11px] text-parchment-300/45">Fuse {FUSE_COUNT} · {cost.toLocaleString()} coins</div>
                </div>
                <button className="btn-gold btn-sm" disabled={!ok} onClick={() => fuseRelics(r)}>
                  {have < FUSE_COUNT ? `Need ${FUSE_COUNT}` : coins < cost ? "Need coins" : "Forge"}
                </button>
              </div>
            );
          })}
          <div className="flex items-center justify-between rounded-lg border border-parchment-300/10 bg-black/20 px-3 py-2">
            <div className="text-sm">
              <span className="font-semibold text-parchment-100">Craft from materials</span>
              <div className="text-[11px] text-parchment-300/45">
                {CRAFT_COST.wood.toLocaleString()} of each resource + {CRAFT_COST.coins.toLocaleString()} coins → a common relic
              </div>
            </div>
            <button className="btn-gold btn-sm" disabled={!canCraft} onClick={() => craftRelic()}>Craft</button>
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <div className="font-display text-lg font-bold text-gold-gradient">🎁 How to collect relics</div>
        <ul className="mt-3 space-y-2 text-sm text-parchment-300/80">
          <li>⬆️ <strong>Rank up</strong> — a guaranteed relic every time you reach a new renown rank.</li>
          <li>📜 <strong>Complete quests</strong> — a chance to drop a relic.</li>
          <li>👹 <strong>World Boss</strong> — the top damage dealer can score a relic.</li>
          <li>🏆 <strong>Win tournaments</strong> — the champion gets a relic drop.</li>
          <li>🔨 <strong>Forge &amp; craft</strong> — fuse spares into rarer relics, or craft from materials.</li>
          <li>🏛️ <strong>Buy on the market</strong> — purchase from other players in SOL or USDC.</li>
        </ul>
        <p className="mt-3 text-xs text-parchment-300/50">Equip up to 3 for stacking power, harvest, speed — and the rarest for a SOL-yield boost.</p>
      </div>
    </div>
   </>
  );
}

function InventoryRow({ it }: { it: InventoryItem }) {
  const listItem = useGame((s) => s.listItem);
  const delistItem = useGame((s) => s.delistItem);
  const equipItem = useGame((s) => s.equipItem);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"SOL" | "USDC">("SOL");
  const [selling, setSelling] = useState(false);

  return (
    <div className="panel p-3" style={{ borderColor: `${rarityColor(it.rarity)}40` }}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{it.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-parchment-100">{it.name} <span className="text-parchment-300/50">#{it.serial}</span></div>
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: rarityColor(it.rarity) }}>{it.rarity}{it.equipped && " · equipped"}</div>
          <div className="text-[10px] text-parchment-300/60">{it.effect}</div>
        </div>
        {!it.listed &&
          (it.equipped ? (
            <button className="chip py-0.5 text-[10px]" onClick={() => equipItem(it.instanceId)}>Unequip</button>
          ) : it.canEquip ? (
            <button className="chip py-0.5 text-[10px]" onClick={() => equipItem(it.instanceId)}>Equip</button>
          ) : (
            <button className="chip py-0.5 text-[10px] opacity-50" disabled title={`Reach ${it.reqRank} to equip`}>🔒 {it.reqRank}</button>
          ))}
      </div>
      {it.listed ? (
        <button className="btn-ghost btn-sm mt-2 w-full" onClick={() => delistItem(it.instanceId)}>Listed — withdraw</button>
      ) : selling ? (
        <div className="mt-2 flex items-center gap-1.5">
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" className="w-16 rounded-md border border-parchment-300/15 bg-black/30 px-2 py-1 text-xs focus:outline-none" />
          <select value={currency} onChange={(e) => setCurrency(e.target.value as "SOL" | "USDC")} className="rounded-md border border-parchment-300/15 bg-black/30 px-1 py-1 text-xs">
            <option>SOL</option><option>USDC</option>
          </select>
          <button className="btn-gold btn-sm px-2" disabled={!(Number(price) > 0)} onClick={() => { listItem(it.instanceId, Number(price), currency); setSelling(false); setPrice(""); }}>List</button>
          <button className="chip py-0.5 text-[10px]" onClick={() => setSelling(false)}>✕</button>
        </div>
      ) : (
        <button className="btn-gold btn-sm mt-2 w-full" onClick={() => setSelling(true)}>Sell</button>
      )}
    </div>
  );
}
