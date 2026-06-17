import { useState } from "react";
import type { Empire } from "@shared/types";
import { UNITS, UNIT_TYPES, ARENA_MIN_STAKE } from "@shared/gamedata";
import { useGame } from "../lib/store";
import { fmt } from "../lib/format";

type Army = Partial<Record<(typeof UNIT_TYPES)[number], number>>;

function ArmyPicker({ empire, army, setArmy }: { empire: Empire; army: Army; setArmy: (a: Army) => void }) {
  const set = (u: (typeof UNIT_TYPES)[number], v: number) =>
    setArmy({ ...army, [u]: Math.max(0, Math.min(empire.army[u] ?? 0, v)) });
  return (
    <div className="space-y-1.5">
      {UNIT_TYPES.map((u) => {
        const have = empire.army[u] ?? 0;
        return (
          <div key={u} className="flex items-center gap-2 rounded-lg border border-parchment-300/10 bg-black/20 px-2.5 py-1.5">
            <span className="text-base">{UNITS[u].icon}</span>
            <div className="flex-1 text-xs">
              <span className="font-medium">{UNITS[u].name}</span>
              <span className="ml-1 text-parchment-300/50">({have})</span>
            </div>
            <div className="flex items-center rounded-md border border-parchment-300/15 bg-black/30">
              <button className="px-2 text-parchment-300/70 hover:text-gold-light" onClick={() => set(u, (army[u] ?? 0) - 1)}>−</button>
              <input
                value={army[u] ?? 0}
                onChange={(e) => set(u, parseInt(e.target.value) || 0)}
                className="w-9 bg-transparent text-center text-xs font-semibold focus:outline-none"
              />
              <button className="px-2 text-parchment-300/70 hover:text-gold-light" onClick={() => set(u, (army[u] ?? 0) + 1)}>+</button>
            </div>
            <button className="chip py-0 text-[10px]" disabled={have === 0} onClick={() => set(u, have)}>All</button>
          </div>
        );
      })}
    </div>
  );
}

const armyTotal = (a: Army) => UNIT_TYPES.reduce((s, u) => s + (a[u] ?? 0), 0);

export default function ArenaView({ empire }: { empire: Empire }) {
  const duels = useGame((s) => s.snapshot?.duels ?? []);
  const createDuel = useGame((s) => s.createDuel);
  const acceptDuel = useGame((s) => s.acceptDuel);
  const cancelDuel = useGame((s) => s.cancelDuel);

  const [stake, setStake] = useState(ARENA_MIN_STAKE);
  const [postArmy, setPostArmy] = useState<Army>({});
  const [accepting, setAccepting] = useState<string | null>(null);
  const [acceptArmy, setAcceptArmy] = useState<Army>({});

  const acceptTarget = duels.find((d) => d.id === accepting) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* post a wager */}
      <div className="lg:col-span-2">
        <div className="panel p-4">
          <div className="font-display text-base font-semibold">⚔️ Post a wager</div>
          <p className="mt-1 text-xs text-parchment-300/60">
            Stake coins and commit an army. Whoever accepts fights you — winner takes the pot (5% rake burned). You have{" "}
            <b className="text-gold-light">{fmt(empire.coins)}</b> coins.
          </p>
          <label className="mt-3 block text-xs text-parchment-300/55">Stake (coins)</label>
          <input
            type="number"
            min={ARENA_MIN_STAKE}
            value={stake}
            onChange={(e) => setStake(Math.max(0, parseInt(e.target.value) || 0))}
            className="mt-1 w-full rounded-lg border border-parchment-300/15 bg-black/30 px-3 py-2 text-sm focus:border-gold/40 focus:outline-none"
          />
          <div className="mt-3 text-xs text-parchment-300/55">Commit your army</div>
          <div className="mt-1">
            <ArmyPicker empire={empire} army={postArmy} setArmy={setPostArmy} />
          </div>
          <button
            className="btn-gold btn-sm mt-3 w-full justify-center"
            disabled={stake < ARENA_MIN_STAKE || empire.coins < stake || armyTotal(postArmy) === 0}
            onClick={() => {
              createDuel(stake, postArmy);
              setPostArmy({});
            }}
          >
            Post wager · {fmt(stake)} coins
          </button>
          {stake < ARENA_MIN_STAKE && (
            <p className="mt-1 text-center text-[11px] text-blood-light">Minimum wager is {ARENA_MIN_STAKE} coins.</p>
          )}
        </div>
      </div>

      {/* open wagers */}
      <div className="lg:col-span-3">
        <div className="panel p-4">
          <div className="mb-2 px-1 font-display text-base font-semibold">🏟️ Open wagers</div>
          <div className="max-h-[460px] space-y-1 overflow-y-auto pr-1">
            {duels.length === 0 && (
              <div className="px-2 py-8 text-center text-sm text-parchment-300/55">
                No open wagers. Post one and wait for a challenger.
              </div>
            )}
            {duels.map((d) => {
              const mine = d.challengerId === empire.id;
              return (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 hover:bg-white/5">
                  <span className="h-7 w-7 shrink-0 rounded-md ring-1 ring-black/40" style={{ background: d.challengerBanner }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {d.challengerName} {mine && <span className="text-parchment-300/45">(you)</span>}
                    </div>
                    <div className="text-xs text-parchment-300/55">⚔ {d.armySize} units committed</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gold-light">{fmt(d.stake)}</div>
                    <div className="text-[10px] text-parchment-300/50">coin stake</div>
                  </div>
                  {mine ? (
                    <button className="btn-ghost btn-sm" onClick={() => cancelDuel(d.id)}>
                      Withdraw
                    </button>
                  ) : (
                    <button
                      className="btn-blood btn-sm"
                      disabled={empire.coins < d.stake}
                      onClick={() => {
                        setAccepting(d.id);
                        setAcceptArmy({});
                      }}
                    >
                      {empire.coins < d.stake ? "Can't afford" : "Accept"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* accept modal */}
      {acceptTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setAccepting(null)}>
          <div className="w-full max-w-md rounded-2xl border border-parchment-300/15 bg-ink-800 p-5 shadow-deep" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-parchment-100">Accept wager</h3>
              <button className="text-parchment-300/50 hover:text-parchment-100" onClick={() => setAccepting(null)}>✕</button>
            </div>
            <p className="mt-1 text-sm text-parchment-300/65">
              Match <b className="text-gold-light">{fmt(acceptTarget.stake)}</b> coins vs {acceptTarget.challengerName}
              {" "}({acceptTarget.armySize} units). Commit your army — winner takes the pot.
            </p>
            <div className="mt-3">
              <ArmyPicker empire={empire} army={acceptArmy} setArmy={setAcceptArmy} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost btn-sm" onClick={() => setAccepting(null)}>Cancel</button>
              <button
                className="btn-blood btn-sm"
                disabled={empire.coins < acceptTarget.stake || armyTotal(acceptArmy) === 0}
                onClick={() => {
                  acceptDuel(acceptTarget.id, acceptArmy);
                  setAccepting(null);
                }}
              >
                Fight · {fmt(acceptTarget.stake)} coins
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
