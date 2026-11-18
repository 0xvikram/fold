# Devpost submission text: Fold

Paste each section into the matching Devpost field.

## Name
Fold

## Tagline (one line)
A new paper every day. Fold it into the shape.

## Inspiration
Everyone has folded a piece of paper, in every country, at every age. That makes folding a puzzle anyone can read in one look, with no words, rules or language barrier. We wanted a daily game that feels physical: you press a corner, drag it, and the paper creases and flips like the real thing.

## What it does
Every day at 00:00 UTC, Fold posts one puzzle for the whole subreddit: a paper square and a striped target shape. Drag a corner to where it should land; a red line shows the crease and a meter shows how close that fold would get you before you let go. Match the shape (97% or better) in par folds or fewer.

- **Daily rhythm:** par rises through the week, 2 folds on Monday up to 5 on Sunday.
- **Three stars:** match it, do it in par, skip the hint. Streaks build across days, and all-time stars set your subreddit flair, from Flat Sheet to Origami Master.
- **The crowd:** after solving you see how many folds everyone else needed and the day's top folders.
- **Spoiler-free sharing:** one tap replies to the pinned daily comment with a small result grid. Fold never posts for you on its own.
- **Made by the community:** the Make tab lets anyone fold their own puzzle (2 to 6 folds). Players vote in the Vote tab, and a puzzle with at least 3 votes can become the next daily Fold, credited "folded by u/name". Puzzles are stored as folds, never free text, so there is nothing to moderate.

## How we built it
Devvit Web with a React client and a Hono server.
- **Engine:** paper is a stack of flat layers. A fold clips each layer by the crease and reflects the moving part on top. Matching is overlap over union of the two silhouettes on a 112 x 112 grid. Daily puzzles come from a seeded sequence of real folds, so every puzzle is solvable and the same for everyone.
- **Fair scores:** the client only sends the folds. The server replays them on a fresh square and computes the match itself.
- **Redis:** results, streaks and stars, a per-day fold-count histogram, a sorted-set leaderboard, and the community puzzle queue and votes.
- **Scheduler:** posts the daily puzzle at 00:00 UTC with a pinned comment; moderators also get a "Post today's Fold" menu item.
- **Maker rules:** every fold in a community puzzle must visibly change the shape and stay on the board, and the result must read as a shape (not a sliver or a plain rectangle).

## Challenges we ran into
Making a fold feel like paper on a phone: the crease has to follow your finger, snap to clean points so others can match a puzzle exactly, and animate as a page-turn rather than a jump. Getting a fair daily difficulty took a weekday par system tied to how many real folds built the puzzle.

## Accomplishments we're proud of
The whole game is learned from three short lines and the first fold. And community puzzles are guaranteed solvable, because they are recorded as the folds their maker actually did.

## What we learned
A meter that shows "58.9% match if you fold here" while you drag turns trial and error into a readable puzzle: you can test a fold before you commit to it.

## What's next for Fold
Themed weeks voted by the community, a weekly "hardest Fold" leaderboard, and more paper: rectangles and pre-creased sheets.

## Links
- App: https://developers.reddit.com/apps/fold1o1
- Demo post: (add the public test subreddit post URL)
- Code: https://github.com/0xvikram/fold
- Site: https://fold-daily.vercel.app
- Video: (add the YouTube link)

## Built with
devvit, react, typescript, hono, redis, vite, canvas
