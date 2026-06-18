import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useWallet as useSolWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { api } from "../lib/api";
import { useGame } from "../lib/store";
import { walletReady } from "../lib/web3";
import Logo from "../components/Logo";

const PUMP_URL = "https://pump.fun/coin/qYc4gQ9xVq48XmeBBUh7GMfTYycoLS1m3VTT9tapump";

// Sign in (or auto-create an empire) with a Solana wallet. The empire is keyed
// on the wallet address, so the same wallet always resolves to the same empire.
// The real game is token-gated server-side (must hold the minimum $RUMBLE).
function WalletSignIn({
  busy,
  setBusy,
  setError,
  setGated,
}: {
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
  setGated: (b: boolean) => void;
}) {
  const { publicKey, connected } = useSolWallet();
  const { setVisible } = useWalletModal();
  const navigate = useNavigate();
  const setAuth = useGame((s) => s.setAuth);
  const pushToast = useGame((s) => s.pushToast);
  const [armed, setArmed] = useState(false);

  // once a wallet connects (after the modal, or auto-reconnect), bridge its
  // address into a game session.
  useEffect(() => {
    if (!armed || !connected || !publicKey) return;
    const address = publicKey.toBase58();
    setArmed(false);
    (async () => {
      setBusy(true);
      try {
        const res = await api.privyAuth(address);
        if (res.ok && res.token && res.user) {
          setAuth(res.token, res.user);
          pushToast({ kind: "success", text: `Welcome, ${res.user.username}.` });
          navigate("/play");
        } else {
          if (res.gated) setGated(true);
          setError(res.error ?? "Sign-in failed.");
        }
      } catch {
        setError("Could not reach the server. Is it running?");
      } finally {
        setBusy(false);
      }
    })();
  }, [armed, connected, publicKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <button
      type="button"
      className="btn-gold w-full py-3 text-base"
      disabled={busy}
      onClick={() => {
        setError(null);
        setGated(false);
        setArmed(true);
        if (!connected) setVisible(true);
      }}
    >
      🔗 Sign in with wallet
    </button>
  );
}

export default function AuthPage(_props: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const setAuth = useGame((s) => s.setAuth);
  const pushToast = useGame((s) => s.pushToast);

  const [error, setError] = useState<string | null>(null);
  const [gated, setGated] = useState(false);
  const [busy, setBusy] = useState(false);

  async function playDemo() {
    setError(null);
    setBusy(true);
    try {
      const res = await api.demoAuth();
      if (res.ok && res.token && res.user) {
        setAuth(res.token, res.user);
        pushToast({ kind: "success", text: "Demo empire founded — explore freely!" });
        navigate("/play");
      } else {
        setError(res.error ?? "Could not start demo mode.");
        setBusy(false);
      }
    } catch {
      setError("Could not reach the server. Is it running?");
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-5 py-16">
      <div className="absolute inset-0 bg-hero-radial" />
      <div className="absolute inset-0 bg-grid opacity-20" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="panel p-8">
          <div className="flex flex-col items-center text-center">
            <Logo size={48} />
            <h1 className="mt-4 text-2xl font-bold">Enter the World</h1>
            <p className="mt-2 text-sm text-parchment-300/70">
              Sign in with your Solana wallet to play and earn SOL. You need to hold at least{" "}
              <strong className="text-gold-light">10 $RUMBLE</strong> — or try demo mode free below.
            </p>
          </div>

          <div className="mt-7 space-y-3">
            {walletReady ? (
              <WalletSignIn busy={busy} setBusy={setBusy} setError={setError} setGated={setGated} />
            ) : null}

            <div className="flex items-center gap-3 py-1 text-[11px] uppercase tracking-wider text-parchment-300/40">
              <span className="h-px flex-1 bg-parchment-300/15" />
              or
              <span className="h-px flex-1 bg-parchment-300/15" />
            </div>

            <button type="button" className="btn-ghost w-full py-3 text-base" disabled={busy} onClick={playDemo}>
              🎮 Play demo mode
            </button>
            <p className="text-center text-[11px] text-parchment-300/45">
              Demo empires use worthless in-game coins — no wallet, no real rewards.
            </p>

            {error && (
              <div className="rounded-lg border border-blood-light/40 bg-blood/20 px-3 py-2 text-sm text-parchment-50">
                {error}
              </div>
            )}

            {gated && (
              <a
                href={PUMP_URL}
                target="_blank"
                rel="noreferrer"
                className="btn-gold flex w-full items-center justify-center py-3 text-base"
              >
                Buy $RUMBLE on Pump.fun
              </a>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-parchment-300/45">
          Free to play. Your empire grows even while you’re away.
        </p>
      </motion.div>
    </div>
  );
}
