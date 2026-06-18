import { useEffect, useState } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { PollResult } from "@shared/types";
import { walletReady, useWallet } from "../lib/web3";
import { fetchPolls, castVote } from "../lib/governance";
import { useGame } from "../lib/store";
import { fmt } from "../lib/format";

function timeLeft(endsAt: number): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return "closed";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
}

export default function GovernancePage() {
  const address = useWallet((s) => s.address);
  const status = useWallet((s) => s.status);
  const refresh = useWallet((s) => s.refresh);
  const { setVisible } = useWalletModal();
  const pushToast = useGame((s) => s.pushToast);
  const [polls, setPolls] = useState<PollResult[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => fetchPolls(address).then(setPolls);
  useEffect(() => {
    load();
    if (address) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const power = status?.holdings?.balance ?? 0;

  async function vote(pollId: string, optionId: string) {
    if (!address) {
      pushToast({ kind: "warn", text: "Connect a wallet to vote." });
      return;
    }
    setBusy(optionId);
    const r = await castVote(pollId, address, optionId);
    if (r.ok) {
      pushToast({ kind: "success", text: "Vote cast!" });
      await load();
    } else {
      pushToast({ kind: "warn", text: r.error ?? "Couldn't vote." });
    }
    setBusy(null);
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      <div className="absolute inset-0 bg-grid opacity-15" />
      <div className="container-x relative py-16">
        <div className="text-center">
          <span className="kicker">🗳️ Token holder governance</span>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
            Shape the <span className="text-gold-gradient">Realm</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-parchment-300/70">
            Token holders steer what comes next. Your vote is weighted by how much of the token you
            hold — the realm builds what its people choose.
          </p>
          <div className="mt-5 inline-flex items-center gap-3 rounded-xl border border-gold/20 bg-gold/5 px-4 py-2 text-sm">
            {address ? (
              <span>
                Your voting power:{" "}
                <span className="font-display font-bold text-gold-light">{fmt(Math.round(power))}</span> tokens
              </span>
            ) : (
              <>
                <span className="text-parchment-300/70">Connect a wallet to vote</span>
                {walletReady && (
                  <button className="btn-gold btn-sm" onClick={() => setVisible(true)}>
                    Connect
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-2xl space-y-6">
          {polls === null && <div className="panel p-10 text-center text-sm text-parchment-300/60">Loading polls…</div>}
          {polls?.length === 0 && (
            <div className="panel p-10 text-center text-sm text-parchment-300/60">No polls open right now.</div>
          )}
          {polls?.map((p) => {
            const open = p.status === "open" && p.endsAt > Date.now();
            return (
              <div key={p.id} className="panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-lg font-bold text-parchment-100">{p.question}</h2>
                  <span className={`shrink-0 chip py-0.5 text-[11px] ${open ? "text-emerald-300" : "text-parchment-300/50"}`}>
                    {open ? timeLeft(p.endsAt) : "closed"}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {p.options.map((o) => {
                    const mine = p.yourVote === o.id;
                    return (
                      <button
                        key={o.id}
                        disabled={!open || busy !== null}
                        onClick={() => vote(p.id, o.id)}
                        className={`relative w-full overflow-hidden rounded-lg border px-4 py-3 text-left transition-colors ${
                          mine ? "border-gold/50 bg-gold/5" : "border-parchment-300/12 hover:border-gold/30"
                        } ${open ? "cursor-pointer" : "cursor-default"}`}
                      >
                        {/* weighted result bar */}
                        <div
                          className="absolute inset-y-0 left-0 bg-gold/10"
                          style={{ width: `${o.pct}%` }}
                        />
                        <div className="relative flex items-center justify-between">
                          <span className="text-sm font-medium text-parchment-100">
                            {o.label} {mine && <span className="text-gold-light">✓ your vote</span>}
                          </span>
                          <span className="text-sm font-semibold text-gold-light">{o.pct.toFixed(1)}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 text-[11px] text-parchment-300/50">
                  {p.totalVoters} {p.totalVoters === 1 ? "voter" : "voters"} · {fmt(Math.round(p.totalWeight))} tokens voted
                  {open && address && " · tap an option to vote or change your vote"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
