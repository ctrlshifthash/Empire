// Live $RUMBLE/USD price, used to price the Coin Exchange in stable USD while
// settling in the token (Kintara's model). DexScreener indexes pump.fun /
// pumpswap tokens and needs no API key. Cached 60s; serves the last good price
// on a transient failure so trades don't break.
import { now } from "./util.ts";

const MINT = (process.env.TOKEN_MINT || "").trim();
const TTL = 60_000;
let cache: { usd: number; at: number } | null = null;

export async function rumbleUsdPrice(): Promise<number | null> {
  if (!MINT) return null;
  if (cache && now() - cache.at < TTL) return cache.usd;
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MINT}`);
    const j = (await r.json()) as { pairs?: Array<{ priceUsd?: string; liquidity?: { usd?: number } }> };
    const pairs = (j?.pairs ?? []).filter((p) => Number(p?.priceUsd) > 0);
    if (!pairs.length) return cache?.usd ?? null;
    pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)); // most-liquid pair
    const usd = Number(pairs[0].priceUsd);
    if (!(usd > 0)) return cache?.usd ?? null;
    cache = { usd, at: now() };
    return usd;
  } catch {
    return cache?.usd ?? null; // serve stale on error
  }
}
