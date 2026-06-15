import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const setAuth = useGame((s) => s.setAuth);
  const pushToast = useGame((s) => s.pushToast);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [empireName, setEmpireName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showClassic, setShowClassic] = useState(false);

  const isRegister = mode === "register";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = isRegister
        ? await api.register(username.trim(), password, empireName.trim() || username.trim())
        : await api.login(username.trim(), password);
      if (!res.ok || !res.token || !res.user) {
        setError(res.error ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      setAuth(res.token, res.user);
      pushToast({
        kind: "success",
        text: isRegister ? "Your empire is founded!" : `Welcome back, ${res.user.username}.`,
      });
      navigate("/play");
    } catch {
      setError("Could not reach the server. Is it running?");
      setBusy(false);
    }
  }

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
            <h1 className="mt-4 text-2xl font-bold">{isRegister ? "Found Your Empire" : "Enter the World"}</h1>
            <p className="mt-2 text-sm text-parchment-300/70">
              Sign in with your Solana wallet or email — or jump straight into demo mode.
            </p>
          </div>

          <div className="mt-7 space-y-3">
            {privyConfigured && <PrivySignIn busy={busy} setBusy={setBusy} setError={setError} />}

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

          {/* Classic username + password, kept as a fallback for existing realms */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowClassic((s) => !s)}
              className="flex w-full items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-parchment-300/55 hover:text-parchment-100"
            >
              <span className="h-px flex-1 bg-parchment-300/15" />
              {showClassic ? "Hide username login" : "Use a username & password"}
              <span className="h-px flex-1 bg-parchment-300/15" />
            </button>

            {showClassic && (
              <form onSubmit={submit} className="mt-4 space-y-4">
                <Field label="Username" value={username} onChange={setUsername} placeholder="e.g. Saladin" autoFocus />
                {isRegister && (
                  <Field
                    label="Empire name"
                    value={empireName}
                    onChange={setEmpireName}
                    placeholder="e.g. The Golden Caliphate (optional)"
                  />
                )}
                <Field
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  placeholder="At least 4 characters"
                  type="password"
                />
                <button type="submit" className="btn-gold w-full py-3 text-base" disabled={busy}>
                  {busy ? "Please wait…" : isRegister ? "⚔ Found Empire" : "Enter the World"}
                </button>
                <div className="text-center text-sm text-parchment-300/70">
                  {isRegister ? (
                    <>
                      Already have a realm?{" "}
                      <Link to="/login" className="font-semibold text-gold-light hover:underline">
                        Log in
                      </Link>
                    </>
                  ) : (
                    <>
                      New to the world?{" "}
                      <Link to="/register" className="font-semibold text-gold-light hover:underline">
                        Found an empire
                      </Link>
                    </>
                  )}
                </div>
              </form>
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-parchment-300/70">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-parchment-300/15 bg-black/40 px-3.5 py-2.5 text-sm text-parchment-50 placeholder:text-parchment-300/35 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/30"
      />
    </label>
  );
}
