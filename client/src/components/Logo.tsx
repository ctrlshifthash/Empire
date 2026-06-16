export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="Realm Rumble"
      style={{ width: size, height: size }}
      className="rounded-lg object-cover shadow-sm ring-1 ring-gold/30"
    />
  );
}
