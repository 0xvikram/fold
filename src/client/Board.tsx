import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { bounds, creaseFromDrag, fold, match, mul, side, silhouette, sub, VIEW, type Line, type Pt, type Sheet } from "../shared/engine/geometry";
import { corners, gridPoints, nearest, SIL } from "../shared/engine/puzzle";
import type { Step } from "../shared/api";

const ANIM_MS = 420;

function useBoardSize(ref: RefObject<HTMLDivElement | null>) {
  const [s, setS] = useState(340);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setS(Math.floor(Math.min(e.contentRect.width, 560))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return s;
}

/** Flip animation: points on the moving side travel through the crease like a page turning. */
function animate(sheet: Sheet, line: Line, t: number): Sheet {
  const k = Math.cos(Math.PI * t);
  return sheet.map((l) => {
    const moving = l.poly.every((q) => side(q, line) >= -1e-9);
    if (!moving) return l;
    return { ...l, poly: l.poly.map((q) => sub(q, mul(line.n, side(q, line) * (1 - k)))), flipped: t > 0.5 ? !l.flipped : l.flipped };
  });
}

function clipKeep(poly: Pt[], line: Line, sign: 1 | -1): Pt[] | null {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const sa = sign * side(a, line), sb = sign * side(b, line);
    if (sa >= -1e-9) out.push(a);
    if ((sa > 1e-9 && sb < -1e-9) || (sa < -1e-9 && sb > 1e-9)) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out.length >= 3 ? out : null;
}

function splitForAnim(sheet: Sheet, line: Line): Sheet {
  const out: Sheet = [];
  for (const l of sheet) {
    const stay = clipKeep(l.poly, line, -1);
    const go = clipKeep(l.poly, line, 1);
    if (stay) out.push({ ...l, poly: stay });
    if (go) out.push({ ...l, poly: go, depth: l.depth + 1000 });
  }
  return out.sort((a, b) => a.depth - b.depth);
}

function insideAny(q: Pt, sheet: Sheet): boolean {
  for (const l of sheet) {
    let c = false;
    const p = l.poly;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      if (p[i].y > q.y !== p[j].y > q.y && q.x < ((p[j].x - p[i].x) * (q.y - p[i].y)) / (p[j].y - p[i].y) + p[i].x) c = !c;
    }
    if (c) return true;
  }
  return false;
}

/** Outer edge pieces of the union of all layers, for a crisp target rim. */
export function outlineOf(sheet: Sheet): [Pt, Pt][] {
  const segs: [Pt, Pt][] = [];
  const N = 48;
  for (const l of sheet) {
    const p = l.poly;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      const nx = dy / L, ny = -dx / L;
      let start: Pt | null = null;
      for (let k = 0; k <= N; k++) {
        const t = k / N;
        const m = { x: a.x + dx * t, y: a.y + dy * t };
        const e = 0.004;
        const outer = !insideAny({ x: m.x + nx * e, y: m.y + ny * e }, sheet) || !insideAny({ x: m.x - nx * e, y: m.y - ny * e }, sheet);
        if (outer && !start) start = m;
        if ((!outer || k === N) && start) {
          segs.push([start, m]);
          start = null;
        }
      }
    }
  }
  return segs.filter(([a, b]) => Math.hypot(a.x - b.x, a.y - b.y) > 0.015);
}

export type BoardProps = {
  sheet: Sheet;
  target?: { sheet: Sheet; sil: Uint8Array } | null;
  locked?: boolean;
  requireSnap?: boolean; // the maker only accepts drops on snap points, so others can rebuild the shape exactly
  showBounds?: boolean; // the maker sees the edge of the playable board
  hint?: Step | null;
  celebrate?: boolean;
  onFold: (step: Step, next: Sheet, matchAfter: number | null) => void;
  onPreview?: (matchIfFolded: number | null, dragging: boolean) => void;
};

