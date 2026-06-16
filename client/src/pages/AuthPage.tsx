import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import { api } from "../lib/api";
import { useGame } from "../lib/store";
import { privyConfigured } from "../lib/web3";
import { privyIdentity } from "../lib/PrivyBridge";
import Logo from "../components/Logo";

// Sign in (or auto-create an empire) with a Solana wallet or email via Privy.
// Only rendered when Privy is configured, so it's always inside PrivyProvider.
function PrivySignIn({
  busy,
  setBusy,
  setError,
}: {
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
}) {
  const { login, authenticated, user, ready } = usePrivy();
  const navigate = useNavigate();
  const setAuth = useGame((s) => s.setAuth);
  const pushToast = useGame((s) => s.pushToast);
  const [armed, setArmed] = useState(false);

  // once Privy reports an authenticated identity (after the modal, or already
  // connected), bridge it into a game session.
  useEffect(() => {
    if (!armed || !authenticated || !user) return;
    const id = privyIdentity(user);
    if (!id) return;
    setArmed(false);
    (async () => {
      setBusy(true);
      try {
        const res = await api.privyAuth(id.identity, id.label);
        if (res.ok && res.token && res.user) {
          setAuth(res.token, res.user);
          pushToast({ kind: "success", text: `Welcome, ${res.user.username}.` });
          navigate("/play");
        } else {
          setError(res.error ?? "Sign-in failed.");
        }
      } catch {
        setError("Could not reach the server. Is it running?");
      } finally {
        setBusy(false);
      }
    })();
  }, [armed, authenticated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <button
      type="button"
      className="btn-gold w-full py-3 text-base"
      disabled={busy || !ready}
      onClick={() => {
        setError(null);
        setArmed(true);
        if (!authenticated) login();
      }}
    >
      🔗 Sign in with wallet or email
    </button>
  );
}

export default function AuthPage(_props: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const setAuth = useGame((s) => s.setAuth);
  const pushToast = useGame((s) => s.pushToast);

  const [error, setError] = useState<string | null>(null);
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
              Sign in with your Solana wallet or email — your empire is created automatically. Hold the token to earn
              SOL.
            </p>
          </div>

          <div className="mt-7 space-y-3">
            {privyConfigured ? (
              <PrivySignIn busy={busy} setBusy={setBusy} setError={setError} />
            ) : (
              <div className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-center text-xs text-parchment-300/70">
                Wallet sign-in activates once Privy is configured. Try demo mode below.
              </div>
            )}

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
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-parchment-300/45">
          Free to play. Your empire grows even while you’re away.
        </p>
      </motion.div>
    </div>
  );
}
