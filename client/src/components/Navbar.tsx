import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import Logo from "./Logo";
import { useGame } from "../lib/store";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/play", label: "Play" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/guide", label: "Guide" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const user = useGame((s) => s.user);
  const token = useGame((s) => s.token);
  const logout = useGame((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "border-b border-parchment-300/10 bg-ink-800/85 backdrop-blur-md shadow-deep"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="container-x flex h-16 items-center justify-between gap-4">
        <Link to="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Logo />
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg font-bold text-gold-gradient">Empires Eternal</span>
            <span className="hidden text-[10px] uppercase tracking-[0.25em] text-parchment-300/60 sm:block">
              Forge · Conquer · Endure
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-link-active" : ""}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:mr-10 md:flex">
          {token && user ? (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `chip hover:border-gold/40 ${isActive ? "border-gold/50 text-gold-light" : ""}`
                }
                title="Your dashboard — empire stats & SOL token rewards"
              >
                Dashboard
              </NavLink>
              <Link to="/play" className="chip hover:border-gold/40">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulseGlow" />
                {user.username}
              </Link>
              <button
                className="btn-ghost btn-sm"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-gold btn-sm">
              Play Free ⚔
            </Link>
          )}
        </div>

        {/* mobile toggle */}
        <button
          className="btn-ghost btn-sm md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? "✕" : "☰"}
        </button>
      </nav>

      {open && (
        <div className="border-t border-parchment-300/10 bg-ink-800/95 px-5 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
              >
                {l.label}
              </NavLink>
            ))}
            {token && user && (
              <NavLink
                to="/dashboard"
                onClick={() => setOpen(false)}
                className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
              >
                Dashboard
              </NavLink>
            )}
            <div className="mt-3 flex gap-2">
              {token && user ? (
                <button
                  className="btn-ghost btn-sm flex-1"
                  onClick={() => {
                    logout();
                    navigate("/");
                    setOpen(false);
                  }}
                >
                  Log out ({user.username})
                </button>
              ) : (
                <Link to="/login" className="btn-gold btn-sm flex-1" onClick={() => setOpen(false)}>
                  Play Free ⚔
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