export function Board({ sheet, target, locked, requireSnap, showBounds, hint, celebrate, onFold, onPreview }: BoardProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const size = useBoardSize(wrap);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<{ from: Pt; to: Pt; snapped: boolean } | null>(null);
  const [anim, setAnim] = useState<{ base: Sheet; line: Line; next: Sheet; start: number; step: Step; m: number | null } | null>(null);
  const [now, setNow] = useState(0);
  const outline = useMemo(() => (target ? outlineOf(target.sheet) : []), [target]);

  const cam = useMemo(() => {
    if (showBounds) return { cx: (VIEW.min + VIEW.max) / 2, cy: (VIEW.min + VIEW.max) / 2, span: (VIEW.max - VIEW.min) * 1.04 };
    const bs = [bounds(sheet), ...(target ? [bounds(target.sheet)] : [])];
    const minX = Math.min(0, ...bs.map((b) => b.minX)), minY = Math.min(0, ...bs.map((b) => b.minY));
    const maxX = Math.max(1, ...bs.map((b) => b.maxX)), maxY = Math.max(1, ...bs.map((b) => b.maxY));
    const span = Math.max(maxX - minX, maxY - minY) * 1.18;
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, span };
  }, [sheet, target, showBounds]);
  const toScreen = useCallback((q: Pt) => ({ x: ((q.x - cam.cx) / cam.span + 0.5) * size, y: ((q.y - cam.cy) / cam.span + 0.5) * size }), [cam, size]);
  const toPaper = (e: ReactPointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width - 0.5) * cam.span + cam.cx, y: ((e.clientY - r.top) / r.height - 0.5) * cam.span + cam.cy };
  };
  const snapR = cam.span * 0.06;
  useEffect(() => {
    (window as unknown as { __cam: unknown }).__cam = { ...cam, size };
  }, [cam, size]);

  const preview = useMemo(() => {
    if (!drag) return null;
    if (requireSnap && !drag.snapped) return null;
    const line = creaseFromDrag(drag.from, drag.to);
    if (!line) return null;
    const next = fold(sheet, line);
    return { line, next, match: next && target ? match(silhouette(next, SIL), target.sil) : null };
  }, [drag, sheet, target, requireSnap]);

  useEffect(() => {
    onPreview?.(drag && preview ? preview.match : null, !!drag);
  }, [drag, preview, onPreview]);

  useEffect(() => {
    if (!anim) return;
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - anim.start) / ANIM_MS;
      if (t >= 1) {
        setAnim(null);
        onFold(anim.step, anim.next, anim.m);
        return;
      }
      setNow(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anim, onFold]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    const path = (poly: Pt[]) => {
      g.beginPath();
      poly.forEach((q, i) => {
        const s = toScreen(q);
        if (i) g.lineTo(s.x, s.y);
        else g.moveTo(s.x, s.y);
      });
      g.closePath();
    };

    // grid; in the maker the snap points are shown as dots
    g.strokeStyle = "rgba(90, 70, 40, 0.07)";
    g.lineWidth = 1;
    for (let i = -8; i <= 16; i++) {
      const a = toScreen({ x: i / 8, y: -1 }), b = toScreen({ x: i / 8, y: 2 });
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      const c2 = toScreen({ x: -1, y: i / 8 }), d = toScreen({ x: 2, y: i / 8 });
      g.beginPath(); g.moveTo(c2.x, c2.y); g.lineTo(d.x, d.y); g.stroke();
    }
    if (requireSnap && drag) {
      g.fillStyle = "rgba(90, 70, 40, 0.28)";
      for (const q of gridPoints()) {
        const s = toScreen(q);
        g.beginPath(); g.arc(s.x, s.y, 2.2, 0, Math.PI * 2); g.fill();
      }
    }

    if (showBounds) {
      const pad = 0.04;
      const a = toScreen({ x: VIEW.min + pad, y: VIEW.min + pad }), b = toScreen({ x: VIEW.max - pad, y: VIEW.max - pad });
      g.save();
      g.setLineDash([6, 6]);
      g.strokeStyle = "rgba(184, 68, 44, 0.45)";
      g.lineWidth = 1.5;
      g.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      g.restore();
    }

    if (target) {
      g.save();
      g.fillStyle = "#3b3a4a";
      g.globalAlpha = 0.16;
      for (const l of target.sheet) { path(l.poly); g.fill(); }
      g.restore();
    }

    const shown = anim ? animate(splitForAnim(anim.base, anim.line), anim.line, now) : preview?.next && drag ? preview.next : sheet;
    for (const l of shown) {
      path(l.poly);
      g.save();
      g.shadowColor = "rgba(60, 40, 20, 0.22)";
      g.shadowBlur = 10;
      g.shadowOffsetY = 3;
      g.fillStyle = l.flipped ? "#ffb48a" : "#fffcf3";
      g.fill();
      g.restore();
      g.strokeStyle = l.flipped ? "rgba(190, 95, 50, 0.7)" : "rgba(150, 130, 100, 0.5)";
      g.lineWidth = 1.2;
      g.stroke();
    }

    if (target) {
      const off = document.createElement("canvas");
      off.width = c.width;
      off.height = c.height;
      const o = off.getContext("2d")!;
      o.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.fillStyle = "#000";
      for (const l of target.sheet) {
        o.beginPath();
        l.poly.forEach((q, i) => { const s2 = toScreen(q); if (i) o.lineTo(s2.x, s2.y); else o.moveTo(s2.x, s2.y); });
        o.closePath();
        o.fill();
      }
      const tile = document.createElement("canvas");
      tile.width = tile.height = Math.round(10 * dpr);
      const t = tile.getContext("2d")!;
      t.strokeStyle = "rgba(59, 58, 74, 0.28)";
      t.lineWidth = 2 * dpr;
      t.beginPath();
      t.moveTo(0, tile.height); t.lineTo(tile.width, 0);
      t.moveTo(-tile.width / 2, tile.height / 2); t.lineTo(tile.width / 2, -tile.height / 2);
      t.moveTo(tile.width / 2, tile.height * 1.5); t.lineTo(tile.width * 1.5, tile.height / 2);
      t.stroke();
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.globalCompositeOperation = "source-in";
      o.fillStyle = o.createPattern(tile, "repeat")!;
      o.fillRect(0, 0, off.width, off.height);
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(off, 0, 0);
      g.restore();
      g.strokeStyle = "rgba(59, 58, 74, 0.8)";
      g.lineWidth = 2;
      g.lineCap = "round";
      for (const seg of outline) {
        const a = toScreen(seg[0]), b = toScreen(seg[1]);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
    }

    if (drag) {
      const f = toScreen(drag.from), t = toScreen(drag.to);
      if (preview) {
        const { p, n } = preview.line;
        const d = { x: -n.y, y: n.x };
        const a = toScreen({ x: p.x - d.x * 4, y: p.y - d.y * 4 }), b = toScreen({ x: p.x + d.x * 4, y: p.y + d.y * 4 });
        g.setLineDash([7, 6]);
        g.strokeStyle = "#e5533d";
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        g.setLineDash([]);
      }
      g.strokeStyle = "rgba(229, 83, 61, 0.55)";
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(t.x, t.y); g.stroke();
      g.fillStyle = drag.snapped ? "#e5533d" : "rgba(229, 83, 61, 0.35)";
      g.beginPath(); g.arc(t.x, t.y, drag.snapped ? 8 : 6, 0, Math.PI * 2); g.fill();
    }

    if (hint && !anim && !drag) {
      const f = toScreen(hint.from), t = toScreen(hint.to);
      g.strokeStyle = "#2f7d5b";
      g.lineWidth = 3;
      g.setLineDash([2, 6]);
      g.lineCap = "round";
      g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(t.x, t.y); g.stroke();
      g.setLineDash([]);
      g.fillStyle = "#2f7d5b";
      g.beginPath(); g.arc(t.x, t.y, 7, 0, Math.PI * 2); g.fill();
    }

    if (!drag && !anim && !locked) {
      for (const q of corners(sheet)) {
        const s = toScreen(q);
        g.fillStyle = "#fff";
        g.strokeStyle = "#3b3a4a";
        g.lineWidth = 2;
        g.beginPath(); g.arc(s.x, s.y, 6, 0, Math.PI * 2); g.fill(); g.stroke();
      }
    }
  }, [size, sheet, preview, drag, target, anim, now, locked, hint, requireSnap, showBounds, toScreen, outline]);

  return (
    <div className="board" ref={wrap}>
      <canvas
        ref={canvas}
        style={{ width: size, height: size }}
        onPointerDown={(e) => {
          if (locked || anim) return;
          const from = nearest(toPaper(e), corners(sheet), snapR * 1.2);
          if (!from) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setDrag({ from, to: from, snapped: false });
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          const q = toPaper(e);
          const snap = nearest(q, [...gridPoints(), ...corners(sheet)], snapR);
          setDrag({ ...drag, to: snap ?? q, snapped: !!snap });
        }}
        onPointerUp={() => {
          if (drag && preview?.next) {
            setAnim({ base: sheet, line: preview.line, next: preview.next, start: performance.now(), step: { from: drag.from, to: drag.to }, m: preview.match });
          }
          setDrag(null);
        }}
        onPointerCancel={() => setDrag(null)}
      />
      {celebrate ? <div className="burst" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</div> : null}
    </div>
  );
}
