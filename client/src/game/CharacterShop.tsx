import { useEffect, useState } from "react";
import { useWallet as useSolWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useGame } from "../lib/store";
import { RARITY_META } from "@shared/gamedata";
import { SERVER_URL } from "../lib/config";
import { reserveCharacter, postBuyCharacter, claimFreebie } from "../lib/characters";
import { buildPaymentTx } from "../lib/market";
import { fetchExchangeConfig } from "../lib/exchange";
import { confirmSignature } from "../lib/payments";
import CharacterAvatar from "./CharacterAvatar";
import OwnedCharactersGrid from "./OwnedCharactersGrid";

type Hat = "crown" | "helmet" | "hood" | "cap" | null;
type CatalogItem = {
  id: string;
  name: string;
  icon: string;
  color: string;
  hat: Hat;
  cape: boolean;
  rarity: string;
  priceUsd: number;
  power: number;
  maxSupply: number;
  image?: string;
  minted: number;
  remaining: number;
  desc: string;
};

const rarityColor = (r: string) => (RARITY_META as Record<string, { color: string }>)[r]?.color ?? "#9aa4ad";
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

// The character cNFT shop: buy a character with $RUMBLE (USD-priced, settled at
// the live rate), wear it as your hub avatar for a power boost (→ rank → more
// SOL), own it, and resell it. Ownership is tracked in-game for now; the on-chain
// cNFT mints to your wallet once that goes live.
export default function CharacterShop() {
  const pushToast = useGame((s) => s.pushToast);
  const { setVisible } = useWalletModal();
  const { publicKey, connected, sendTransaction } = useSolWallet();
  const { connection } = useConnection();
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);
  const [locked, setLocked] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rumbleUsd, setRumbleUsd] = useState<number | null>(null);
  const [freebie, setFreebie] = useState<string | null>(null); // typeId of a free character this wallet can claim

  const addr = connected && publicKey ? publicKey.toBase58() : null;
  const refresh = () =>
    fetch(`${SERVER_URL}/api/characters/config${addr ? `?address=${addr}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) return;
        setCatalog(d.characters);
        setLocked(!!d.locked);
        setFreebie(d.freebie ?? null);
      })
      .catch(() => {});

  useEffect(() => {
    refresh();
    fetchExchangeConfig().then((c) => setRumbleUsd(c.rumbleUsd)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr]);

  async function claimFree() {
    if (!connected || !publicKey) {
      pushToast({ kind: "warn", text: "Connect the whitelisted wallet to claim." });
      setVisible(true);
      return;
    }
    setBusy("freebie");
    try {
      const r = await claimFreebie(publicKey.toBase58());
      if (r.ok) {
        pushToast({ kind: "success", text: `Free ${r.name ?? "character"} claimed — it's in Your characters!` });
        refresh();
      } else {
        pushToast({ kind: "warn", text: r.error ?? "Couldn't claim." });
      }
    } finally {
      setBusy(null);
    }
  }

  async function buy(c: CatalogItem) {
    if (!connected || !publicKey) {
      pushToast({ kind: "warn", text: "Connect your wallet to buy." });
      setVisible(true);
      return;
    }
    const buyer = publicKey.toBase58();
    setBusy(c.id);
    try {
      const r = await reserveCharacter(c.id, buyer);
      if (!r.ok || !r.payment) {
        pushToast({ kind: "warn", text: r.error ?? "Couldn’t reserve." });
        return;
      }
      const tx = await buildPaymentTx(r.payment, buyer);
      const signature = await sendTransaction(tx, connection);
      pushToast({ kind: "info", text: "Payment sent — confirming…" });
      await confirmSignature(connection, signature);
      const res = await postBuyCharacter(c.id, buyer, signature);
      if (res.ok) {
        pushToast({ kind: "success", text: `${c.name} is yours!` });
        refresh();
      } else {
        pushToast({ kind: "warn", text: res.error ?? "Purchase failed." });
      }
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (/reject|denied|cancel|closed|user rejected/i.test(msg)) {
        pushToast({ kind: "warn", text: "Payment cancelled." });
      } else if (/disconnect|not connected|wallet not/i.test(msg)) {
        pushToast({ kind: "warn", text: "Wallet not connected — reconnect and try again." });
        setVisible(true);
      } else {
        pushToast({ kind: "warn", text: msg.slice(0, 160) || "Couldn’t complete the purchase." });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 text-sm text-parchment-200">
        <span className="font-semibold text-gold-light">🎭 Characters{locked && " · locked"}</span> · Buy a
        character with <strong>$RUMBLE</strong>, wear it as your <strong>hub avatar</strong> for a{" "}
        <strong>power boost</strong> (lifts your renown rank → a bigger share of the daily SOL pool), and{" "}
        <strong>resell</strong> it anytime. Owned in-game now; the on-chain cNFT mints to your wallet later.{" "}
        {locked ? "Previewing the roster — sales open shortly." : "Lower serials are rarer — buy early."}
      </div>

      {/* free grant for a whitelisted wallet */}
      {freebie && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-4">
          <div className="text-sm text-parchment-100">
            🎁 You've been gifted a free <strong>{catalog?.find((c) => c.id === freebie)?.name ?? "character"}</strong> — claim it on the house.
          </div>
          <button className="btn-gold btn-sm shrink-0" disabled={busy === "freebie"} onClick={claimFree}>
            {busy === "freebie" ? "…" : "Claim free"}
          </button>
        </div>
      )}

      {/* catalog */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {catalog === null && <div className="panel p-8 text-center text-sm text-parchment-300/60">Loading…</div>}
        {catalog?.map((c) => {
          const soldOut = c.remaining <= 0;
          return (
            <div key={c.id} id={`char-${c.id}`} className="panel flex flex-col p-4" style={{ borderColor: `${rarityColor(c.rarity)}40` }}>
              <div className="flex items-center gap-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg" style={{ background: `${c.color}22`, border: `1px solid ${c.color}` }}>
                  <CharacterAvatar color={c.color} hat={c.hat} cape={c.cape} image={c.image} size={52} />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-parchment-100">{c.name}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: rarityColor(c.rarity) }}>
                    {c.rarity}
                  </div>
                </div>
              </div>
              <p className="mt-2 flex-1 text-xs text-parchment-300/65">{c.desc}</p>
              <div className="mt-2 inline-flex w-fit items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                ⚔️ +{fmt(c.power)} power
              </div>
              <div className="mt-2 text-[11px] text-parchment-300/50">
                {fmt(c.minted)} / {fmt(c.maxSupply)} minted{soldOut ? " · sold out" : ""}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-sm">
                  <div className="font-display font-bold text-gold-light">${fmt(c.priceUsd)}</div>
                  <div className="text-[10px] text-parchment-300/45">
                    {rumbleUsd ? `≈ ${fmt(Math.round(c.priceUsd / rumbleUsd))} $RUMBLE` : "paid in $RUMBLE"}
                  </div>
                </div>
                {locked ? (
                  <button className="btn-ghost btn-sm cursor-not-allowed opacity-70" disabled title="Characters unlock soon">
                    🔒 Locked
                  </button>
                ) : (
                  <button
                    className="btn-gold btn-sm"
                    disabled={soldOut || busy !== null}
                    onClick={() => buy(c)}
                  >
                    {busy === c.id ? "…" : soldOut ? "Sold out" : "Buy"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* owned */}
      <div>
        <h3 className="mb-2 font-display text-lg font-semibold">Your characters</h3>
        <OwnedCharactersGrid emptyText="You don't own a character yet — collect them above to wear in the hub and resell later." />
      </div>
    </div>
  );
}
