import { Link } from "react-router-dom";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-parchment-300/10 bg-ink-800/60">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="font-display text-lg font-bold text-gold-gradient">Realm Rumble</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-parchment-300/70">
            A persistent, always-on strategy world. Found your empire, master four ages, raise armies
            and raid rivals — your realm keeps growing whether you are watching or not.
          </p>
          <div className="mt-5 flex gap-2">
            <Link to="/register" className="btn-gold btn-sm">
              Start your empire
            </Link>
            <Link to="/leaderboard" className="btn-ghost btn-sm">
              View rankings
            </Link>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-gold-light/80">Game</h4>
          <ul className="mt-4 space-y-2 text-sm text-parchment-300/70">
            <li><Link className="hover:text-gold-light" to="/play">Enter the world</Link></li>
            <li><Link className="hover:text-gold-light" to="/leaderboard">Leaderboard</Link></li>
            <li><Link className="hover:text-gold-light" to="/guide">How to play</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-gold-light/80">Project</h4>
          <ul className="mt-4 space-y-2 text-sm text-parchment-300/70">
            <li><Link className="hover:text-gold-light" to="/guide">About the game</Link></li>
            <li><a className="hover:text-gold-light" href="#features">Features</a></li>
            <li><a className="hover:text-gold-light" href="#ages">The four ages</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-parchment-300/10">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-parchment-300/50 sm:flex-row">
          <span>© {new Date().getFullYear()} Realm Rumble. Built for strategists.</span>
          <span>Crafted with ⚔ — a living world that never sleeps.</span>
        </div>
      </div>
    </footer>
  );
}
