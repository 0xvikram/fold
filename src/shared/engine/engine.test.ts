import { describe, expect, it } from "vitest";
import { area, creaseFromDrag, fold, freshSheet, match, reflect, silhouette } from "./geometry";
import { makePuzzle, parForDay, SIL, SOLVED_AT } from "./puzzle";

const total = (s: ReturnType<typeof freshSheet>) => s.reduce((a, l) => a + area(l.poly), 0);

describe("fold geometry", () => {
  it("folding the right edge onto the left halves the square and keeps all the paper", () => {
    const line = creaseFromDrag({ x: 1, y: 0.5 }, { x: 0, y: 0.5 })!;
    const s = fold(freshSheet(), line)!;
    expect(s).toHaveLength(2);
    expect(total(s)).toBeCloseTo(1, 6);
    const sil = silhouette(s, 70);
    expect((sil.reduce((a, v) => a + v, 0) / sil.length) * 1.75 * 1.75).toBeCloseTo(0.5, 1);
    expect(s[1].flipped).toBe(true);
  });

  it("a corner-to-corner fold makes a triangle", () => {
    const s = fold(freshSheet(), creaseFromDrag({ x: 1, y: 1 }, { x: 0, y: 0 })!)!;
    const sil = silhouette(s, 112);
    expect((sil.reduce((a, v) => a + v, 0) / sil.length) * 1.75 * 1.75).toBeCloseTo(0.5, 1);
    expect(total(s)).toBeCloseTo(1, 6);
  });

  it("a crease outside the paper does nothing", () => {
    expect(fold(freshSheet(), creaseFromDrag({ x: 3, y: 3 }, { x: 2.5, y: 2.5 })!)).toBeNull();
  });

  it("reflecting twice is the identity", () => {
    const line = creaseFromDrag({ x: 0.9, y: 0.2 }, { x: 0.1, y: 0.6 })!;
    const q = { x: 0.3, y: 0.7 };
    const r = reflect(reflect(q, line), line);
    expect(r.x).toBeCloseTo(q.x, 9);
    expect(r.y).toBeCloseTo(q.y, 9);
  });

  it("match is 1 for identical silhouettes", () => {
    const a = silhouette(freshSheet(), 20);
    expect(match(a, a)).toBe(1);
  });
});

describe("daily puzzles", () => {
  it("is the same for everyone on a day and different across days", () => {
    const a = makePuzzle("2026-12-01", 3);
    const b = makePuzzle("2026-12-01", 3);
    const c = makePuzzle("2026-12-02", 3);
    expect(match(a.target, b.target)).toBe(1);
    expect(match(a.target, c.target)).toBeLessThan(0.95);
  });

  it("the stored solution reproduces the target exactly", () => {
    for (const day of ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"]) {
      const p = makePuzzle(day, parForDay(day));
      let s = freshSheet();
      for (const st of p.steps) s = fold(s, creaseFromDrag(st.from, st.to)!)!;
      expect(match(silhouette(s, SIL), p.target)).toBeGreaterThan(SOLVED_AT);
      expect(p.steps).toHaveLength(p.par);
    }
  });

  it("gets harder through the week", () => {
    expect(parForDay("2026-11-23")).toBe(2); // Monday
    expect(parForDay("2026-11-29")).toBe(5); // Sunday
  });
});

describe("puzzle shapes stay on screen", () => {
  it("every puzzle for two weeks fits the view and is solvable", () => {
    for (let d = 1; d <= 14; d++) {
      const day = `2026-12-${String(d).padStart(2, "0")}`;
      const p = makePuzzle(day, parForDay(day));
      expect(p.steps.length).toBe(p.par);
    }
  });
});

import { nextStreak, shareText, stars, tier, verdict } from "./game";

describe("scoring and streaks", () => {
  const base = { day: "2026-12-01", folds: 3, par: 3, match: 0.99, hinted: false };
  it("gives stars for match, par and no hint", () => {
    expect(stars(base)).toBe(3);
    expect(stars({ ...base, folds: 4 })).toBe(2);
    expect(stars({ ...base, hinted: true, folds: 5 })).toBe(1);
    expect(stars({ ...base, match: 0.9 })).toBe(0);
    expect(verdict({ ...base, folds: 2 })).toBe("Under par. Paper master.");
  });
  it("share text has no spoilers, only progress", () => {
    const t = shareText(base, [0.4, 0.7, 0.99], 4);
    expect(t).toContain("⬜🟨🟧");
    expect(t).toContain("3/3 folds");
    expect(t).toContain("4 day streak");
  });
  it("streak grows on consecutive days and resets after a gap", () => {
    let s = { current: 0, best: 0, last: null as string | null };
    s = nextStreak(s, "2026-12-01");
    s = nextStreak(s, "2026-12-02");
    expect(s.current).toBe(2);
    s = nextStreak(s, "2026-12-02");
    expect(s.current).toBe(2);
    s = nextStreak(s, "2026-12-05");
    expect(s).toEqual({ current: 1, best: 2, last: "2026-12-05" });
  });
  it("flair tiers", () => {
    expect(tier(0)).toBe("Flat Sheet");
    expect(tier(25)).toBe("Paper Plane");
  });
});

import { analyze, buildFromSteps, fingerprint } from "./maker";

describe("puzzle maker rules", () => {
  it("accepts every generated daily puzzle's own folds", () => {
    for (const day of ["2026-12-01", "2026-12-02", "2026-12-03"]) {
      const p = makePuzzle(day, parForDay(day));
      const b = buildFromSteps(p.steps, { snapped: true });
      expect(b.ok).toBe(true);
      if (b.ok) expect(match(b.sil, p.target)).toBeGreaterThan(SOLVED_AT);
    }
  });
  it("rejects one fold, unsnapped drops and starts that are not corners", () => {
    expect(buildFromSteps([{ from: { x: 1, y: 1 }, to: { x: 0, y: 0 } }]).ok).toBe(false);
    const r = buildFromSteps([
      { from: { x: 1, y: 1 }, to: { x: 0.33, y: 0.41 } },
      { from: { x: 0, y: 0 }, to: { x: 0.5, y: 0.5 } },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/snap/);
    const c = buildFromSteps([
      { from: { x: 0.5, y: 0.5 }, to: { x: 0, y: 0 } },
      { from: { x: 0, y: 0 }, to: { x: 0.5, y: 0.5 } },
    ]);
    expect(c.ok).toBe(false);
  });
  it("rejects a plain rectangle", () => {
    const r = buildFromSteps([
      { from: { x: 1, y: 0 }, to: { x: 0, y: 0 } },
      { from: { x: 0, y: 1 }, to: { x: 0, y: 0 } },
    ]);
    expect(r.ok).toBe(false);
  });
  it("fingerprints match for the same shape", () => {
    const p = makePuzzle("2026-12-01", 3);
    expect(fingerprint(p.target)).toBe(fingerprint(makePuzzle("2026-12-01", 3).target));
  });
});

describe("maker feedback per fold", () => {
  it("names the fold that barely changes the shape", () => {
    // Fold the right edge onto the left, then fold a corner of the folded strip back onto itself (no change).
    const steps = [
      { from: { x: 1, y: 1 }, to: { x: 0, y: 0 } },
      { from: { x: 0, y: 0 }, to: { x: 0, y: 0.125 } },
    ];
    const a = analyze(steps);
    expect(a.perFold.length).toBe(2);
    expect(a.perFold[0]).toBeNull();
  });
});
