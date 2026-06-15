import type { GameSnapshot } from "@shared/types";
import { AGES, BUILDINGS, UNITS, nextAge } from "@shared/gamedata";
import { Countdown } from "./ui";
import LogView from "./LogView";

interface Op {
  id: string;
  icon: string;
  text: string;
  to: number;
  tone: "gold" | "blood" | "royal" | "green";
}

const TONE: Record<Op["tone"], string> = {
  gold: "text-gold-light",
  blood: "text-blood-light",
  royal: "text-royal-light",
  green: "text-emerald-300",
};

export default function OperationsPanel({ snapshot }: { snapshot: GameSnapshot }) {
  const { empire, outgoingMarches, incomingMarches } = snapshot;
  const ops: Op[] = [];

  for (const b of empire.buildings) {
    if (b.completesAt != null) {
      ops.push({
        id: b.id,
        icon: b.job === "upgrade" ? "⬆️" : "🏗️",
        text: `${b.job === "upgrade" ? "Upgrading" : "Building"} ${BUILDINGS[b.type].name}`,
        to: b.completesAt,
        tone: "green",
      });
    }
  }
  if (empire.ageUpCompletesAt != null) {
    const n = nextAge(empire.age);
    ops.push({
      id: "age",
      icon: "🏛️",
      text: `Researching ${n ? AGES[n].name : "next age"}`,
      to: empire.ageUpCompletesAt,
      tone: "gold",
    });
  }
  for (const o of empire.trainQueue) {
    ops.push({
      id: o.id,
      icon: UNITS[o.unit].icon,
      text: `Training ${o.quantity}× ${UNITS[o.unit].name}`,
      to: o.completesAt,
      tone: "royal",
    });
  }
  for (const m of outgoingMarches) {
    ops.push({
      id: m.id,
      icon: m.kind === "attack" ? "🐎" : "↩️",
      text: m.kind === "attack" ? `Raiding ${m.toName}` : `Army returning home`,
      to: m.arrivesAt,
      tone: m.kind === "attack" ? "blood" : "green",
    });
  }
  for (const m of incomingMarches) {
    ops.push({
      id: m.id,
      icon: "⚠️",
      text: `Incoming: ${m.fromName}`,
      to: m.arrivesAt,
      tone: "blood",
    });
  }

  ops.sort((a, b) => a.to - b.to);

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-display text-base font-semibold">Active Operations</h3>
          {ops.length > 0 && <span className="chip py-0.5 text-[10px]">{ops.length}</span>}
        </div>
        {ops.length === 0 ? (
          <div className="rounded-lg bg-black/20 px-3 py-4 text-center text-sm text-parchment-300/50">
            All quiet. Issue orders to begin your reign.
          </div>
        ) : (
          <div className="space-y-1.5">
            {ops.map((op) => (
              <div
                key={op.id}
                className="flex items-center gap-2.5 rounded-lg border border-parchment-300/5 bg-black/20 px-3 py-2"
              >
                <span>{op.icon}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-parchment-200">{op.text}</span>
                <Countdown to={op.to} className={`text-xs font-semibold ${TONE[op.tone]}`} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel p-4">
        <h3 className="mb-3 font-display text-base font-semibold">Recent events</h3>
        <LogView empire={{ ...empire, log: empire.log.slice(0, 7) }} compact />
      </div>
    </div>
  );
}
