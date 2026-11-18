import { area, bounds, creaseFromDrag, fold, freshSheet, match, silhouette, VIEW, type Pt, type Sheet } from "./geometry";

// Deterministic RNG so every player gets the same puzzle for a date.
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export function seedFor(day: string): number {
  let h = 2166136261;
  for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export const GRID = 8; // drop points snap to an 8 x 8 grid

/** Distinct corners of all layers: the points a player can grab. */
export function corners(sheet: Sheet): Pt[] {
  const out: Pt[] = [];
  for (const l of sheet)
    for (const q of l.poly) if (!out.some((o) => Math.hypot(o.x - q.x, o.y - q.y) < 1e-4)) out.push(q);
  return out;
}

export function gridPoints(): Pt[] {
  const out: Pt[] = [];
  for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) out.push({ x: i / GRID, y: j / GRID });
  return out;
}

export function nearest(q: Pt, pts: Pt[], within: number): Pt | null {
  let best: Pt | null = null;
  let d = within;
  for (const p of pts) {
    const dd = Math.hypot(p.x - q.x, p.y - q.y);
    if (dd < d) {
      d = dd;
      best = p;
    }
  }
  return best;
}

export interface Puzzle {
  day: string;
  par: number;
  target: Uint8Array;
  steps: { from: Pt; to: Pt }[]; // one known solution (kept server-side in the real game)
  sheet: Sheet;
}

const SIL_N = 112;

/** Build the puzzle for a day: `par` folds of corner-onto-snap-point, each changing the silhouette noticeably. */
export function makePuzzle(day: string, par = 3): Puzzle {
  for (let attempt = 0; attempt < 400; attempt++) {
    const r = rng(seedFor(day) + attempt * 7919);
    let sheet = freshSheet();
    let sil = silhouette(sheet, SIL_N);
    const steps: { from: Pt; to: Pt }[] = [];
    let ok = true;
    for (let k = 0; k < par && ok; k++) {
      ok = false;
      for (let tries = 0; tries < 60; tries++) {
        const cs = corners(sheet);
        const from = cs[Math.floor(r() * cs.length)];
        const targets = [...gridPoints(), ...cs].filter((p) => Math.hypot(p.x - from.x, p.y - from.y) > 0.12);
        const to = targets[Math.floor(r() * targets.length)];
        const line = creaseFromDrag(from, to);
        if (!line) continue;
        const next = fold(sheet, line);
        if (!next) continue;
        const nextSil = silhouette(next, SIL_N);
        const changed = 1 - match(sil, nextSil);
        if (changed < 0.08) continue; // a fold that barely shows is not fair
        sheet = next;
        sil = nextSil;
        steps.push({ from, to });
        ok = true;
        break;
      }
    }
    if (!ok) continue;
    // Keep shapes that read well: not a sliver, not almost the whole square, and not a plain rectangle.
    const b = bounds(sheet);
    const pad = 0.04;
    if (b.minX < VIEW.min + pad || b.minY < VIEW.min + pad || b.maxX > VIEW.max - pad || b.maxY > VIEW.max - pad) continue;
    const span = VIEW.max - VIEW.min;
    const filled = (sil.reduce((s, v) => s + v, 0) / sil.length) * span * span; // in units of the starting square
    const boxFill = filled / Math.max(1e-6, (b.maxX - b.minX) * (b.maxY - b.minY));
    const totalArea = sheet.reduce((s, l) => s + area(l.poly), 0);
    if (filled < 0.18 || filled > 0.62 || boxFill > 0.97 || totalArea < 0.99) continue;
    return { day, par, target: sil, steps, sheet };
  }
  throw new Error(`No puzzle for ${day}`);
}

/** Difficulty ladder through the week: Monday 2 folds, Sunday 5. */
export function parForDay(day: string): number {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 Sunday
  return [5, 2, 2, 3, 3, 4, 4][dow];
}

export const SOLVED_AT = 0.97;
export const SIL = SIL_N;
