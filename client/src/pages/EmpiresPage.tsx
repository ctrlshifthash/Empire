import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type EmpireRow } from "../lib/api";
import { useGame } from "../lib/store";
import { AGE_META, fmt } from "../lib/format";
import EmpireCanvas from "../game/EmpireCanvas";
import EmpireCrest from "../components/EmpireCrest";
import type { Empire } from "@shared/types";

// Browse every empire on the shared map — players and AI — and scout, spectate
// or invade them.
export default function EmpiresPage() {
  const [rows, setRows] = useState<EmpireRow[]>([]);
  const [q, setQ] = useState("");
  const [playersOnly, setPlayersOnly] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .empires()
        .then((r) => alive && r.ok && setRows(r.rows))
        .catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((e) => {
        if (playersOnly && e.isBot) return false;
        if (onlineOnly && !e.online) return false;
        if (q && !e.name.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [rows, q, playersOnly, onlineOnly],
  );

  const players = rows.filter((e) => !e.isBot).length;
  const onlineCount = rows.filter((e) => e.online).length;

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-grid opacity-10" />
      <div className="container-x relative max-w-6xl py-14">
        <div className="text-center">
          <span className="kicker">🌍 Scout the realm</span>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">Empires</h1>
          <p className="mx-auto mt-4 max-w-2xl text-parchment-300/70">
            Every empire on the shared map — rulers and AI alike. Scout their strength, spectate their world, and march
            on them for loot.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4 text-sm text-parchment-300/70">
            <span>
              <b className="text-parchment-100">{rows.length}</b> empires
            </span>
            <span>
              <b className="text-parchment-100">{players}</b> rulers
            </span>
            <span>
              <b className="text-emerald-300">{onlineCount}</b> online
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search empires…"
              className="w-44 rounded-lg border border-parchment-300/15 bg-black/40 px-3 py-1.5 text-sm text-parchment-50 placeholder:text-parchment-300/35 focus:border-gold/50 focus:outline-none"
            />
            <FilterToggle on={playersOnly} onClick={() => setPlayersOnly((v) => !v)}>
              Rulers only
            </FilterToggle>
            <FilterToggle on={onlineOnly} onClick={() => setOnlineOnly((v) => !v)}>
              Online
            </FilterToggle>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <EmpireCard key={e.id} e={e} onClick={() => setOpenId(e.id)} />
          ))}
          {rows.length > 0 && filtered.length === 0 && (
            <div className="col-span-full rounded-xl border border-parchment-300/10 bg-black/20 p-8 text-center text-sm text-parchment-300/60">
              No empires match your filters.
            </div>
          )}
          {rows.length === 0 && (
            <div className="col-span-full rounded-xl border border-parchment-300/10 bg-black/20 p-8 text-center text-sm text-parchment-300/60">
              Loading the world…
            </div>
          )}
        </div>
      </div>

      {openId && <EmpireDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function FilterToggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        on
          ? "border-gold/50 bg-gold/15 text-gold-light"
          : "border-parchment-300/15 bg-black/30 text-parchment-300/70 hover:text-parchment-100"
      }`}
    >
      {children}
    </button>
  );
}

function EmpireCard({ e, onClick }: { e: EmpireRow; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border border-parchment-300/10 bg-ink-800/60 p-4 text-left shadow-panel transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/30 hover:shadow-gold"
    >
      <EmpireCrest color={e.banner} name={e.name} size={42} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-parchment-100">{e.name}</span>
          {e.online && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" title="Online" />}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-parchment-300/55">
          <span>⚜ {e.rank}</span>
          <span>·</span>
          <span style={{ color: AGE_META[e.age as keyof typeof AGE_META]?.color }}>
            {AGE_META[e.age as keyof typeof AGE_META]?.short ?? e.age}
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="font-display font-bold text-gold-light">{fmt(e.power)}</div>
        <div className="text-[10px] uppercase tracking-wider text-parchment-300/50">power</div>
      </div>
    </button>
  );
}

function EmpireDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [empire, setEmpire] = useState<Empire | null>(null);
  const [rank, setRank] = useState<string>("");
  const [online, setOnline] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const token = useGame((s) => s.token);
  const myEmpireId = useGame((s) => s.user?.empireId);
  const requestInvade = useGame((s) => s.requestInvade);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    api
      .empire(id)
      .then((r) => {
        if (!alive) return;
        if (r.ok && r.empire) {
          setEmpire(r.empire);
          setRank(r.rank ?? "");
          setOnline(!!r.online);
        } else setErr(r.error ?? "Empire not found.");
      })
      .catch(() => alive && setErr("Could not reach the server."));
    return () => {
      alive = false;
    };
  }, [id]);

  const isSelf = !!empire && myEmpireId === empire.id;
  const armySize = empire
    ? empire.army.villager + empire.army.spearman + empire.army.archer + empire.army.knight
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-16 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <button
          className="absolute -top-10 right-0 rounded-lg border border-parchment-300/20 bg-black/60 px-3 py-1.5 text-sm text-parchment-100/90 hover:border-gold/50"
          onClick={onClose}
        >
          ✕ Close
        </button>

        <div className="panel p-5">
          {err && <div className="text-sm text-blood-light">{err}</div>}
          {!empire && !err && <div className="py-12 text-center text-parchment-300/60">Scouting…</div>}

          {empire && (
            <>
              <div className="flex items-center gap-3">
                <EmpireCrest color={empire.banner} name={empire.name} size={50} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xl font-bold text-parchment-100">{empire.name}</span>
                    {online && <span className="h-2 w-2 rounded-full bg-emerald-400" title="Online" />}
                  </div>
                  <div className="text-sm text-parchment-300/60">
                    Rival ruler · ⚜ {rank} ·{" "}
                    {AGE_META[empire.age as keyof typeof AGE_META]?.name ?? empire.age}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Power" value={fmt(empire.power)} gold />
                <Stat label="Army" value={fmt(armySize)} />
                <Stat label="Buildings" value={`${empire.buildings.length}`} />
                <Stat label="Raids won" value={`${empire.raidsWon}`} />
              </div>

              {/* spectate their base */}
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-parchment-300/55">
                  👁️ Spectating {empire.name}’s settlement
                </div>
                <div className="h-72 overflow-hidden rounded-xl border border-parchment-300/10 bg-black/40">
                  <EmpireCanvas empire={empire} selectedId={null} onSelect={() => {}} />
                </div>
              </div>

              {/* actions */}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {isSelf ? (
                  <button className="btn-ghost flex-1" disabled>
                    This is your empire
                  </button>
                ) : token ? (
                  <button
                    className="btn-gold flex-1"
                    onClick={() => {
                      requestInvade(empire.id);
                      navigate("/play");
                    }}
                  >
                    🗡️ Invade this empire
                  </button>
                ) : (
                  <button className="btn-gold flex-1" onClick={() => navigate("/login")}>
                    Sign in to invade
                  </button>
                )}
              </div>
              <p className="mt-2 text-center text-[11px] text-parchment-300/45">
                Raid rivals for their resources now. Plundering a rival’s share of the SOL pool goes live when the token
                launches.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-lg bg-black/25 px-3 py-2">
      <div className="text-[11px] text-parchment-300/55">{label}</div>
      <div className={`font-semibold tabular-nums ${gold ? "text-gold-light" : "text-parchment-100"}`}>{value}</div>
    </div>
  );
}
