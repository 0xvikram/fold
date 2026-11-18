import { Hono } from 'hono';
import { createDailyPost } from '../core/fold';

export const scheduler = new Hono();

// Runs at 00:00 UTC: one new paper for everyone.
scheduler.post('/daily-post', async (c) => {
  try {
    const r = await createDailyPost();
    return c.json({ status: 'success', message: r.created ? `Posted ${r.id}` : 'Already posted today' });
  } catch (e) {
    console.error('daily post failed', e);
    return c.json({ status: 'error', message: String(e) }, 500);
  }
});
