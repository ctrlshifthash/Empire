import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import Logo from "./Logo";
import { useGame } from "../lib/store";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/play", label: "Play" },
  { to: "/empires", label: "Empires" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/guide", label: "Guide" },
  { to: "/docs", label: "Docs" },
];

const SOCIALS = [
  {
    label: "Pump.fun",
    href: "https://pump.fun",
    icon: (
      <img src="/pumpfun.png" alt="" className="h-5 w-5 object-contain" />
    ),
  },
  {
    label: "X",
    href: "https://x.com/playRealmRumble",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "GitHub",
    href: "https://github.com/playRealmRumble/Realm-Rumble",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
  },
];

function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {SOCIALS.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          title={s.label}
          aria-label={s.label}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-parchment-300/15 bg-black/30 text-parchment-200 transition-transform duration-150 hover:-translate-y-0.5 hover:scale-110 hover:border-gold/50 hover:text-gold-light"
        >
          {s.icon}
        </a>
      ))}
    </div>
  );
}

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
      <nav className="flex h-16 w-full items-center gap-4 px-5 sm:px-8">
        {/* left: brand */}
        <div className="flex flex-1 items-center min-w-0">
          <Link to="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <Logo />
            <span className="flex flex-col leading-none">
              <span className="font-display text-lg font-bold text-gold-gradient">Realm Rumble</span>
              <span className="hidden text-[10px] uppercase tracking-[0.25em] text-parchment-300/60 sm:block">
                Build · Conquer · Endure
              </span>
            </span>
          </Link>
        </div>

        {/* center: primary nav */}
        <div className="hidden items-center gap-1 lg:flex">
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

        {/* right: account + social links */}
        <div className="flex flex-1 items-center justify-end gap-3">
          <div className="hidden items-center gap-3 lg:flex">
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
          <div className="hidden xl:block">
            <SocialLinks className="border-l border-parchment-300/15 pl-4" />
          </div>

          {/* mobile toggle */}
          <button
            className="btn-ghost btn-sm lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-parchment-300/10 bg-ink-800/95 px-5 py-4 lg:hidden">
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
            <SocialLinks className="mt-3 justify-center" />
          </div>
        </div>
      )}
    </header>
  );
}
