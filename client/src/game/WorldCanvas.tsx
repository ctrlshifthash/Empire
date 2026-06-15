import { useEffect, useRef } from "react";
import type { WorldMeta } from "@shared/types";
import {
  getWorldLayout,
  renderWorld,
  worldMarkerAt,
  type WorldMarker,
} from "./renderer";

export interface MarchLine {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  attack: boolean;
}

export default function WorldCanvas({
  world,
  markers,
  marches,
  selectedId,
  onSelect,
}: {
  world: WorldMeta;
  markers: WorldMarker[];
  marches: MarchLine[];
  selectedId: string | null;
  onSelect: (empireId: string | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const markersRef = useRef(markers);
  const marchesRef = useRef(marches);
  const selRef = useRef(selectedId);
  const worldRef = useRef(world);
  markersRef.current = markers;
  marchesRef.current = marches;
  selRef.current = selectedId;
  worldRef.current = world;

  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const dragRef = useRef<{ sx: number; sy: number; px0: number; py0: number; moved: boolean } | null>(null);

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
      renderWorld(ctx, w, h, worldRef.current, markersRef.current, selRef.current, marchesRef.current, viewRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const toLocal = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { px: e.clientX - rect.left, py: e.clientY - rect.top };
    };
    const onMove = (e: MouseEvent) => {
      const { px, py } = toLocal(e);
      if (dragRef.current) {
        const d = dragRef.current;
        if (Math.hypot(px - d.sx, py - d.sy) > 4) d.moved = true;
        viewRef.current.panX = d.px0 + (px - d.sx);
        viewRef.current.panY = d.py0 + (py - d.sy);
        canvas.style.cursor = "grabbing";
        return;
      }
      const layout = getWorldLayout(canvas.clientWidth, canvas.clientHeight, worldRef.current, viewRef.current);
      canvas.style.cursor = worldMarkerAt(layout, markersRef.current, px, py) ? "pointer" : "grab";
    };
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const { px, py } = toLocal(e);
      dragRef.current = { sx: px, sy: py, px0: viewRef.current.panX, py0: viewRef.current.panY, moved: false };
    };
    const onUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const d = dragRef.current;
      dragRef.current = null;
      if (d && !d.moved) {
        const { px, py } = toLocal(e);
        const layout = getWorldLayout(canvas.clientWidth, canvas.clientHeight, worldRef.current, viewRef.current);
        const m = worldMarkerAt(layout, markersRef.current, px, py);
        onSelect(m ? m.id : null);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.15 : 0.87;
      viewRef.current.zoom = Math.max(0.7, Math.min(4, viewRef.current.zoom * f));
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className="h-full w-full rounded-xl" />;
}
