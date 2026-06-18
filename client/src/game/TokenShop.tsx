import { useEffect, useState } from "react";
import { useWallet as useSolWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { walletReady, useWallet } from "../lib/web3";
import { useGame } from "../lib/store";
import {
  fetchShopConfig,
  buildPaymentTx,
  postPurchase,
  type ShopConfig,
  type ShopItem,
  type ShopCategory,
} from "../lib/shop";

const CATEGORY_META: Record<ShopCategory, { label: string; blurb: string }> = {
  pack: { label: "Resource Packs", blurb: "Instant resources & coins" },
  boost: { label: "Boosts", blurb: "Time-savers & temporary buffs" },
  army: { label: "Armies", blurb: "Instant elite troops" },
  trait: { label: "Exclusive Traits", blurb: "Token-only permanent perks" },
  cosmetic: { label: "Crests", blurb: "Banner heraldry" },
};
const ORDER: ShopCategory[] = ["pack", "boost", "army", "trait", "cosmetic"];

const fmt = (n: number) => n.toLocaleString("en-US");

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-parchment-300/15 bg-black/20 p-6 text-center text-sm text-parchment-300/70">
      {children}
    </div>
  );
}

export default function TokenShop() {
  if (!walletReady) {
    return <Notice>The token shop needs a connected Solana wallet, which isn’t configured on this build yet.</Notice>;
  }
  return <ShopGrid />;
}

function ShopGrid() {
  const address = useWallet((s) => s.address);
  const { setVisible } = useWalletModal();
  const pushToast = useGame((s) => s.pushToast);
  const { publicKey, connected, sendTransaction } = useSolWallet();
  const { connection } = useConnection();

  const [cfg, setCfg] = useState<ShopConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchShopConfig()
      .then((c) => alive && setCfg(c))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  async function buy(item: ShopItem) {
    if (!cfg || !cfg.configured || !cfg.treasury) {
      pushToast({ kind: "warn", text: "Shop isn’t live yet." });
      return;
    }
    if (!connected || !publicKey) {
      pushToast({ kind: "warn", text: "Connect your wallet to buy." });
      setVisible(true);
      return;
    }
    const buyer = publicKey.toBase58();
    setBusy(item.id);
    try {
      const tx = await buildPaymentTx(cfg, buyer, item.price);
      const signature = await sendTransaction(tx, connection);
      pushToast({ kind: "success", text: "Payment sent — confirming…" });
      const res = await postPurchase(buyer, signature, item.id);
      if (res.ok) pushToast({ kind: "success", text: `${item.name} unlocked!` });
      else pushToast({ kind: "warn", text: res.error ?? "Purchase failed." });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      // user closing the wallet popup isn't an error worth shouting about
      if (/disconnect/i.test(msg)) {
        pushToast({ kind: "warn", text: "Wallet disconnected — reconnect and try again." });
        setVisible(true);
      } else if (/reject|denied|cancel|closed/i.test(msg)) pushToast({ kind: "warn", text: "Payment cancelled." });
      else pushToast({ kind: "warn", text: "Couldn’t complete the payment." });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Notice>Loading the shop…</Notice>;
  if (!cfg || !cfg.configured) {
    return <Notice>The token shop isn’t live yet — it opens once the token is configured.</Notice>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3">
        <p className="text-sm text-parchment-200">
          Pay with the project token for boosts, packs &amp; upgrades. Every purchase <strong>burns the token</strong> —
          removed from supply forever, so the shop is deflationary. <span className="text-parchment-300/60">(For scarce, tradeable relics, see the Market.)</span>
        </p>
        {address ? (
          <span className="chip font-mono text-xs">👛 {address.slice(0, 4)}…{address.slice(-4)}</span>
        ) : (
          <button className="btn-gold btn-sm" onClick={() => setVisible(true)}>
            Connect wallet
          </button>
        )}
      </div>

      {ORDER.filter((cat) => cfg.items.some((i) => i.category === cat)).map((cat) => (
        <section key={cat}>
          <div className="mb-2 flex items-baseline gap-2">
            <h3 className="font-display text-lg text-gold-gradient">{CATEGORY_META[cat].label}</h3>
            <span className="text-xs text-parchment-300/50">{CATEGORY_META[cat].blurb}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cfg.items
              .filter((i) => i.category === cat)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col rounded-xl border border-parchment-300/12 bg-black/25 p-4 transition-colors hover:border-gold/35"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="font-semibold text-parchment-100">{item.name}</span>
                  </div>
                  <p className="flex-1 text-sm text-parchment-300/70">{item.desc}</p>
                  <button
                    className="btn-gold btn-sm mt-3 justify-center"
                    disabled={busy !== null}
                    onClick={() => buy(item)}
                  >
                    {busy === item.id ? "Processing…" : `${fmt(item.price)} tokens`}
                  </button>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
