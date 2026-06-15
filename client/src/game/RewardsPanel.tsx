// Token-holder rewards dashboard: connect a wallet, see your holdings, your
// share of supply, your daily SOL from the pool, and claim what's accrued.
// Non-holders see a demo notice (in-game coins are worthless play money).
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { privyConfigured, useWallet } from "../lib/web3";

function short(a: string) {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

// Only rendered when Privy is configured (so it's inside PrivyProvider).
function PrivyConnect() {
  const { login, logout, authenticated } = usePrivy();
  const setAddress = useWallet((s) => s.setAddress);
  return authenticated ? (
    <button
      className="btn-ghost btn-sm"
      onClick={() => {
        logout();
        setAddress(null);
      }}
    >
      Disconnect
    </button>
  ) : (
    <button className="btn-gold" onClick={() => login()}>
      🔗 Connect Wallet
    </button>
  );
}

function ManualConnect() {
  const setAddress = useWallet((s) => s.setAddress);
  const [v, setV] = useState("");
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        value={v}
        onChange={(e) => setV(e.target.value.trim())}
        placeholder="Paste your Solana wallet address"
        className="flex-1 rounded-lg border border-parchment-300/15 bg-black/40 px-3 py-2 text-sm text-parchment-50 placeholder:text-parchment-300/35 focus:border-gold/50 focus:outline-none"
      />
      <button className="btn-gold" disabled={v.length < 32} onClick={() => setAddress(v)}>
        🔗 Connect
      </button>
    </div>
  );
}

export default function RewardsPanel() {
  const { address, status, setAddress, refresh, claim, loading } = useWallet();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    refresh();
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  const holds = (status?.holdings.balance ?? 0) > 0;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl border border-gold/25 bg-gradient-to-b from-gold/10 to-transparent p-4">
        <div className="font-display text-xl font-bold text-gold-light">💰 Token Rewards</div>
        <p className="text-sm text-parchment-300/70">
          A daily pool of <b className="text-gold-light">{status?.pool ?? 1} SOL</b> is shared among token holders —
          the more you hold, the bigger your share and multiplier. Claim your accrued SOL any time.
        </p>
      </div>

      {!address ? (
        <div className="panel p-5">
          <div className="mb-3 text-sm text-parchment-300/75">Connect your Solana wallet to see your rewards.</div>
          {privyConfigured ? <PrivyConnect /> : <ManualConnect />}
          {!privyConfigured && (
            <p className="mt-2 text-[11px] text-parchment-300/45">
              Privy one-click connect activates once VITE_PRIVY_APP_ID is set; until then, paste your address.
            </p>
          )}
        </div>
      ) : (
        <div className="panel space-y-4 p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-parchment-100">👛 {short(address)}</span>
            <button className="text-xs text-parchment-300/50 hover:text-parchment-100" onClick={() => setAddress(null)}>
              Disconnect
            </button>
          </div>

          {!status?.configured ? (
            <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-sm text-parchment-200">
              ⏳ Rewards go live when the token launches. You're playing the <b>demo world</b> — in-game coins are just
              play money for now.
            </div>
          ) : !holds ? (
            <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-sm text-parchment-200">
              🎮 <b>Demo mode.</b> You don't hold the token, so you earn no SOL. Buy and hold the token to start earning
              real rewards from the daily pool.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Your holdings" value={fmt(status!.holdings.balance)} />
                <Stat label="% of supply" value={`${(status!.holdings.sharePct * 100).toFixed(3)}%`} />
                <Stat label="Multiplier" value={`${status!.multiplier.toFixed(2)}×`} gold />
                <Stat label="Daily" value={`${status!.dailySol.toFixed(4)} SOL`} gold />
                <Stat label="Claimable now" value={`${status!.claimableSol.toFixed(5)} SOL`} gold />
                <Stat label="Total claimed" value={`${status!.totalClaimedSol.toFixed(4)} SOL`} />
              </div>
              <button
                className="btn-gold w-full"
                disabled={loading || status!.claimableSol < 0.000001}
                onClick={async () => {
                  setMsg(null);
                  const r = await claim();
                  setMsg(r.ok ? `✅ Claimed ${r.claimedSol?.toFixed(5)} SOL` : `⚠️ ${r.error}`);
                }}
              >
                {status!.payouts ? "💸 Claim Rewards" : "Claim (payouts go live with the treasury)"}
              </button>
              {msg && <div className="text-center text-sm text-parchment-200">{msg}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-lg bg-black/25 px-3 py-2">
      <div className="text-[11px] text-parchment-300/55">{label}</div>
      <div className={`font-semibold tabular-nums ${gold ? "text-gold-light" : "text-parchment-100"}`}>{value}</div>
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString();
}
