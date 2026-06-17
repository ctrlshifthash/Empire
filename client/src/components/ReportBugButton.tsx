import { useState } from "react";
import { SERVER_URL } from "../lib/config";

// Floating Feedback + Report-a-bug widget (bottom-left; music toggle is bottom-right).
// Both post to /api/bugs (tagged by kind) and land in the same /admin inbox.
type Kind = "feedback" | "bug";

export default function ReportBugButton() {
  const [kind, setKind] = useState<Kind | null>(null); // which modal is open (null = closed)
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const open = (k: Kind) => {
    setKind(k);
    setSent(false);
    setMessage("");
    setContact("");
  };
  const close = () => setKind(null);

  const submit = async () => {
    if (message.trim().length < 3 || !kind) return;
    setSending(true);
    try {
      await fetch(`${SERVER_URL}/api/bugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message, contact, page: window.location.pathname }),
      });
    } catch {
      /* keep it simple — still show thanks */
    } finally {
      setSending(false);
      setSent(true);
    }
  };

  const isBug = kind === "bug";

  return (
    <>
      {/* launchers */}
      <div className="fixed bottom-4 left-4 z-40 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => open("feedback")}
          title="Send feedback"
          className="flex h-11 items-center gap-2 rounded-full border border-parchment-300/20 bg-ink-800/80 px-4 text-sm font-medium text-parchment-200 shadow-deep backdrop-blur-sm transition-colors hover:border-gold/50 hover:text-gold-light"
        >
          💬 <span className="hidden sm:inline">Feedback</span>
        </button>
        <button
          type="button"
          onClick={() => open("bug")}
          title="Report a bug"
          className="flex h-11 items-center gap-2 rounded-full border border-parchment-300/20 bg-ink-800/80 px-4 text-sm font-medium text-parchment-200 shadow-deep backdrop-blur-sm transition-colors hover:border-blood/50 hover:text-blood-light"
        >
          🐞 <span className="hidden sm:inline">Report a bug</span>
        </button>
      </div>

      {kind && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={close}>
          <div
            className="w-full max-w-md rounded-2xl border border-parchment-300/15 bg-ink-800 p-6 shadow-deep"
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <div className="py-6 text-center">
                <div className="text-3xl">🙏</div>
                <div className="mt-2 font-display text-lg font-bold text-gold-gradient">Thank you!</div>
                <p className="mt-1 text-sm text-parchment-300/70">
                  Your {isBug ? "report" : "feedback"} was sent. We read every one.
                </p>
                <button className="btn-gold btn-sm mt-5" onClick={close}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-parchment-100">
                    {isBug ? "🐞 Report a bug" : "💬 Send feedback"}
                  </h3>
                  <button className="text-parchment-300/50 hover:text-parchment-100" onClick={close}>
                    ✕
                  </button>
                </div>

                {/* type toggle */}
                <div className="mt-3 inline-flex rounded-lg border border-parchment-300/15 bg-black/30 p-0.5 text-xs">
                  {(["feedback", "bug"] as Kind[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      className={`rounded-md px-3 py-1 font-medium capitalize transition-colors ${
                        kind === k ? "bg-gold/15 text-gold-light" : "text-parchment-300/60 hover:text-parchment-100"
                      }`}
                    >
                      {k === "bug" ? "🐞 Bug" : "💬 Feedback"}
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  autoFocus
                  placeholder={isBug ? "Describe the bug, what you did, and what you expected…" : "Ideas, suggestions, what you'd love to see…"}
                  className="mt-3 w-full resize-none rounded-lg border border-parchment-300/15 bg-black/30 px-3 py-2 text-sm focus:border-gold/40 focus:outline-none"
                />
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={120}
                  placeholder="Contact (optional) — X handle or email for follow-up"
                  className="mt-2 w-full rounded-lg border border-parchment-300/15 bg-black/30 px-3 py-2 text-sm focus:border-gold/40 focus:outline-none"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button className="btn-ghost btn-sm" onClick={close}>
                    Cancel
                  </button>
                  <button className="btn-gold btn-sm" disabled={sending || message.trim().length < 3} onClick={submit}>
                    {sending ? "Sending…" : isBug ? "Send report" : "Send feedback"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
