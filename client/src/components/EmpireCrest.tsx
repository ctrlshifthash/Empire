// A heraldic shield crest for an empire — its banner colour with a sheen, a
// gold rim and the empire's initial. Replaces the flat colour squares so each
// empire reads like a real coat of arms.

const SHIELD = "M6 6 H34 V20 C34 29 28 34.5 20 37 C12 34.5 6 29 6 20 Z";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function EmpireCrest({
  color,
  name,
  size = 40,
}: {
  color: string;
  name: string;
  size?: number;
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const id = `cr${hash(color + name)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      style={{ display: "block", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))" }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="1" />
          <stop offset="1" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={SHIELD} fill={`url(#${id})`} stroke="#14100a" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={SHIELD} fill={`url(#${id}s)`} />
      <path d={SHIELD} fill="none" stroke="#e8c75a" strokeOpacity="0.5" strokeWidth="0.9" strokeLinejoin="round" />
      <text
        x="20"
        y="25.5"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="15"
        paintOrder="stroke"
        stroke="#1a140c"
        strokeOpacity="0.55"
        strokeWidth="2.4"
        fill="#fff"
      >
        {initial}
      </text>
    </svg>
  );
}
