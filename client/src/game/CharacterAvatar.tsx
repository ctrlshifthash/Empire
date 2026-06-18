import { useEffect, useRef } from "react";
import { drawCharacter } from "../world/draw";

type Hat = "crown" | "helmet" | "hood" | "cap" | null;

// Renders a character's placeholder art on a small canvas using the game's own
// character sprite renderer — distinct by colour/hat/cape until real art lands.
export default function CharacterAvatar({
  color,
  hat,
  cape,
  size = 56,
}: {
  color: string;
  hat?: Hat;
  cape?: boolean;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawCharacter(ctx, size / 2, size * 0.82, {
      color,
      facing: 1,
      scale: size / 30,
      hat: hat ?? undefined,
      cape,
      phase: 0,
    });
  }, [color, hat, cape, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} />;
}
