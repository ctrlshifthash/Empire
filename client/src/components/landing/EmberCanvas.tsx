import { useEffect, useRef } from "react";

interface Ember {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  life: number;
  maxLife: number;
  hue: number;
}

// A lightweight canvas of drifting embers/sparks for the hero backdrop.
export default function EmberCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const embers: Ember[] = [];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = (): Ember => {
      const maxLife = 180 + Math.random() * 220;
      return {
        x: Math.random() * w,
        y: h + 10,
        r: 0.6 + Math.random() * 2.2,
        vy: -(0.2 + Math.random() * 0.7),
        vx: (Math.random() - 0.5) * 0.3,
        life: 0,
        maxLife,
        hue: 35 + Math.random() * 20,
      };
    };

    const target = Math.min(90, Math.floor(w / 14));
    for (let i = 0; i < target; i++) {
      const e = spawn();
      e.y = Math.random() * h;
      e.life = Math.random() * e.maxLife;
      embers.push(e);
    }

    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(2.5, (t - last) / 16.67);
      last = t;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        e.life += dt;
        e.x += e.vx * dt + Math.sin((e.life + i) * 0.02) * 0.25;
        e.y += e.vy * dt;
        if (e.life >= e.maxLife || e.y < -10) {
          embers[i] = spawn();
          continue;
        }
        const k = e.life / e.maxLife;
        const alpha = Math.sin(k * Math.PI) * 0.8;
        const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 4);
        grd.addColorStop(0, `hsla(${e.hue}, 95%, 65%, ${alpha})`);
        grd.addColorStop(1, "hsla(35, 95%, 55%, 0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
