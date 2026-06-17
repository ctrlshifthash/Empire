import { useEffect, useState } from "react";
import bs58 from "bs58";
import { usePrivy } from "@privy-io/react-auth";
import { useSignAndSendTransaction, useWallets } from "@privy-io/react-auth/solana";
import type { CoinListingPublic } from "@shared/types";
import { useWallet } from "../lib/web3";
import { useGame } from "../lib/store";
import { fetchCoinListings, reserveCoin, buildExchangeTx, postBuyCoins } from "../lib/exchange";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");

// Sell in-game coins for the $RUMBLE token (or buy coins with it). The grind →
// token cash-out: turn the coins you farm into the project token, P2P.
export default function CoinExchange() {
  const address = useWallet((s) => s.address);
  const { login } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const pushToast = useGame((s) => s.pushToast);
  const coins = useGame((s) => s.snapshot?.empire?.coins ?? 0);
  const listCoins = useGame((s) => s.listCoins);
  const delistCoins = useGame((s) => s.delistCoins);
  const myEmpireName = useGame((s) => s.snapshot?.empire?.name);

  const [listings, setListings] = useState<CoinListingPublic[] | null>(null);
  const [coinAmount, setCoinAmount] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => fetchCoinListings().then(setListings);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, []);

  async function buy(l: CoinListingPublic) {
    if (!address) return pushToast({ kind: "warn", text: "Connect a wallet to buy." });
    const wallet = wallets.find((w) => w.address === address);
    if (!wallet) return pushToast({ kind: "warn", text: "Reconnect your wallet and try again." });
    setBusy(l.id);
    try {
      const r = await reserveCoin(l.id, address);
      if (!r.ok || !r.payment) return pushToast({ kind: "warn", text: r.error ?? "Couldn't reserve." });
      const tx = await buildExchangeTx(r.payment, address);
      const { signature } = await signAndSendTransaction({ transaction: tx, wallet });
      pushToast({ kind: "success", text: "Payment sent — confirming…" });
      const res = await postBuyCoins(l.id, address, bs58.encode(signature));
      if (res.ok) {
        pushToast({ kind: "success", text: `Bought ${fmt(l.coinAmount)} coins!` });
        refresh();
      } else pushToast({ kind: "warn", text: res.error ?? "Purchase failed." });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      pushToast({ kind: "warn", text: /reject|denied|cancel|closed/i.test(msg) ? "Payment cancelled." : "Couldn't complete the purchase." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-5">
      {/* sell coins for $RUMBLE */}
      <div className="lg:col-span-2">
        <div className="panel p-5">
          <div className="font-display text-lg font-bold text-gold-gradient">💱 Cash out coins → $RUMBLE</div>
          <p className="mt-1 text-sm text-parchment-300/65">
            Sell the coins you grind for the project token, paid straight to your wallet. A 5% fee is burned. You have{" "}
            <b className="text-gold-light">{fmt(coins)}</b> coins.
          </p>
          <label className="mt-3 block text-xs text-parchment-300/55">Coins to sell</label>
          <input value={coinAmount} onChange={(e) => setCoinAmount(e.target.value)} placeholder="e.g. 50000" className="mt-1 w-full rounded-lg border border-parchment-300/15 bg-black/30 px-3 py-2 text-sm focus:border-gold/40 focus:outline-none" />
          <label className="mt-3 block text-xs text-parchment-300/55">Price ($RUMBLE)</label>
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 1000" className="mt-1 w-full rounded-lg border border-parchment-300/15 bg-black/30 px-3 py-2 text-sm focus:border-gold/40 focus:outline-none" />
          <button
            className="btn-gold btn-sm mt-3 w-full justify-center"
            disabled={!(Number(coinAmount) > 0) || Number(coinAmount) > coins || !(Number(price) > 0)}
            onClick={() => {
              listCoins(Math.floor(Number(coinAmount)), Math.floor(Number(price)));
              setCoinAmount("");
              setPrice("");
            }}
          >
            List coins for sale
          </button>
          {Number(coinAmount) > coins && <p className="mt-1 text-center text-[11px] text-blood-light">You don't have that many coins.</p>}
        </div>
      </div>

      {/* buy coins with $RUMBLE */}
      <div className="lg:col-span-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Coins for sale</h3>
          {!address && <button className="btn-gold btn-sm" onClick={() => login()}>Connect wallet</button>}
        </div>
        <div className="space-y-2">
          {listings === null && <div className="panel p-8 text-center text-sm text-parchment-300/60">Loading…</div>}
          {listings?.length === 0 && <div className="panel p-8 text-center text-sm text-parchment-300/60">No coins listed yet. List some on the left to cash out.</div>}
          {listings?.map((l) => {
            const mine = l.sellerName === myEmpireName;
            const per1k = (l.rumblePrice / l.coinAmount) * 1000;
            return (
              <div key={l.id} className="panel flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-parchment-100">🪙 {fmt(l.coinAmount)} coins</div>
                  <div className="text-xs text-parchment-300/55">{per1k.toFixed(1)} $RUMBLE / 1k · seller {l.sellerName}{mine && " (you)"}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-bold text-gold-light">{fmt(l.rumblePrice)}</div>
                  <div className="text-[10px] text-parchment-300/50">$RUMBLE</div>
                </div>
                {mine ? (
                  <button className="btn-ghost btn-sm" onClick={() => delistCoins(l.id)}>Withdraw</button>
                ) : (
                  <button className="btn-gold btn-sm" disabled={busy !== null || l.reserved} onClick={() => buy(l)}>
                    {busy === l.id ? "…" : l.reserved ? "Reserved" : "Buy"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
