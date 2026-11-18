// Rules every puzzle must pass, whether the daily generator made it or a player folded it.
import { area, bounds, creaseFromDrag, fold, freshSheet, match, silhouette, VIEW, type Pt, type Sheet } from './geometry';
import { corners, gridPoints } from './puzzle';

export type Step = { from: Pt; to: Pt };

export const MAKER_MIN_FOLDS = 2;
export const MAKER_MAX_FOLDS = 6;
const SIL_N = 112;
const close = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;

/** Why a finished shape would make a poor puzzle, or null if it reads well. */
export function shapeIssue(sheet: Sheet, sil: Uint8Array): string | null {
  const b = bounds(sheet);
  const pad = 0.04;
  if (b.minX < VIEW.min + pad || b.minY < VIEW.min + pad || b.maxX > VIEW.max - pad || b.maxY > VIEW.max - pad) return 'Part of the paper ends up off the board.';
  const span = VIEW.max - VIEW.min;
  const filled = (sil.reduce((s, v) => s + v, 0) / sil.length) * span * span;
  if (filled < 0.07) return 'The shape is too small to see. Undo a fold.';
  if (filled > 0.66) return 'The shape is almost the whole square. Fold more.';
  const boxFill = filled / Math.max(1e-6, (b.maxX - b.minX) * (b.maxY - b.minY));
  if (boxFill > 0.97) return 'Plain rectangles are too easy. Try a corner fold.';
  const total = sheet.reduce((s, l) => s + area(l.poly), 0);
  if (total < 0.99) return 'Some paper went missing.';
  return null;
}

export type Built = { ok: true; sheet: Sheet; sil: Uint8Array; par: number } | { ok: false; reason: string; at?: number };

/** Rebuild a puzzle from its folds and check it. Drops must land on the snap grid or a paper corner. */
export function buildFromSteps(steps: Step[], opts: { snapped: boolean; min?: number; max?: number } = { snapped: true }): Built {
  const min = opts.min ?? MAKER_MIN_FOLDS;
  const max = opts.max ?? MAKER_MAX_FOLDS;
  if (!Array.isArray(steps) || steps.length < min) return { ok: false, reason: `Make at least ${min} folds.` };
  if (steps.length > max) return { ok: false, reason: `Keep it to ${max} folds or fewer.` };
  let sheet = freshSheet();
  let sil = silhouette(sheet, SIL_N);
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    if (!st || !Number.isFinite(st.from?.x) || !Number.isFinite(st.from?.y) || !Number.isFinite(st.to?.x) || !Number.isFinite(st.to?.y)) return { ok: false, reason: 'Bad fold data.', at: i };
    const cs = corners(sheet);
    if (!cs.some((c) => close(c, st.from))) return { ok: false, reason: 'Folds must start from a corner of the paper.', at: i };
    if (opts.snapped && ![...gridPoints(), ...cs].some((p) => close(p, st.to))) return { ok: false, reason: 'Drop each corner on a snap point.', at: i };
    const line = creaseFromDrag(st.from, st.to);
    const next = line ? fold(sheet, line) : null;
    if (!next) return { ok: false, reason: 'That fold misses the paper.', at: i };
    const nextSil = silhouette(next, SIL_N);
    if (1 - match(sil, nextSil) < 0.08) return { ok: false, reason: 'One fold barely changes the shape. Players could not see it.', at: i };
    sheet = next;
    sil = nextSil;
  }
  const issue = shapeIssue(sheet, sil);
  if (issue) return { ok: false, reason: issue };
  return { ok: true, sheet, sil, par: steps.length };
}

/** Problems with one fold, found the moment it is made. */
export function foldIssue(prevSil: Uint8Array, next: Sheet, nextSil: Uint8Array): string | null {
  const b = bounds(next);
  const pad = 0.04;
  if (b.minX < VIEW.min + pad || b.minY < VIEW.min + pad || b.maxX > VIEW.max - pad || b.maxY > VIEW.max - pad) return 'it pushes paper off the board';
  if (1 - match(prevSil, nextSil) < 0.08) return 'it barely changes the shape, so players could not see it';
  return null;
}

export type Analysis = { perFold: (string | null)[]; final: Built | null };

/** Check each fold as it is made, then the finished shape, so the maker always knows what to undo. */
export function analyze(steps: Step[]): Analysis {
  let sheet = freshSheet();
  let sil = silhouette(sheet, SIL_N);
  const perFold: (string | null)[] = [];
  for (const st of steps) {
    const line = creaseFromDrag(st.from, st.to);
    const next = line ? fold(sheet, line) : null;
    if (!next) {
      perFold.push('that fold misses the paper');
      continue;
    }
    const nextSil = silhouette(next, SIL_N);
    perFold.push(foldIssue(sil, next, nextSil));
    sheet = next;
    sil = nextSil;
  }
  return { perFold, final: steps.length >= MAKER_MIN_FOLDS ? buildFromSteps(steps, { snapped: true }) : null };
}

/** A short fingerprint of a silhouette, to spot duplicate submissions. */
export function fingerprint(sil: Uint8Array): string {
  let h = 2166136261;
  for (let i = 0; i < sil.length; i++) h = Math.imul(h ^ sil[i], 16777619);
  return (h >>> 0).toString(36);
}
