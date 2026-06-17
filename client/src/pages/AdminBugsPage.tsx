import { useEffect, useState } from "react";
import type { BugReport } from "@shared/types";
import { SERVER_URL } from "../lib/config";

// Private page (no nav link) to read submitted bug reports. Enter your ADMIN_KEY
// once — it's remembered in this browser — and the reports load.
const LS = "rr_admin_key";

export default function AdminBugsPage() {
  const [key, setKey] = useState(() => localStorage.getItem(LS) ?? "");
  const [bugs, setBugs] = useState<BugReport[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "bug" | "feedback">("all");

  const load = async (k: string) => {
    if (!k) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${SERVER_URL}/api/admin/bugs`, { headers: { "x-admin-key": k } }).then((x) => x.json());
      if (r?.ok) {
        setBugs(r.bugs);
        localStorage.setItem(LS, k);
      } else {
        setError(r?.error ?? "Unauthorized.");
        setBugs(null);
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (key) load(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container-x max-w-3xl py-16">
      <h1 className="font-display text-3xl font-bold text-gold-gradient">Bug reports</h1>
      <p className="mt-2 text-sm text-parchment-300/65">Private admin view. Enter your ADMIN_KEY to load reports.</p>

      <div className="mt-5 flex gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(key)}
          type="password"
          placeholder="ADMIN_KEY"
          className="flex-1 rounded-lg border border-parchment-300/15 bg-black/30 px-3 py-2 text-sm font-mono focus:border-gold/40 focus:outline-none"
        />
        <button className="btn-gold btn-sm" onClick={() => load(key)} disabled={loading}>
          {loading ? "Loading…" : "Load"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-blood-light">{error}</p>}

      {bugs && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-parchment-300/55">
              {bugs.filter((b) => filter === "all" || b.kind === filter).length} of {bugs.length}
            </div>
            <div className="inline-flex rounded-lg border border-parchment-300/15 bg-black/30 p-0.5 text-xs">
              {(["all", "bug", "feedback"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1 font-medium capitalize transition-colors ${
                    filter === f ? "bg-gold/15 text-gold-light" : "text-parchment-300/60 hover:text-parchment-100"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {bugs.length === 0 && <div className="panel p-8 text-center text-sm text-parchment-300/60">No reports yet.</div>}
            {bugs.filter((b) => filter === "all" || b.kind === filter).map((b) => (
              <div key={b.id} className="panel p-4">
                <div className="flex items-center justify-between text-xs text-parchment-300/55">
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        b.kind === "feedback" ? "bg-gold/15 text-gold-light" : "bg-blood/20 text-blood-light"
                      }`}
                    >
                      {b.kind === "feedback" ? "💬 Feedback" : "🐞 Bug"}
                    </span>
                    {new Date(b.at).toLocaleString()}
                  </span>
                  <span className="font-mono">{b.page ?? "—"}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-parchment-100">{b.message}</p>
                {b.contact && <p className="mt-2 text-xs text-gold-light">contact: {b.contact}</p>}
                {b.ua && <p className="mt-1 truncate text-[10px] text-parchment-300/40">{b.ua}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
