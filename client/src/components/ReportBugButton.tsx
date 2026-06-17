import { useState } from "react";
import { SERVER_URL } from "../lib/config";

// Floating "Report a bug" button (bottom-left; the music toggle sits bottom-right).
// Opens a small form that posts to /api/bugs. Reports are stored server-side and,
// if a webhook is configured, pinged to the owner live.
export default function ReportBugButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const close = () => {
    setOpen(false);
    setTimeout(() => {
      setSent(false);
      setMessage("");
      setContact("");
    }, 200);
  };

  const submit = async () => {
    if (message.trim().length < 3) return;
    setSending(true);
    try {
      await fetch(`${SERVER_URL}/api/bugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, contact, page: window.location.pathname }),
      });
      setSent(true);
    } catch {
      /* ignore — keep it simple */
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Report a bug"
        className="fixed bottom-4 left-4 z-40 flex h-11 items-center gap-2 rounded-full border border-parchment-300/20 bg-ink-800/80 px-4 text-sm font-medium text-parchment-200 shadow-deep backdrop-blur-sm transition-colors hover:border-gold/50 hover:text-gold-light"
      >
        🐞 <span className="hidden sm:inline">Report a bug</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={close}>
          <div
            className="w-full max-w-md rounded-2xl border border-parchment-300/15 bg-ink-800 p-6 shadow-deep"
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <div className="py-6 text-center">
                <div className="text-3xl">🙏</div>
                <div className="mt-2 font-display text-lg font-bold text-gold-gradient">Thank you!</div>
                <p className="mt-1 text-sm text-parchment-300/70">Your report was sent. We’ll take a look.</p>
                <button className="btn-gold btn-sm mt-5" onClick={close}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-parchment-100">🐞 Report a bug</h3>
                  <button className="text-parchment-300/50 hover:text-parchment-100" onClick={close}>
                    ✕
                  </button>
                </div>
                <p className="mt-1 text-sm text-parchment-300/65">
                  What went wrong? The more detail, the faster we can fix it.
                </p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  autoFocus
                  placeholder="Describe the bug, what you were doing, and what you expected…"
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
                    {sending ? "Sending…" : "Send report"}
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
