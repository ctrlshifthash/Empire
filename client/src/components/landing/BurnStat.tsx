import { useEffect, useState } from "react";
import { fmt } from "../../lib/format";
import { fetchBurns, type BurnStats } from "../../lib/burns";

// Eastern-time stamp (the project's timezone)
const fmtEst = (at: number) =>
  new Date(at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " EST";

// A live "$RUMBLE burned" counter for the hero stats row. Click it to open a
// popup listing every hourly treasury burn with a Solscan link per transaction.
export default function BurnStat() {
  const [data, setData] = useState<BurnStats | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchBurns().then(setData);
  }, []);

  const total = data?.totalBurned ?? 0;

  return (
    <>
      <button onClick={() => setOpen(true)} className="group text-center" title="View burn transactions">
        <div className="font-display text-2xl font-bold text-gold-light sm:text-3xl">🔥 {data ? fmt(total) : "—"}</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-parchment-300/60 group-hover:text-gold-light/80">$RUMBLE Burned</div>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-parchment-300/15 bg-ink-800/95 p-6 shadow-panel" onClick={(e) => e.stopPropagation()}>
            <div className="shrink-0 text-center">
              <div className="text-4xl">🔥</div>
              <div className="mt-2 font-display text-3xl font-bold text-gold-gradient">{fmt(total)}</div>
              <div className="text-xs uppercase tracking-[0.18em] text-parchment-300/60">$RUMBLE burned forever</div>
              <p className="mt-2 text-[11px] text-parchment-300/55">The treasury burns what the shop collects every hour — removed from supply for good.</p>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-parchment-300/10">
              {/* column header */}
              <div className="grid shrink-0 grid-cols-[1fr_auto] items-center gap-3 border-b border-parchment-300/10 bg-black/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-parchment-300/45">
                <span>Amount burned</span>
                <span className="text-right">When (EST)</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {!data || data.burns.length === 0 ? (
                  <div className="py-6 text-center text-sm text-parchment-300/50">No burns yet — the first hourly burn will show here with its Solscan link.</div>
                ) : (
                  data.burns.map((b) => (
                    <a
                      key={b.signature}
                      href={`https://solscan.io/tx/${b.signature}`}
                      target="_blank"
                      rel="noreferrer"
                      title="View this burn on Solscan"
                      className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-parchment-300/5 px-3 py-2 transition-colors last:border-0 hover:bg-white/5"
                    >
                      <span className="flex items-baseline gap-1.5 text-sm font-bold tabular-nums text-gold-light">
                        🔥 {fmt(b.amount)} <span className="text-[10px] font-normal text-parchment-300/40">$RUMBLE</span>
                      </span>
                      <span className="flex items-center justify-end gap-2 whitespace-nowrap text-[11px] tabular-nums text-parchment-300/55">
                        {fmtEst(b.at)} <span className="text-sky-300">↗</span>
                      </span>
                    </a>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 flex shrink-0 flex-wrap items-center justify-center gap-4 border-t border-parchment-300/10 pt-3 text-[11px]">
              {data?.mint && (
                <a href={`https://solscan.io/token/${data.mint}`} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
                  Token supply ↗
                </a>
              )}
              {data?.treasury && (
                <a href={`https://solscan.io/account/${data.treasury}`} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
                  Treasury wallet ↗
                </a>
              )}
            </div>
            <button className="btn-ghost btn-sm mt-4 w-full shrink-0" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
