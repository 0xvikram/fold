# Fold: working notes

Entry for Reddit's Game of the Day Hackathon (https://redditgameofday2026.devpost.com/). Submissions close **8 Dec 2026, 6:00 pm PT = 9 Dec, 07:30 IST**. Judging 9 to 16 Dec. Target: Best Daily Game ($15,000) or one of 10 honorable mentions ($1,000). India eligible. A project can win only one prize.

## The game (one line)

Fold a paper square to match today's silhouette in as few folds as you can. Press a point on the paper and drag it to where it should land; the crease follows your finger like real paper.

## Judging, word for word (read 17 Nov 2026)

> Delightful UX: Experiences should be built with exciting layouts and themes. While apps do not need to be perfect, it should be easy and fun to uncover what the app has to offer.
> Polish: Your submission should be as close to publishable as possible and compliant with Devvit Rules. Judges should be able to understand everything we need to know by interacting with example posts. The closer to launch quality, the higher the score here.
> Reddity: Reddit is all about community and embracing topics people care about, no matter how weird. We want apps to have their own identity, be community-minded, and bring something fresh to the platform. The best apps will bring a community together.
> Daily Content: Does your app create recurring content, challenges, and intrigue? While content does not have to strictly be daily, it should make smart use of fresh content.

Stage one is pass/fail (theme + platform use). Ties broken by criterion order.

Submit: text description; video under 1 minute (YouTube/Vimeo, public); app listing developers.reddit.com/apps/{app-name}; detailed README.md; demo post in a public test subreddit under 200 members (or dr-admin-approve installed). Do NOT submit the app for publishing; upload and playtest only. English.

They do not want: AI slop, on-the-nose Reddit theming, clones, space shooters, simple platformers, collaborative storytelling, trivia. They reward: quick onboarding without walls of text, clear visual identity, fair tuned daily difficulty, uncluttered start screen, one clear result card (stats, streak, comment, subscribe), Devvit Journeys.

## Fit check

1. Core ask: a daily game on Devvit Web that brings a community together.
2. Fold: one shared silhouette a day; score = how close (overlap %) and how few folds; after playing, see the crowd's fold counts and the best solution's fold count.
3. Reddit-y without theming: players design tomorrow's puzzle by folding a silhouette themselves (safe user content, no free text), the community upvotes one into the queue; accuracy flair and streaks; result comment posted by the player from an explicit button.

## Rivals (GitHub, 11 to 17 Nov 2026)

Crowded: light/mirror puzzles (LaserVault, Lanternlight, Lumen, Lampwright, PrismGrid, Switchyard), guess-the-subreddit x3, polls x4, word games, nonograms. Nothing about folding found. Past winners: BridgeDit (3D bridge builder, Best Daily Game 2026), Sneakle, krawlings, SerpenTiles, Hexaword, Sketchy Solutions: fresh, tactile mechanics win; level builders keep appearing; visuals carry a lot. A community post claims judges may not play, so screenshots and the video must sell the game alone.

## Devvit facts

Node 24.18+. Start from developers.reddit.com/new (React template); `npm run dev` runs `devvit playtest` (makes a dev subreddit and test post). Daily post: cron in devvit.json hitting /internal/... plus reddit.submitCustomPost. Redis 100 MB unpublished, sorted sets for leaderboards, no plain sets/lists. Journeys need review approval. Rules: comments posted as the user only from an explicit button, reply to a sticky comment; never merge gameplay with posting/commenting/subscribing; user content via limited expression (no free text); no external links or logos; LLM use and HTTP fetch need review.

## Quality bar

Launch quality, not a demo. Every state designed (first-time, playing, solved, already played today, no puzzle, error). Plain short copy, no emoji walls, no em dashes. Works great on a phone first.

## Phases

1. Engine: fold geometry (half-plane split + reflect), silhouette compare (raster IoU), daily puzzle generator with a known fold count. Prototype on a phone. GO/NO-GO on readability (by ~20 Nov).
2. Devvit app: daily post, play, result card, leaderboard, streaks, flair.
3. Community: puzzle maker (fold your own silhouette), vote queue, crowd stats.
4. Polish, subreddit branding, README, video under 1 min, submission text. Vikram submits.

## Rules

Do not publish the app, push, or submit without Vikram. Tests and typecheck pass before every commit.
