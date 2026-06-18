import { useEffect, useState } from "react";
import { useGame } from "../lib/store";
import { COLORS_BANNER } from "@shared/gamedata";

// Edit your in-game identity: display name (shown on the leaderboard, world and
// hub) and crest colour. Lives at the top of the dashboard.
export default function ProfileCard() {
  const empire = useGame((s) => s.snapshot?.empire);
  const renameEmpire = useGame((s) => s.renameEmpire);
  const setBanner = useGame((s) => s.setBanner);
  const [name, setName] = useState(empire?.name ?? "");

  // keep the field in sync when the server confirms a rename
  useEffect(() => {
    if (empire?.name) setName(empire.name);
  }, [empire?.name]);

  if (!empire) return null;
  const trimmed = name.trim();
  const valid = trimmed.length >= 3 && trimmed.length <= 20;
  const dirty = valid && trimmed !== empire.name;

  return (
    <div className="panel mb-5 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg font-bold text-white shadow" style={{ background: empire.banner }}>
          {(empire.name?.[0] ?? "?").toUpperCase()}
        </span>
        <div>
          <div className="font-display text-lg font-bold text-gold-gradient">Your Profile</div>
          <p className="text-xs text-parchment-300/60">Shown on the leaderboard, the world and the hub.</p>
        </div>
      </div>

      {/* display name */}
      <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-parchment-300/55">Display name</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          onKeyDown={(e) => e.key === "Enter" && dirty && renameEmpire(trimmed)}
          placeholder="Your name"
          className="w-full max-w-xs rounded-lg border border-parchment-300/15 bg-black/30 px-3 py-2 text-sm focus:border-gold/40 focus:outline-none"
        />
        <button className="btn-gold btn-sm" disabled={!dirty} onClick={() => renameEmpire(trimmed)}>
          Save
        </button>
      </div>
      <p className="mt-1 text-[11px] text-parchment-300/45">
        {trimmed.length > 0 && !valid ? "3–20 letters, numbers, spaces or underscores." : "Letters, numbers, spaces or underscores."}
      </p>

      {/* crest colour */}
      <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-parchment-300/55">Crest colour</label>
      <div className="mt-2 flex flex-wrap gap-2">
        {COLORS_BANNER.map((c) => (
          <button
            key={c}
            onClick={() => setBanner(c)}
            title="Set crest colour"
            className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
              empire.banner === c ? "border-gold-light ring-2 ring-gold/40" : "border-black/30"
            }`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
