import { useNow } from "../lib/hooks";
import { RESOURCE_META, RESOURCE_ORDER, fmt, fmtTime } from "../lib/format";
import type { Resources } from "@shared/types";

export function CostBadge({
  cost,
  have,
}: {
  cost: Partial<Resources>;
  have?: Resources;
}) {
  const parts = RESOURCE_ORDER.filter((k) => cost[k]);
  if (parts.length === 0) return <span className="text-parchment-300/50">Free</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {parts.map((k) => {
        const need = cost[k]!;
        const short = have ? have[k] < need : false;
        return (
          <span
            key={k}
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              short ? "text-blood-light" : "text-parchment-200"
            }`}
            title={RESOURCE_META[k].label}
          >
            <span>{RESOURCE_META[k].icon}</span>
            {fmt(need)}
          </span>
        );
      })}
    </span>
  );
}

export function Countdown({
  to,
  className = "",
  prefix = "",
  done = "Ready",
}: {
  to: number;
  className?: string;
  prefix?: string;
  done?: string;
}) {
  const now = useNow(500);
  const remain = (to - now) / 1000;
  return (
    <span className={className}>
      {remain > 0 ? `${prefix}${fmtTime(remain)}` : done}
    </span>
  );
}

export function ProgressBar({
  value,
  max,
  color = "#c9a227",
  className = "",
}: {
  value: number;
  max: number;
  color?: string;
  className?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-black/40 ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
      />
    </div>
  );
}

// A live progress bar that fills from startedAt -> completesAt.
export function TimedBar({
  startedAt,
  completesAt,
  color = "#c9a227",
}: {
  startedAt: number;
  completesAt: number;
  color?: string;
}) {
  const now = useNow(500);
  const total = Math.max(1, completesAt - startedAt);
  const done = Math.min(total, Math.max(0, now - startedAt));
  return <ProgressBar value={done} max={total} color={color} />;
}

export { fmt, fmtTime };
