import { context, reddit, redis } from '@devvit/web/server';
import { creaseFromDrag, fold, freshSheet, match, silhouette, VIEW } from '../../shared/engine/geometry';
import { corners, makePuzzle, parForDay, SIL, SOLVED_AT } from '../../shared/engine/puzzle';
import { buildFromSteps, fingerprint } from '../../shared/engine/maker';
import type { Sheet } from '../../shared/engine/geometry';
import { nextStreak, stars, tier } from '../../shared/engine/game';
import type { Crowd, MadeItem, Played, PlayerStats, Step } from '../../shared/api';

export const LAUNCH_DAY = '2026-11-17';

export const todayUTC = () => new Date().toISOString().slice(0, 10);

export function foldNumber(day: string): number {
  const ms = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${LAUNCH_DAY}T00:00:00Z`);
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}

const k = {
  postDay: (postId: string) => `post:${postId}:day`,
  postSticky: (postId: string) => `post:${postId}:sticky`,
  dayPost: (day: string) => `day:${day}:post`,
  result: (day: string, user: string) => `res:${day}:${user}`,
  shared: (day: string, user: string) => `shared:${day}:${user}`,
  stats: (user: string) => `stats:${user}`,
  hist: (day: string) => `hist:${day}`,
  board: (day: string) => `board:${day}`,
};

export async function dayForPost(postId: string): Promise<string> {
  return (await redis.get(k.postDay(postId))) ?? todayUTC();
}

export type DayPuzzle = { par: number; sheet: Sheet; target: Uint8Array; hint: Step; author: string | null };

const madeKey = (day: string) => `day:${day}:made`;

/** Today's puzzle: a community puzzle if one was picked for the day, else the generated one. */
export async function puzzleFor(day: string): Promise<DayPuzzle> {
  const raw = await redis.get(madeKey(day));
  if (raw) {
    const m = JSON.parse(raw) as { steps: Step[]; author: string };
    const b = buildFromSteps(m.steps, { snapped: true });
    if (b.ok) return { par: b.par, sheet: b.sheet, target: b.sil, hint: m.steps[0]!, author: m.author };
  }
  const p = makePuzzle(day, parForDay(day));
  return { par: p.par, sheet: p.sheet, target: p.target, hint: p.steps[0]!, author: null };
}

/** Server-side check: replay the player's folds from a fresh sheet and score them. Never trust the client's score. */
export function replay(puzzle: DayPuzzle, steps: Step[]): { match: number; progress: number[] } | null {
  if (!Array.isArray(steps) || steps.length === 0 || steps.length > 24) return null;
  let sheet = freshSheet();
  const progress: number[] = [];
  for (const st of steps) {
    const ok = (q: unknown): q is { x: number; y: number } =>
      !!q && typeof q === 'object' && Number.isFinite((q as { x: number }).x) && Number.isFinite((q as { y: number }).y);
    if (!ok(st?.from) || !ok(st?.to)) return null;
    if (st.to.x < VIEW.min - 0.5 || st.to.x > VIEW.max + 0.5 || st.to.y < VIEW.min - 0.5 || st.to.y > VIEW.max + 0.5) return null;
    // The grabbed point must be a real corner of the paper at that moment.
    if (!corners(sheet).some((c) => Math.hypot(c.x - st.from.x, c.y - st.from.y) < 1e-6)) return null;
    const line = creaseFromDrag(st.from, st.to);
    if (!line) return null;
    const next = fold(sheet, line);
    if (!next) return null;
    sheet = next;
    progress.push(match(silhouette(sheet, SIL), puzzle.target));
  }
  return { match: progress[progress.length - 1] ?? 0, progress };
}

const emptyStats = (): PlayerStats => ({ streak: 0, best: 0, last: null, stars: 0, solves: 0 });

export async function getStats(user: string): Promise<PlayerStats> {
  const raw = await redis.get(k.stats(user));
  return raw ? { ...emptyStats(), ...(JSON.parse(raw) as PlayerStats) } : emptyStats();
}

export async function getPlayed(day: string, user: string): Promise<Played | null> {
  const raw = await redis.get(k.result(day, user));
  return raw ? (JSON.parse(raw) as Played) : null;
}

export async function getCrowd(day: string): Promise<Crowd> {
  const [hist, top] = await Promise.all([redis.hGetAll(k.hist(day)), redis.zRange(k.board(day), 0, 4, { by: 'rank' })]);
  const players = Object.values(hist ?? {}).reduce((s, v) => s + Number(v), 0);
  return {
    players,
    hist: Object.fromEntries(Object.entries(hist ?? {}).map(([f, n]) => [f, Number(n)])),
    top: (top ?? []).map((t) => {
      const folds = Math.floor(t.score / 100);
      return { username: t.member, folds, stars: 3 - (Math.floor(t.score) % 10) };
    }),
  };
}

export async function recordSolve(day: string, user: string, steps: Step[], hinted: boolean) {
  const existing = await getPlayed(day, user);
  if (existing) return { played: existing, already: true };
  const puzzle = await puzzleFor(day);
  const r = replay(puzzle, steps);
  if (!r) throw new Error('Those folds could not be checked. Restart and try again.');
  if (r.match < SOLVED_AT) throw new Error('Not matched yet. Keep folding.');
  const par = puzzle.par;
  const result = { day, folds: steps.length, par, match: r.match, hinted };
  const s = stars(result);
  const played: Played = { folds: steps.length, par, match: r.match, hinted, stars: s, progress: r.progress };
  const prev = await getStats(user);
  const streaked = nextStreak({ current: prev.streak, best: prev.best, last: prev.last }, day);
  const stats: PlayerStats = { streak: streaked.current, best: streaked.best, last: streaked.last, stars: prev.stars + s, solves: prev.solves + 1 };
  // Rank key: fewer folds first, then more stars (score = folds*100 + (3 - stars)).
  await Promise.all([
    redis.set(k.result(day, user), JSON.stringify(played)),
    redis.set(k.stats(user), JSON.stringify(stats)),
    redis.hIncrBy(k.hist(day), String(steps.length), 1),
    redis.zAdd(k.board(day), { member: user, score: steps.length * 100 + (3 - s) }),
  ]);
  await setFlair(user, stats.stars).catch(() => undefined);
  return { played, already: false, stats };
}

async function setFlair(user: string, totalStars: number) {
  const subredditName = context.subredditName;
  if (!subredditName) return;
  await reddit.setUserFlair({ subredditName, username: user, text: `${tier(totalStars)} · ${totalStars}★` });
}

export async function rankOf(day: string, user: string): Promise<number> {
  const r = await redis.zRank(k.board(day), user);
  return r == null ? 0 : r + 1;
}

export async function markShared(day: string, user: string): Promise<boolean> {
  const was = await redis.get(k.shared(day, user));
  if (was) return false;
  await redis.set(k.shared(day, user), '1');
  return true;
}

export async function isShared(day: string, user: string) {
  return !!(await redis.get(k.shared(day, user)));
}

export async function stickyFor(postId: string): Promise<`t1_${string}` | null> {
  const id = await redis.get(k.postSticky(postId));
  return id && id.startsWith('t1_') ? (id as `t1_${string}`) : null;
}

/** Creates the day's post (once per day per subreddit) with a pinned comment players can reply to with results. */
export async function createDailyPost(day = todayUTC()) {
  const existing = await redis.get(k.dayPost(day));
  if (existing) return { id: existing, created: false };
  const n = foldNumber(day);
  await pickCommunityPuzzle(day);
  const pz = await puzzleFor(day);
  const par = pz.par;
  const weekday = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const post = await reddit.submitCustomPost({
    title: `Fold #${n} · ${weekday} · par ${par}${pz.author ? ` · folded by u/${pz.author}` : ''}`,
    entry: 'default',
    textFallback: { text: `Today's Fold: match the shape by folding a paper square in ${par} folds or fewer.` },
  });
  await Promise.all([redis.set(k.postDay(post.id), day), redis.set(k.dayPost(day), post.id)]);
  const sticky = await reddit.submitComment({
    id: post.id,
    text: `Post your Fold #${n} result here with the "Share my result" button. No spoilers: the grid only shows how close each fold got you.`,
  });
  await sticky.distinguish(true).catch(() => undefined);
  await redis.set(k.postSticky(post.id), sticky.id);
  return { id: post.id, created: true };
}

