import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-parchment-300/10 bg-ink-800/60">
      <div className="container-x flex flex-col items-center justify-center gap-3 py-8 text-center">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="font-display text-lg font-bold text-gold-gradient">Realm Rumble</span>
        </div>
        <span className="text-xs text-parchment-300/50">
          © {new Date().getFullYear()} Realm Rumble. Built for strategists.
        </span>
      </div>
    </footer>
  );
}
