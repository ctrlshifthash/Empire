import type { AgeId, ResourceKind } from "@shared/types";

export function fmt(n: number): string {
  n = Math.floor(n);
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(n) >= 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toLocaleString("en-US");
}

export function fmtTime(seconds: number): string {
  seconds = Math.max(0, Math.ceil(seconds));
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s.toString().padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm.toString().padStart(2, "0")}m`;
}

export const RESOURCE_META: Record<ResourceKind, { label: string; icon: string; color: string }> = {
  wood: { label: "Wood", icon: "🪵", color: "#a87c4f" },
  food: { label: "Food", icon: "🌾", color: "#d8b24a" },
  gold: { label: "Gold", icon: "🪙", color: "#e8c75a" },
  stone: { label: "Stone", icon: "🪨", color: "#9b9384" },
};

export const RESOURCE_ORDER: ResourceKind[] = ["wood", "food", "gold", "stone"];

export const AGE_META: Record<AgeId, { name: string; short: string; color: string }> = {
  dark: { name: "Dark Age", short: "Dark", color: "#6b6357" },
  feudal: { name: "Feudal Age", short: "Feudal", color: "#3f7a4d" },
  castle: { name: "Castle Age", short: "Castle", color: "#3f6bb0" },
  imperial: { name: "Imperial Age", short: "Imperial", color: "#c9a227" },
};