// ---------- community puzzle maker ----------
const mk = {
  item: (id: string) => `made:${id}`,
  queue: 'made:queue',
  votes: (id: string) => `made:${id}:votes`,
  fp: (fp: string) => `made:fp:${fp}`,
  daily: (user: string, day: string) => `made:count:${user}:${day}`,
  seq: 'made:seq',
};
export const MAKER_DAILY_LIMIT = 3;
// A community puzzle needs this many upvotes before it can become a daily puzzle.
export const VOTES_TO_PUBLISH = 3;

type Stored = { id: string; steps: Step[]; author: string; at: number; par: number };

export async function submitMade(user: string, steps: Step[]): Promise<{ id: string }> {
  const b = buildFromSteps(steps, { snapped: true });
  if (!b.ok) throw new Error(b.reason);
  const fp = fingerprint(b.sil);
  if (await redis.get(mk.fp(fp))) throw new Error('Someone already folded this exact shape. Try another.');
  const today = todayUTC();
  const count = Number((await redis.get(mk.daily(user, today))) ?? 0);
  if (count >= MAKER_DAILY_LIMIT) throw new Error(`You can submit ${MAKER_DAILY_LIMIT} puzzles a day. Come back tomorrow.`);
  const id = String(await redis.incrBy(mk.seq, 1));
  const item: Stored = { id, steps, author: user, at: Date.now(), par: b.par };
  await Promise.all([
    redis.set(mk.item(id), JSON.stringify(item)),
    redis.set(mk.fp(fp), id),
    redis.incrBy(mk.daily(user, today), 1),
    redis.zAdd(mk.queue, { member: id, score: 0 }),
  ]);
  await redis.expire(mk.daily(user, today), 2 * 86_400);
  return { id };
}

