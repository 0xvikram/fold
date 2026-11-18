// Local stand-in for '@devvit/web/server', used only by `npm run preview`.
// It keeps Redis in memory and pretends one logged-in player ("you") on one post,
// so the real Hono API and game client run in a normal browser without Reddit.

type Z = { member: string; score: number };
const kv = new Map<string, string>();
const hashes = new Map<string, Map<string, string>>();
const zsets = new Map<string, Map<string, number>>();
const hash = (k: string) => hashes.get(k) ?? hashes.set(k, new Map()).get(k)!;
const zset = (k: string) => zsets.get(k) ?? zsets.set(k, new Map()).get(k)!;
const sorted = (k: string, reverse = false): Z[] =>
  [...zset(k)].map(([member, score]) => ({ member, score })).sort((a, b) => (reverse ? b.score - a.score : a.score - b.score));

export const redis = {
  async get(k: string) { return kv.get(k); },
  async set(k: string, v: string) { kv.set(k, v); return 'OK'; },
  async incrBy(k: string, n: number) { const v = Number(kv.get(k) ?? 0) + n; kv.set(k, String(v)); return v; },
  async expire() { return; },
  async hGet(k: string, f: string) { return hash(k).get(f); },
  async hSet(k: string, o: Record<string, string>) { for (const [f, v] of Object.entries(o)) hash(k).set(f, v); return Object.keys(o).length; },
  async hGetAll(k: string) { return Object.fromEntries(hash(k)); },
  async hIncrBy(k: string, f: string, n: number) { const v = Number(hash(k).get(f) ?? 0) + n; hash(k).set(f, String(v)); return v; },
  async zAdd(k: string, ...items: Z[]) { for (const i of items) zset(k).set(i.member, i.score); return items.length; },
  async zIncrBy(k: string, m: string, n: number) { const v = (zset(k).get(m) ?? 0) + n; zset(k).set(m, v); return v; },
  async zRem(k: string, ms: string[]) { for (const m of ms) zset(k).delete(m); return ms.length; },
  async zRank(k: string, m: string) { const i = sorted(k).findIndex((z) => z.member === m); return i < 0 ? undefined : i; },
  async zRange(k: string, start: number, stop: number, opts?: { reverse?: boolean }) {
    const all = sorted(k, !!opts?.reverse);
    return all.slice(start, stop < 0 ? all.length + stop + 1 : stop + 1);
  },
};

export const context = { postId: 't3_preview', subredditName: 'fold_preview', userId: 't2_you' };

export const reddit = {
  async getCurrentUsername() { return process.env.PREVIEW_USER ?? 'you'; },
  async setUserFlair() { return; },
  async submitComment(o: { text: string }) { console.log('[preview] would comment:\n' + o.text); return { id: 't1_preview' }; },
  async submitCustomPost() { return { id: 't3_preview' }; },
};

export const createServer = undefined;
export const getServerPort = () => 0;
