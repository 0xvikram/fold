import { useEffect, useRef } from "react";
import type { Sheet } from "../shared/engine/geometry";

/** A flat silhouette of a puzzle, for the feed card and the vote list. */
export function Shape({ sheet, size = 120, color = "#3b3a4a" }: { sheet: Sheet; size?: number; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const l of sheet) for (const q of l.poly) { minX = Math.min(minX, q.x); minY = Math.min(minY, q.y); maxX = Math.max(maxX, q.x); maxY = Math.max(maxY, q.y); }
    const span = Math.max(maxX - minX, maxY - minY) * 1.15 || 1;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    g.fillStyle = color;
    for (const l of sheet) {
      g.beginPath();
      l.poly.forEach((q, i) => {
        const x = ((q.x - cx) / span + 0.5) * size, y = ((q.y - cy) / span + 0.5) * size;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      });
      g.closePath();
      g.fill();
    }
  }, [sheet, size, color]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-label="Puzzle shape" />;
}
