// Player dashboard: empire stats (rank, power, battles, conquests, time played)
// alongside the Solana token-rewards panel — holdings, what's earned, what's
// claimable, and a Claim button (first claim anytime, then every 6 hours).
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { privyConfigured, useWallet } from "../lib/web3";
import { useGame } from "../lib/store";
import { AGES, rankForPower, nextRank, REWARD_TIERS, rewardTier, holderPerksForTier } from "@shared/gamedata";
import type { BattleReport } from "@shared/types";

function short(a: string) {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

function fmtSol(n: number, dp = 5): string {
  return `${(n || 0).toFixed(dp)} SOL`;
}

function fmtNum(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return Math.round(n).toLocaleString();
}

// "3d 4h", "5h 12m", "8m", "now"
function fmtDuration(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// Only rendered when Privy is configured (so it's inside PrivyProvider).
function PrivyConnect() {
  const { login, logout, authenticated } = usePrivy();
  const setAddress = useWallet((s) => s.setAddress);
  return authenticated ? (
    <button
      className="text-xs text-parchment-300/50 hover:text-parchment-100"
      onClick={() => {
        logout();
        setAddress(null);
      }}
    >
      Disconnect
    </button>
  ) : (
    <button className="btn-gold btn-sm" onClick={() => login()}>
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
        Connect
      </button>
    </div>
  );
}

export default function RewardsPanel() {
  const { address, status, setAddress, refresh, claim, loading } = useWallet();
  const empire = useGame((s) => s.snapshot?.empire);
  const serverTime = useGame((s) => s.snapshot?.serverTime);
  const demo = useGame((s) => s.user?.demo);
  const [msg, setMsg] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    if (!address) return;
    refresh();
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  // local 1s ticker so the cooldown + time-played read live
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── derived empire stats ─────────────────────────────────────────────────
  const power = empire?.power ?? 0;
  const rank = rankForPower(power);
  const nrank = nextRank(power);
  const rankProgress = nrank ? Math.min(1, (power - rank.minPower) / (nrank.minPower - rank.minPower)) : 1;
  const raidsWon = empire?.raidsWon ?? 0;
  const raidsLost = empire?.raidsLost ?? 0;
  const totalRaids = raidsWon + raidsLost;
  const winRate = totalRaids ? Math.round((raidsWon / totalRaids) * 100) : 0;
  const battles: BattleReport[] = empire?.battles ?? [];
  const razed = battles.reduce(
    (s, b) => s + (b.role === "attacker" && b.attackerWon ? b.razed?.length ?? 0 : 0),
    0,
  );
  const goldLooted = battles.reduce(
    (s, b) => s + (b.role === "attacker" && b.attackerWon ? b.loot?.gold ?? 0 : 0),
    0,
  );
  const armySize = empire ? Object.values(empire.army).reduce((s, n) => s + (n || 0), 0) : 0;
  const ageName = empire ? AGES[empire.age].name : "—";
  const playedMs = empire ? Math.max(0, (serverTime ?? nowTs) - empire.createdAt) : 0;

  // ── derived reward state ─────────────────────────────────────────────────
  const holds = (status?.holdings.balance ?? 0) > 0;
  const cooldownLeft = status?.nextClaimAt ? Math.max(0, status.nextClaimAt - nowTs) : 0;
  const onCooldown = cooldownLeft > 0;
  const hasClaimable = (status?.claimableSol ?? 0) >= 0.000001;
  const isMainnet = (status?.network ?? "mainnet-beta") === "mainnet-beta";

  async function doClaim() {
    setMsg(null);
    const r = await claim();
    setMsg(r.ok ? `✅ Claimed ${r.claimedSol?.toFixed(5)} SOL` : `⚠️ ${r.error}`);
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* ── Header: identity + wallet + network ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-2xl font-bold text-gold-light">
            📊 {empire?.name ?? "Your Dashboard"}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-sm">
            <span className="rounded-full bg-gold/15 px-2 py-0.5 font-semibold text-gold-light">⚜ {rank.name}</span>
            {demo && (
              <span className="rounded-full bg-parchment-300/10 px-2 py-0.5 text-[11px] text-parchment-300/70">
                Demo empire
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isMainnet ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isMainnet ? "bg-emerald-400" : "bg-amber-400"}`} />
            Solana {isMainnet ? "Mainnet" : status?.network}
          </span>
          {address ? (
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs text-parchment-100">👛 {short(address)}</span>
              <button
                className="text-[11px] text-parchment-300/50 hover:text-parchment-100"
                onClick={() => setAddress(null)}
              >
                Disconnect
              </button>
            </span>
          ) : privyConfigured ? (
            <PrivyConnect />
          ) : null}
        </div>
      </div>

      {/* ── Rewards: connect, or holdings + claim ── */}
      {!address ? (
        <div className="panel p-5">
          <div className="mb-3 text-sm text-parchment-300/75">
            Connect your Solana wallet to track holdings and claim SOL rewards.
          </div>
          {privyConfigured ? <PrivyConnect /> : <ManualConnect />}
        </div>
      ) : (
        <div className="rounded-xl border border-gold/25 bg-gradient-to-b from-gold/10 to-transparent p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <BigStat label="Claimable now" value={fmtSol(status?.claimableSol ?? 0)} gold />
            <BigStat label="Total earned" value={fmtSol(status?.totalClaimedSol ?? 0, 4)} />
            <BigStat label="Daily rate" value={fmtSol(status?.dailySol ?? 0, 4)} />
            <BigStat
              label="Boost tier"
              value={holds ? `${status?.tier} ${(status?.multiplier ?? 1).toFixed(2)}×` : "—"}
              color={holds ? status?.tierColor : undefined}
              gold
            />
          </div>

          {status?.configured && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-parchment-300/60">
                <span>Today’s shared pool (everyone)</span>
                <span>
                  <b className="text-gold-light">{(status.poolRemaining ?? 0).toFixed(3)}</b> / {status.pool} SOL left
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold-light"
                  style={{
                    width: `${Math.max(0, Math.min(1, (status.poolRemaining ?? 0) / (status.pool || 1))) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {status?.configured && holds && (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-parchment-300/70">
              <span>
                Holdings: <b className="text-parchment-100">{fmtNum(status.holdings.balance)}</b>
              </span>
              <span>
                Share of supply: <b className="text-parchment-100">{(status.holdings.sharePct * 100).toFixed(3)}%</b>
              </span>
              <span>
                Play bonus:{" "}
                <b className="text-gold-light">{(status.playBonus ?? 1).toFixed(2)}×</b>{" "}
                <span className="text-parchment-300/55">({status.playRank})</span>
              </span>
              <span title="Hold without selling to grow this. Selling resets it.">
                💎 Diamond hands:{" "}
                <b className="text-gold-light">{(status.loyaltyMult ?? 1).toFixed(2)}×</b>{" "}
                <span className="text-parchment-300/55">({Math.floor(status.loyaltyDays ?? 0)}d held)</span>
              </span>
              {(status.relicBoost ?? 1) > 1 && (
                <span title="Boost from equipped marketplace relics.">
                  🏺 Relic boost: <b className="text-gold-light">{(status.relicBoost ?? 1).toFixed(2)}×</b>
                </span>
              )}
              {holds && (
                <span title="In-game perks from your holder tier, applied to your empire.">
                  🏰 Holder perks:{" "}
                  <b className="text-gold-light">
                    +{Math.round(holderPerksForTier(status.tier).gatherPct * 100)}% gather
                  </b>
                  <span className="text-parchment-300/55">
                    {" "}· +{Math.round(holderPerksForTier(status.tier).speedPct * 100)}% build/train speed
                  </span>
                </span>
              )}
              <span>
                Claims made: <b className="text-parchment-100">{status.claimCount}</b>
              </span>
            </div>
          )}

          {/* claim button / state notices */}
          <div className="mt-3">
            {!status?.configured ? (
              <Notice>
                ⏳ Rewards go live when the token launches. You’re in the <b>demo world</b> — in-game coins are play
                money for now, but your empire progress below is real.
              </Notice>
            ) : !holds ? (
              <Notice>
                🎮 You don’t hold the token yet, so you earn no SOL. Buy &amp; hold to start earning from the daily
                pool — bigger holders get a bigger multiplier.
              </Notice>
            ) : (
              <>
                <button className="btn-gold w-full" disabled={loading || onCooldown || !hasClaimable} onClick={doClaim}>
                  {onCooldown
                    ? `⏳ Next claim in ${fmtDuration(cooldownLeft)}`
                    : !hasClaimable
                      ? "Nothing to claim yet — let it accrue"
                      : status?.payouts
                        ? `💸 Claim ${fmtSol(status?.claimableSol ?? 0)}`
                        : "Claim (payouts go live with the treasury)"}
                </button>
                <p className="mt-1.5 text-center text-[11px] text-parchment-300/45">
                  {status.claimCount === 0
                    ? "Your first claim is available any time. After that you can claim every 6 hours."
                    : "You can claim every 6 hours (4× a day). Rewards keep accruing in between."}
                </p>
              </>
            )}
            {msg && <div className="mt-2 text-center text-sm text-parchment-200">{msg}</div>}
          </div>

          <TierLadder share={status?.holdings.sharePct ?? 0} holds={holds} />
        </div>
      )}

      {/* ── Empire stats — always shown while in-game ── */}
      {empire && (
        <div className="panel space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold uppercase tracking-wider text-parchment-300/70">⚔ Empire Record</div>
            <div className="text-xs text-parchment-300/55">{ageName}</div>
          </div>

          {/* rank progress */}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-gold-light">⚜ {rank.name}</span>
              <span className="text-parchment-300/55">
                {nrank ? `${fmtNum(power)} / ${fmtNum(nrank.minPower)} → ${nrank.name}` : "Max rank"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/40">
              <div className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold-light" style={{ width: `${rankProgress * 100}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Power" value={fmtNum(power)} gold />
            <Stat label="Harvest bonus" value={`${rank.gatherMult.toFixed(2)}×`} />
            <Stat label="Time played" value={fmtDuration(playedMs)} />
            <Stat label="Army size" value={fmtNum(armySize)} />
            <Stat label="Raids won" value={`${raidsWon}`} gold />
            <Stat label="Raids lost" value={`${raidsLost}`} />
            <Stat label="Win rate" value={totalRaids ? `${winRate}%` : "—"} />
            <Stat label="Buildings razed" value={`${razed}`} />
            <Stat label="Battles fought" value={`${battles.length}`} />
            <Stat label="Gold plundered" value={fmtNum(goldLooted)} />
            <Stat label="Coins" value={fmtNum(empire.coins ?? 0)} />
            <Stat label="Buildings" value={`${empire.buildings?.length ?? 0}`} />
          </div>
        </div>
      )}
    </div>
  );
}

function BigStat({
  label,
  value,
  gold,
  color,
}: {
  label: string;
  value: string;
  gold?: boolean;
  color?: string;
}) {
  return (
    <div className="rounded-lg bg-black/30 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-parchment-300/55">{label}</div>
      <div
        className={`mt-0.5 text-lg font-bold tabular-nums ${color ? "" : gold ? "text-gold-light" : "text-parchment-100"}`}
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

// The holder-tier ladder: shows every tier, highlights the one the wallet sits
// in, and the supply share each one needs.
function TierLadder({ share, holds }: { share: number; holds: boolean }) {
  const current = holds ? rewardTier(share) : null;
  return (
    <div className="mt-4 border-t border-parchment-300/10 pt-3">
      <div className="mb-2 text-[11px] uppercase tracking-wide text-parchment-300/55">
        Holder tiers — bigger holdings, bigger boost
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {REWARD_TIERS.map((t) => {
          const active = current?.name === t.name;
          return (
            <div
              key={t.name}
              className={`rounded-lg px-2.5 py-2 ${active ? "border-2" : "border border-parchment-300/10 bg-black/20"}`}
              style={active ? { borderColor: t.color, background: `${t.color}1f` } : undefined}
            >
              <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: t.color }}>
                <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                {t.name}
              </div>
              <div className="mt-0.5 text-[11px] text-parchment-300/60">
                {t.minShare === 0 ? "any holder" : `≥ ${(t.minShare * 100).toFixed(t.minShare < 0.01 ? 1 : 0)}%`}
              </div>
              <div className="text-[11px] font-semibold text-parchment-200">{t.multiplier.toFixed(2)}× boost</div>
              {active && (
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: t.color }}>
                  ◆ You
                </div>
              )}
            </div>
          );
        })}
      </div>
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

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-sm text-parchment-200">{children}</div>
  );
}
