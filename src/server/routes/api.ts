import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type { ErrorResponse, InitResponse, MakeRequest, MakeResponse, QueueResponse, ShareResponse, SubmitRequest, SubmitResponse, VoteResponse } from '../../shared/api';
import { shareText } from '../../shared/engine/game';
import {
  dayForPost,
  foldNumber,
  getCrowd,
  getPlayed,
  getStats,
  isShared,
  markShared,
  MAKER_DAILY_LIMIT,
  puzzleFor,
  queue,
  rankOf,
  recordSolve,
  stickyFor,
  submitMade,
  vote,
  VOTES_TO_PUBLISH,
} from '../core/fold';

export const api = new Hono();

const fail = (message: string) => ({ status: 'error', message }) satisfies ErrorResponse;

api.get('/init', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('This post is missing its id.'), 400);
  try {
    const day = await dayForPost(postId);
    const username = (await reddit.getCurrentUsername()) ?? null;
    const pz = await puzzleFor(day);
    const [stats, played, crowd, shared] = await Promise.all([
      username ? getStats(username) : Promise.resolve({ streak: 0, best: 0, last: null, stars: 0, solves: 0 }),
      username ? getPlayed(day, username) : Promise.resolve(null),
      getCrowd(day),
      username ? isShared(day, username) : Promise.resolve(false),
    ]);
    return c.json<InitResponse>({ type: 'init', day, number: foldNumber(day), par: pz.par, shape: pz.sheet, hint: pz.hint, author: pz.author, username, stats, played, crowd, shared });
  } catch (e) {
    console.error('init failed', e);
    return c.json(fail('Could not load today’s paper. Try again in a moment.'), 500);
  }
});

api.post('/submit', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('This post is missing its id.'), 400);
  const username = await reddit.getCurrentUsername();
  if (!username) return c.json(fail('Log in to save your result and streak.'), 401);
  let body: SubmitRequest;
  try {
    body = await c.req.json<SubmitRequest>();
  } catch {
    return c.json(fail('Bad request.'), 400);
  }
  try {
    const day = await dayForPost(postId);
    const r = await recordSolve(day, username, body.steps, !!body.hinted);
    const [stats, crowd, rank] = await Promise.all([getStats(username), getCrowd(day), rankOf(day, username)]);
    return c.json<SubmitResponse>({ type: 'submit', played: r.played, stats, crowd, rank });
  } catch (e) {
    return c.json(fail(e instanceof Error ? e.message : 'Could not save your result.'), 400);
  }
});

// Explicit, separate action: the player taps "Share my result" to reply to the pinned comment.
api.post('/share', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('This post is missing its id.'), 400);
  const username = await reddit.getCurrentUsername();
  if (!username) return c.json(fail('Log in to share.'), 401);
  const day = await dayForPost(postId);
  const played = await getPlayed(day, username);
  if (!played) return c.json(fail('Finish today’s Fold first.'), 400);
  if (!(await markShared(day, username))) return c.json<ShareResponse>({ type: 'share', ok: false, message: 'Already shared today.' });
  const stats = await getStats(username);
  const text = shareText({ day: `#${foldNumber(day)}`, folds: played.folds, par: played.par, match: played.match, hinted: played.hinted }, played.progress, stats.streak);
  const parent = (await stickyFor(postId)) ?? (postId as `t3_${string}`);
  await reddit.submitComment({ id: parent, text, runAs: 'USER' });
  return c.json<ShareResponse>({ type: 'share', ok: true, message: 'Shared in the comments.' });
});

// ---------- puzzle maker ----------
api.get('/maker/queue', async (c) => {
  const username = (await reddit.getCurrentUsername()) ?? null;
  const items = await queue(username);
  return c.json<QueueResponse>({ type: 'queue', items, limit: MAKER_DAILY_LIMIT, votesToPublish: VOTES_TO_PUBLISH });
});

api.post('/maker/submit', async (c) => {
  const username = await reddit.getCurrentUsername();
  if (!username) return c.json(fail('Log in to submit a puzzle.'), 401);
  try {
    const body = await c.req.json<MakeRequest>();
    const r = await submitMade(username, body.steps);
    return c.json<MakeResponse>({ type: 'made', id: r.id, message: 'Submitted. If it gets the most votes, it becomes a daily Fold.' });
  } catch (e) {
    return c.json(fail(e instanceof Error ? e.message : 'Could not submit.'), 400);
  }
});

api.post('/maker/vote', async (c) => {
  const username = await reddit.getCurrentUsername();
  if (!username) return c.json(fail('Log in to vote.'), 401);
  try {
    const { id } = await c.req.json<{ id: string }>();
    const votes = await vote(username, String(id));
    return c.json<VoteResponse>({ type: 'vote', votes });
  } catch (e) {
    return c.json(fail(e instanceof Error ? e.message : 'Could not vote.'), 400);
  }
});
