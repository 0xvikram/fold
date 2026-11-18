// Scoring, streaks and the spoiler-free share grid.

export interface Result {
  day: string;
  folds: number;
  par: number;
  match: number; // 0..1
  hinted: boolean;
}

/** 1 star for matching, 1 for doing it in par or fewer, 1 for no hint. 0 if not matched. */
export function stars(r: Result, solvedAt = 0.97): 0 | 1 | 2 | 3 {
  if (r.match < solvedAt) return 0;
  return (1 + (r.folds <= r.par ? 1 : 0) + (r.hinted ? 0 : 1)) as 1 | 2 | 3;
}

export function verdict(r: Result): string {
  const s = stars(r);
  if (s === 0) return "Not quite";
  if (r.folds < r.par && !r.hinted) return "Under par. Paper master.";
  if (s === 3) return "Perfect fold";
  if (r.folds <= r.par) return "Matched in par";
  return "Matched";
}

/** A share grid that gives nothing away: one square per fold, coloured by how close each fold got you. */
export function shareText(r: Result, progress: number[], streak: number): string {
  const blocks = progress.map((m, i) => (i === progress.length - 1 && m >= 0.97 ? "🟧" : m >= 0.6 ? "🟨" : "⬜")).join("");
  const s = stars(r);
  return [
    `Fold ${r.day} ${"★".repeat(s)}${"☆".repeat(3 - s)}`,
    `${blocks}  ${r.folds}/${r.par} folds${r.hinted ? " · hint" : ""}`,
    streak > 1 ? `${streak} day streak` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface Streak {
  current: number;
  best: number;
  last: string | null; // last day solved, YYYY-MM-DD
}

const dayBefore = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export function nextStreak(s: Streak, day: string): Streak {
  if (s.last === day) return s;
  const current = s.last === dayBefore(day) ? s.current + 1 : 1;
  return { current, best: Math.max(s.best, current), last: day };
}

/** Flair tier from total stars, for Reddit user flair. */
export function tier(totalStars: number): string {
  if (totalStars >= 150) return "Origami Master";
  if (totalStars >= 60) return "Crane Folder";
  if (totalStars >= 20) return "Paper Plane";
  if (totalStars >= 5) return "Creaser";
  return "Flat Sheet";
}