export async function queue(user: string | null, limit = 12): Promise<MadeItem[]> {
  const top = await redis.zRange(mk.queue, 0, limit - 1, { by: 'rank', reverse: true });
  const out: MadeItem[] = [];
  for (const t of top) {
    const raw = await redis.get(mk.item(t.member));
    if (!raw) continue;
    const it = JSON.parse(raw) as Stored;
    const b = buildFromSteps(it.steps, { snapped: true });
    if (!b.ok) continue;
    const voted = user ? !!(await redis.hGet(mk.votes(it.id), user)) : false;
    out.push({ id: it.id, author: it.author, par: it.par, votes: t.score, shape: b.sheet, mine: user === it.author, voted });
  }
  return out;
}

export async function vote(user: string, id: string): Promise<number> {
  const raw = await redis.get(mk.item(id));
  if (!raw) throw new Error('That puzzle is gone.');
  const it = JSON.parse(raw) as Stored;
  if (it.author === user) throw new Error('You can’t vote for your own puzzle.');
  if (await redis.hGet(mk.votes(id), user)) throw new Error('Already voted.');
  await redis.hSet(mk.votes(id), { [user]: '1' });
  return redis.zIncrBy(mk.queue, id, 1);
}

/** At the daily post: the top-voted queued puzzle becomes today's, and its author gets credit. */
export async function pickCommunityPuzzle(day: string): Promise<string | null> {
  if (await redis.get(madeKey(day))) return null;
  const top = await redis.zRange(mk.queue, 0, 0, { by: 'rank', reverse: true });
  const t = top[0];
  if (!t || t.score < VOTES_TO_PUBLISH) return null;
  const raw = await redis.get(mk.item(t.member));
  if (!raw) return null;
  const it = JSON.parse(raw) as Stored;
  await Promise.all([redis.set(madeKey(day), JSON.stringify({ steps: it.steps, author: it.author })), redis.zRem(mk.queue, [it.id])]);
  return it.author;
}
