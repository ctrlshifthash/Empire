// ─────────────────────────────────────────────────────────────────────────────
// Bug reports. Anyone can submit one from the site; it's stored server-side and,
// if BUG_WEBHOOK_URL is set (e.g. a Discord/Slack webhook), pinged to you live.
// Read them back through the ADMIN_KEY-gated admin endpoint / page.
// ─────────────────────────────────────────────────────────────────────────────
import type { BugReport } from "../../shared/types.ts";
import { state, scheduleSave } from "./store.ts";
import { now, uid } from "./util.ts";

const MAX_REPORTS = 500;
const WEBHOOK = (process.env.BUG_WEBHOOK_URL || "").trim();

export function submitBug(input: { message?: string; page?: string; contact?: string; ua?: string }): {
  ok: boolean;
  error?: string;
} {
  const message = String(input.message ?? "").trim().slice(0, 2000);
  if (message.length < 3) return { ok: false, error: "Please describe the bug." };

  const report: BugReport = {
    id: uid("bug_"),
    message,
    page: input.page ? String(input.page).slice(0, 200) : undefined,
    contact: input.contact ? String(input.contact).trim().slice(0, 120) : undefined,
    at: now(),
    ua: input.ua ? String(input.ua).slice(0, 300) : undefined,
  };

  state.bugReports.push(report);
  if (state.bugReports.length > MAX_REPORTS) state.bugReports.splice(0, state.bugReports.length - MAX_REPORTS);
  scheduleSave(0);

  // fire-and-forget live notification (never blocks the response)
  if (WEBHOOK) {
    const content = `🐞 **Bug report**\n${report.message}\n_page:_ ${report.page ?? "?"}${report.contact ? `  ·  _contact:_ ${report.contact}` : ""}`;
    void fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }).catch(() => {
      /* ignore webhook failures */
    });
  }

  return { ok: true };
}

export function listBugs(): BugReport[] {
  return [...state.bugReports].reverse(); // newest first
}
