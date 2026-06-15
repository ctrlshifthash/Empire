import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { useGame } from "../lib/store";
import Logo from "../components/Logo";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const setAuth = useGame((s) => s.setAuth);
  const pushToast = useGame((s) => s.pushToast);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [empireName, setEmpireName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
            <h1 className="mt-4 text-2xl font-bold">
              {isRegister ? "Found Your Empire" : "Return to Your Realm"}
            </h1>
            <p className="mt-2 text-sm text-parchment-300/70">
              {isRegister
                ? "Choose your name and your empire’s banner shall rise."
                : "Log in to command your forces once more."}
            </p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field
              label="Username"
              value={username}
              onChange={setUsername}
              placeholder="e.g. Saladin"
              autoFocus
            />
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

            {error && (
              <div className="rounded-lg border border-blood-light/40 bg-blood/20 px-3 py-2 text-sm text-parchment-50">
                {error}
              </div>
            )}

            <button type="submit" className="btn-gold w-full py-3 text-base" disabled={busy}>
              {busy ? "Please wait…" : isRegister ? "⚔ Found Empire" : "Enter the World"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-parchment-300/70">
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
