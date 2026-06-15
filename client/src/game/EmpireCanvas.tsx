import { useEffect, useRef } from "react";
import type { Empire } from "@shared/types";
import { baseCellAt, buildingAtCell, getBaseLayout, renderBase } from "./renderer";

export default function EmpireCanvas({
  empire,
  selectedId,
  onSelect,
}: {
  empire: Empire;
  selectedId: string | null;
  onSelect: (buildingId: string | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const empireRef = useRef(empire);
  const selRef = useRef(selectedId);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  empireRef.current = empire;
  selRef.current = selectedId;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderBase(ctx, w, h, empireRef.current, Date.now(), hoverRef.current, selRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const toLocal = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { px: e.clientX - rect.left, py: e.clientY - rect.top };
    };

    const onMove = (e: MouseEvent) => {
      const { px, py } = toLocal(e);
      const layout = getBaseLayout(canvas.clientWidth, canvas.clientHeight);
      hoverRef.current = baseCellAt(layout, px, py);
      canvas.style.cursor =
        hoverRef.current && buildingAtCell(empireRef.current, hoverRef.current) ? "pointer" : "default";
    };
    const onLeave = () => {
      hoverRef.current = null;
    };
    const onClick = (e: MouseEvent) => {
      const { px, py } = toLocal(e);
      const layout = getBaseLayout(canvas.clientWidth, canvas.clientHeight);
      const cell = baseCellAt(layout, px, py);
      if (!cell) {
        onSelect(null);
        return;
      }
      const b = buildingAtCell(empireRef.current, cell);
      onSelect(b ? b.id : null);
    };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("click", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className="h-full w-full rounded-xl" />;
}
