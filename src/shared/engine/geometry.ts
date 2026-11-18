// Paper folding geometry. Paper lives in a unit square [0,1]x[0,1].
// A sheet is a stack of flat polygons (layers). A fold reflects everything on one side of a line onto the other side.

export type Pt = { x: number; y: number };
export type Poly = Pt[];

export interface Line {
  p: Pt; // a point on the crease
  n: Pt; // unit normal; the side with dot(q - p, n) > 0 is the side that moves
}

const EPS = 1e-9;

export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
export const len = (a: Pt) => Math.hypot(a.x, a.y);

export const SQUARE: Poly = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** The crease made by dragging paper point `from` onto `to`: the perpendicular bisector. Moving side contains `from`. */
export function creaseFromDrag(from: Pt, to: Pt): Line | null {
  const d = sub(from, to);
  const l = len(d);
  if (l < 1e-4) return null;
  return { p: mul(add(from, to), 0.5), n: mul(d, 1 / l) };
}

export const side = (q: Pt, line: Line) => dot(sub(q, line.p), line.n);

export function reflect(q: Pt, line: Line): Pt {
  const s = side(q, line);
  return sub(q, mul(line.n, 2 * s));
}

/** Clip a polygon to the half-plane where sign * side(q) >= 0 (Sutherland-Hodgman). */
export function clip(poly: Poly, line: Line, sign: 1 | -1): Poly {
  const out: Poly = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = sign * side(a, line);
    const sb = sign * side(b, line);
    if (sa >= -EPS) out.push(a);
    if ((sa > EPS && sb < -EPS) || (sa < -EPS && sb > EPS)) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return dedupe(out);
}

function dedupe(poly: Poly): Poly {
  const out: Poly = [];
  for (const q of poly) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - q.x) > 1e-7 || Math.abs(last.y - q.y) > 1e-7) out.push(q);
  }
  if (out.length > 1 && Math.abs(out[0].x - out[out.length - 1].x) < 1e-7 && Math.abs(out[0].y - out[out.length - 1].y) < 1e-7) out.pop();
  return out;
}

export function area(poly: Poly): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export interface Layer {
  poly: Poly;
  flipped: boolean; // shows the back of the paper
  depth: number; // stacking order, higher is on top
}

export type Sheet = Layer[];

export const freshSheet = (): Sheet => [{ poly: SQUARE, flipped: false, depth: 0 }];

/**
 * Fold the sheet along `line`: layers on the moving side (side > 0) are reflected and land on top, in reverse
 * order (the top of the moving part ends up at the bottom of the new stack, like real paper). Returns null if the
 * fold moves nothing or keeps nothing.
 */
export function fold(sheet: Sheet, line: Line): Sheet | null {
  const stay: Layer[] = [];
  const move: Layer[] = [];
  for (const l of sheet) {
    const keep = clip(l.poly, line, -1);
    const go = clip(l.poly, line, 1);
    if (keep.length >= 3 && area(keep) > 1e-7) stay.push({ ...l, poly: keep });
    if (go.length >= 3 && area(go) > 1e-7) move.push({ ...l, poly: go });
  }
  if (!move.length || !stay.length) return null;
  const top = Math.max(...stay.map((l) => l.depth));
  const moved = [...move]
    .sort((a, b) => b.depth - a.depth)
    .map((l, i) => ({ poly: l.poly.map((q) => reflect(q, line)).reverse(), flipped: !l.flipped, depth: top + 1 + i }));
  return [...stay, ...moved].sort((a, b) => a.depth - b.depth);
}

export function bounds(sheet: Sheet) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const l of sheet) for (const q of l.poly) {
    minX = Math.min(minX, q.x); minY = Math.min(minY, q.y); maxX = Math.max(maxX, q.x); maxY = Math.max(maxY, q.y);
  }
  return { minX, minY, maxX, maxY };
}

function inside(q: Pt, poly: Poly): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

// Folds can carry paper outside the starting square, so silhouettes cover a wider view.
export const VIEW = { min: -0.375, max: 1.375 };

/** Raster the silhouette (union of all layers) on an n x n grid over the view. */
export function silhouette(sheet: Sheet, n = 112): Uint8Array {
  const grid = new Uint8Array(n * n);
  const span = VIEW.max - VIEW.min;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const q = { x: VIEW.min + ((i + 0.5) / n) * span, y: VIEW.min + ((j + 0.5) / n) * span };
      for (const l of sheet) {
        if (inside(q, l.poly)) {
          grid[j * n + i] = 1;
          break;
        }
      }
    }
  }
  return grid;
}

/** Intersection over union of two silhouettes, 0..1. Position matters: the target sits where the paper is. */
export function match(a: Uint8Array, b: Uint8Array): number {
  let inter = 0, uni = 0;
  for (let k = 0; k < a.length; k++) {
    if (a[k] && b[k]) inter++;
    if (a[k] || b[k]) uni++;
  }
  return uni ? inter / uni : 0;
}
