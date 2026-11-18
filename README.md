# Fold

**A new paper every day. Fold it into the shape.**

Fold is a daily puzzle for Reddit. Everyone gets the same paper square and the same silhouette. Press a corner, drag it to where it should land, and the paper creases and flips like real paper. Match the shape in as few folds as you can. Then fold tomorrow's puzzle yourself and let the community vote it in.

Built for Reddit's Game of the Day Hackathon on Devvit Web.

## How to play

1. Look at the striped shape.
2. Drag a corner dot of the paper to where it should land. A red line shows the crease, and the meter shows how close that fold would get you.
3. Match the shape in par or fewer folds.

Monday puzzles take 2 folds and Sunday's take 5, so the week gets harder as it goes.

- **Stars:** 1 for matching, 1 for doing it in par or fewer, 1 for no hint. A hint shows the first fold and costs a star.
- **Streaks** count consecutive days solved. All-time stars set your flair, from Flat Sheet to Origami Master.
- **Crowd chart:** after you solve it, you see how many folds everyone else needed, and the top folders of the day.
- **Share my result** replies to the pinned comment with a spoiler-free grid, like this:

```
Fold #12 ★★★
⬜🟨🟧  3/3 folds
5 day streak
```

## Made by the community

The **Make** tab lets anyone fold their own puzzle (2 to 6 folds). Every fold is checked as you make it: if a fold barely changes the shape or pushes paper off the board, Fold says so and shows what to undo. The finished shape must read well (not a sliver, not a plain rectangle).

Submitted puzzles appear in the **Vote** tab. One vote per player per puzzle, no voting for your own. At 00:00 UTC the most-voted puzzle becomes the daily Fold, and its post, feed card and game say "folded by u/name". With no votes, a generated puzzle runs instead.

Puzzles are stored as folds only, never free text, so there is nothing to moderate and every community puzzle is guaranteed solvable.

## How it works

- **Engine** (`src/shared/engine`): paper is a stack of flat layers. A fold clips each layer by the crease and reflects the moving part on top. Matching is overlap-over-union of the two silhouettes on a 112 by 112 grid; 97% counts as matched. Daily puzzles come from a seeded random sequence of real folds (corner onto a snap point), so they are always solvable, the same for everyone, and graded by the weekday par.
- **Fair scores:** the client only sends the folds. The server replays them from a fresh square and computes the match itself, so a result cannot be faked.
- **Server** (`src/server`, Hono on Devvit): Redis stores each player's result, streak and stars, a per-day fold-count histogram, a sorted-set leaderboard, and the community puzzle queue and votes. A scheduler task posts the daily puzzle at 00:00 UTC with a pinned comment.
- **Reddit rules:** the result comment is posted only when the player taps Share, as its own action. Fold never comments, posts or subscribes on its own.
- **Client** (`src/client`): React on a canvas. The feed card (`splash.tsx`) is kept light; the game (`FoldGame.tsx`, `Board.tsx`, `Maker.tsx`, `Queue.tsx`) opens in expanded view.

## For moderators

Install the app, and the first puzzle is posted. A new one follows every day at 00:00 UTC. If one is ever missing, use the subreddit menu item **Post today's Fold**.

## Run it

```bash
npm install
npm test          # engine tests: folds, daily puzzles, scoring, streaks, maker rules
npm run dev       # devvit playtest in your test subreddit
```

## Credits

Built from Reddit's Devvit Web React template (`reddit/devvit-template-react`). All game code, art and puzzles are original. AI coding assistance (Claude Code) was used during development.

## License

BSD-3-Clause, as in the template.
