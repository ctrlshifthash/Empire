// A live drawing of the player's hero, reflecting their equipped gear: a helmet
// replaces the crown, and the tunic tints toward steel as armour improves.
import { useEffect, useRef } from "react";
import { drawCharacter } from "../world/draw";

const ARMOUR_TINT = ["#d8a52a", "#c9a84a", "#b8b0a0", "#a8b2b8", "#9aa6c0", "#8fb0c8", "#a6c4dc", "#cdddec"];

export default function HeroPreview({ helmet, armour }: { helmet: number; armour: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = Math.max(1, canvas.clientWidth * dpr);
      canvas.height = Math.max(1, canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    let raf = 0;
    const loop = (t: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      drawCharacter(ctx, w / 2, h * 0.9, {
        color: ARMOUR_TINT[Math.min(armour, ARMOUR_TINT.length - 1)],
        facing: 1,
        scale: Math.min(w / 7, h / 30),
        weapon: "sword",
        hat: helmet > 0 ? "helmet" : "crown",
        cape: true,
        moving: false,
        attacking: false,
        phase: t * 0.004,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [helmet, armour]);
  return <canvas ref={ref} className="h-full w-full" />;
}
