export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4dd8f" />
          <stop offset="1" stopColor="#c9a227" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#221c12" stroke="#c9a227" strokeOpacity="0.35" />
      <g fill="url(#lg)">
        <path d="M12 46V29l6-6 6 6v17h-4v-8h-4v8z" />
        <path d="M27 46V21l9-9 9 9v25h-5V30h-8v16z" />
        <rect x="47" y="31" width="6" height="15" />
        <path d="M50 22l4 7h-8z" />
      </g>
      <rect x="9" y="46" width="46" height="6" rx="2" fill="#9c7c14" />
    </svg>
  );
}
