import { useEffect, useState } from "react";
import { useWallet as useSolWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { CoinListingPublic } from "@shared/types";
import { useWallet } from "../lib/web3";
import { useGame } from "../lib/store";
import { fetchCoinListings, fetchExchangeConfig, reserveCoin, buildExchangeTx, postBuyCoins, type ExchangeConfig } from "../lib/exchange";
import MarketActivity from "./MarketActivity";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const fmtRumble = (n: number) => Math.round(n).toLocaleString("en-US");

// Sell in-game coins for the $RUMBLE token (or buy coins with it). Priced in USD
// (stable), settled in $RUMBLE at the live token price — Kintara's model. The
// grind → token cash-out; then one tap to SOL on Jupiter.
export default function CoinExchange() {
  const address = useWallet((s) => s.address);
  const { setVisible } = useWalletModal();
  const { publicKey, connected, sendTransaction } = useSolWallet();
  const { connection } = useConnection();
  const pushToast = useGame((s) => s.pushToast);
  const coins = useGame((s) => s.snapshot?.empire?.coins ?? 0);
  const listCoins = useGame((s) => s.listCoins);
  const delistCoins = useGame((s) => s.delistCoins);
  const myEmpireName = useGame((s) => s.snapshot?.empire?.name);

  const [listings, setListings] = useState<CoinListingPublic[] | null>(null);
  const [cfg, setCfg] = useState<ExchangeConfig | null>(null);
  const [coinAmount, setCoinAmount] = useState("");
  const [usd, setUsd] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    fetchCoinListings().then(setListings);
    fetchExchangeConfig().then(setCfg);
  };
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, []);

  const rumbleUsd = cfg?.rumbleUsd ?? null;
  const toRumble = (usdPrice: number) => (rumbleUsd && rumbleUsd > 0 ? usdPrice / rumbleUsd : null);
  const jupUrl = cfg?.mint ? `https://jup.ag/swap/${cfg.mint}-SOL` : "https://jup.ag/swap/SOL-USDC";

  async function buy(l: CoinListingPublic) {
    if (!connected || !publicKey) {
      pushToast({ kind: "warn", text: "Connect your wallet to buy." });
      setVisible(true);
      return;
    }
    const buyer = publicKey.toBase58();
    setBusy(l.id);
    try {
      const r = await reserveCoin(l.id, buyer);
      if (!r.ok || !r.payment) return pushToast({ kind: "warn", text: r.error ?? "Couldn't reserve." });
      const tx = await buildExchangeTx(r.payment, buyer);
      const signature = await sendTransaction(tx, connection);
      pushToast({ kind: "success", text: "Payment sent — confirming…" });
      const res = await postBuyCoins(l.id, buyer, signature);
      if (res.ok) {
        pushToast({ kind: "success", text: `Bought ${fmt(l.coinAmount)} coins!` });
        refresh();
      } else pushToast({ kind: "warn", text: res.error ?? "Purchase failed." });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      console.error("[exchange buy] failed:", e);
      if (/disconnect|not connected|wallet not/i.test(msg)) {
        pushToast({ kind: "warn", text: "Wallet not connected — reconnect and try again." });
        setVisible(true);
      } else if (/reject|denied|cancel|closed|user rejected/i.test(msg)) {
        pushToast({ kind: "warn", text: "Payment cancelled." });
      } else {
        pushToast({ kind: "warn", text: msg.slice(0, 160) || "Couldn't complete the purchase." });
      }
    } finally {
      setBusy(null);
    }
  }

  const previewRumble = Number(usd) > 0 ? toRumble(Number(usd)) : null;

  return (
   <>
    <div className="mt-10 grid gap-6 lg:grid-cols-5">
      {/* sell coins for $RUMBLE */}
      <div className="lg:col-span-2">
        <div className="panel p-5">
          <div className="font-display text-lg font-bold text-gold-gradient">💱 Cash out coins → $RUMBLE</div>
          <p className="mt-1 text-sm text-parchment-300/65">
            Sell the coins you grind. You set a <b className="text-gold-light">USD price</b>; it's paid to your wallet in
            $RUMBLE at the live price (5% burned). You have <b className="text-gold-light">{fmt(coins)}</b> coins.
          </p>
          <label className="mt-3 block text-xs text-parchment-300/55">Coins to sell</label>
          <input value={coinAmount} onChange={(e) => setCoinAmount(e.target.value)} placeholder="e.g. 50000" className="mt-1 w-full rounded-lg border border-parchment-300/15 bg-black/30 px-3 py-2 text-sm focus:border-gold/40 focus:outline-none" />
          <label className="mt-3 block text-xs text-parchment-300/55">Your price (USD)</label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-parchment-300/50">$</span>
            <input value={usd} onChange={(e) => setUsd(e.target.value)} placeholder="e.g. 2.50" inputMode="decimal" className="w-full rounded-lg border border-parchment-300/15 bg-black/30 py-2 pl-6 pr-3 text-sm focus:border-gold/40 focus:outline-none" />
          </div>
          {previewRumble != null && (
            <p className="mt-1 text-[11px] text-parchment-300/55">≈ <b className="text-gold-light">{fmtRumble(previewRumble)} $RUMBLE</b> at the current price</p>
          )}
          <button
            className="btn-gold btn-sm mt-3 w-full justify-center"
            disabled={!(Number(coinAmount) > 0) || Number(coinAmount) > coins || !(Number(usd) > 0)}
            onClick={() => {
              listCoins(Math.floor(Number(coinAmount)), Number(usd));
              setCoinAmount("");
              setUsd("");
            }}
          >
            List coins for sale
          </button>
          {Number(coinAmount) > coins && <p className="mt-1 text-center text-[11px] text-blood-light">You don't have that many coins.</p>}

          {/* one-tap cash out to SOL */}
          <div className="mt-4 border-t border-parchment-300/10 pt-3">
            <p className="text-[11px] text-parchment-300/55">Already holding $RUMBLE? Turn it into SOL in one tap.</p>
            <a href={jupUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm mt-2 flex w-full items-center justify-center">
              ◎ Cash out $RUMBLE → SOL
            </a>
          </div>
        </div>
      </div>

      {/* buy coins with $RUMBLE */}
      <div className="lg:col-span-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">
            Coins for sale
            {rumbleUsd ? <span className="ml-2 text-xs font-normal text-parchment-300/45">$RUMBLE ≈ ${rumbleUsd.toFixed(6)}</span> : null}
          </h3>
          {!address && <button className="btn-gold btn-sm" onClick={() => setVisible(true)}>Connect wallet</button>}
        </div>
        <div className="space-y-2">
          {listings === null && <div className="panel p-8 text-center text-sm text-parchment-300/60">Loading…</div>}
          {listings?.length === 0 && <div className="panel p-8 text-center text-sm text-parchment-300/60">No coins listed yet. List some on the left to cash out.</div>}
          {listings?.map((l) => {
            const mine = l.sellerName === myEmpireName;
            const rumble = toRumble(l.usdPrice);
            const per1k = (l.usdPrice / l.coinAmount) * 1000;
            return (
              <div key={l.id} className="panel flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-parchment-100">🪙 {fmt(l.coinAmount)} coins</div>
                  <div className="text-xs text-parchment-300/55">${per1k.toFixed(3)} / 1k · seller {l.sellerName}{mine && " (you)"}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-bold text-gold-light">${l.usdPrice.toFixed(2)}</div>
                  <div className="text-[10px] text-parchment-300/50">{rumble != null ? `≈ ${fmtRumble(rumble)} $RUMBLE` : "$RUMBLE"}</div>
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
    <div className="mt-6">
      <MarketActivity category="coin" />
    </div>
   </>
  );
}
