import { useEffect, useState } from "react";
import { showToast } from "@devvit/web/client";
import type { MadeItem, QueueResponse, VoteResponse } from "../shared/api";
import { Shape } from "./Shape";

// The community picks tomorrow's paper. One vote per player per puzzle; the top one runs at 00:00 UTC.
export function Queue({ loggedIn, onMake }: { loggedIn: boolean; onMake: () => void }) {
  const [items, setItems] = useState<MadeItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/maker/queue")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message ?? "Could not load");
        setItems((j as QueueResponse).items);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  return (
    <div className="app">
      <header className="top">
        <div className="brand"><span>Pick tomorrow’s Fold</span></div>
      </header>
      <p className="byline">Vote for the shape you want everyone to fold next. The top puzzle runs at 00:00 UTC.</p>
      {err ? <p className="hint err">{err}</p> : null}
      {items === null && !err ? <p className="hint">Loading puzzles…</p> : null}
      {items && items.length === 0 ? (
        <div className="empty">
          <p>No community puzzles yet.</p>
          <button className="primary" onClick={onMake}>Fold the first one</button>
        </div>
      ) : null}
      <ul className="queue">
        {items?.map((it, i) => (
          <li key={it.id} className={i === 0 && it.votes > 0 ? "lead" : ""}>
            <div className="thumb"><Shape sheet={it.shape} size={96} /></div>
            <div className="qmeta">
              <b>par {it.par}</b>
              <small>by u/{it.author}{it.mine ? " (you)" : ""}</small>
              {i === 0 && it.votes > 0 ? <span className="tag">Up next</span> : null}
            </div>
            <button
              className={`vote ${it.voted ? "on" : ""}`}
              disabled={!loggedIn || it.mine || it.voted || busy === it.id}
              onClick={async () => {
                setBusy(it.id);
                try {
                  const r = await fetch("/api/maker/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: it.id }) });
                  const j = (await r.json()) as VoteResponse & { message?: string };
                  if (!r.ok) throw new Error(j.message ?? "Could not vote");
                  setItems((xs) => (xs ? xs.map((x) => (x.id === it.id ? { ...x, votes: j.votes, voted: true } : x)).sort((a, b) => b.votes - a.votes) : xs));
                } catch (e) {
                  showToast(e instanceof Error ? e.message : "Could not vote");
                } finally {
                  setBusy(null);
                }
              }}
              aria-label={`Vote for puzzle by ${it.author}`}
            >
              ▲ <span>{it.votes}</span>
            </button>
          </li>
        ))}
      </ul>
      {items && items.length > 0 ? <button className="make-cta" onClick={onMake}>Fold your own →</button> : null}
    </div>
  );
}
