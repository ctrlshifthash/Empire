import { useId } from "react";

// The actual Solana wordmark glyph — three slanted bars with the brand
// green→purple gradient. Replaces the ◎ stand-in. Unique gradient id per
// instance so many icons on one page (e.g. the leaderboard) all render.
export default function SolanaIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  const gid = useId();
  return (
    <svg className={className} viewBox="0 0 397.7 311.7" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SOL">
      <defs>
        <linearGradient id={gid} x1="0" y1="311.7" x2="397.7" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00FFA3" />
          <stop offset="1" stopColor="#9945FF" />
        </linearGradient>
      </defs>
      <path fill={`url(#${gid})`} d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
      <path fill={`url(#${gid})`} d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
      <path fill={`url(#${gid})`} d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" />
    </svg>
  );
}
