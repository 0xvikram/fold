import { useCallback, useEffect, useMemo, useState } from "react";
import { freshSheet, match, silhouette, type Sheet } from "../shared/engine/geometry";
import { Board } from "./Board";
import { Maker } from "./Maker";
import { Queue } from "./Queue";
import { SIL, SOLVED_AT } from "../shared/engine/puzzle";
import { shareText, stars, tier, verdict, type Result } from "../shared/engine/game";
import { showToast } from "@devvit/web/client";
import type { Crowd, InitResponse, Played, PlayerStats, ShareResponse, Step, SubmitResponse } from "../shared/api";
import "./game.css";


const intro = {
  seen: () => {
    try {
      return localStorage.getItem("fold.intro") === "1";
    } catch {
      return false;
    }
  },
  mark: () => {
    try {
      localStorage.setItem("fold.intro", "1");
    } catch {
      /* private mode */
    }
  },
};

export function Game() {
  const [init, setInit] = useState<InitResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/init")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message ?? "Could not load");
        setInit(j as InitResponse);
      })
      .catch((e: Error) => setLoadErr(e.message));
  }, []);
  if (loadErr) return <div className="app"><p className="hint">{loadErr}</p></div>;
  if (!init) return <div className="app loading"><Crane big /><p className="hint">Unfolding today’s paper…</p></div>;
  return <Tabs init={init} />;
}

type View = "today" | "make" | "vote";

function Tabs({ init }: { init: InitResponse }) {
  const [view, setView] = useState<View>("today");
  return (
    <>
      {view === "today" ? <Play init={init} onMake={() => setView("make")} /> : view === "make" ? <Maker loggedIn={!!init.username} onDone={() => setView("vote")} /> : <Queue loggedIn={!!init.username} onMake={() => setView("make")} />}
      <nav className="tabs" aria-label="Fold">
        <button className={view === "today" ? "on" : ""} onClick={() => setView("today")}>Today</button>
        <button className={view === "make" ? "on" : ""} onClick={() => setView("make")}>Make</button>
        <button className={view === "vote" ? "on" : ""} onClick={() => setView("vote")}>Vote</button>
      </nav>
    </>
  );
}

function Play({ init, onMake }: { init: InitResponse; onMake: () => void }) {
  const day = init.day;
  const target = useMemo(() => ({ sheet: init.shape, sil: silhouette(init.shape, SIL) }), [init.shape]);
  const [seenIntro, setSeenIntro] = useState(() => intro.seen() || init.stats.solves > 0);
  const [history, setHistory] = useState<Sheet[]>([freshSheet()]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [progress, setProgress] = useState<number[]>([]);
  const [hinted, setHinted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [played, setPlayed] = useState<Played | null>(init.played);
  const [stats, setStats] = useState<PlayerStats>(init.stats);
  const [crowd, setCrowd] = useState<Crowd>(init.crowd);
  const [rank, setRank] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [localDone, setLocalDone] = useState<Result | null>(null);
  const [live, setLive] = useState<{ m: number | null; dragging: boolean }>({ m: null, dragging: false });
  const done: Result | null = played ? { day, folds: played.folds, par: played.par, match: played.match, hinted: played.hinted } : localDone;

  const sheet = history[history.length - 1];
  const folds = history.length - 1;
  const score = useMemo(() => match(silhouette(sheet, SIL), target.sil), [sheet, target]);

  const onFold = useCallback((step: Step, next: Sheet, m: number | null) => {
    setHistory((h) => [...h, next]);
    setSteps((st) => [...st, step]);
    setProgress((p) => [...p, m ?? 0]);
    setShowHint(false);
  }, []);
  const onPreview = useCallback((m: number | null, dragging: boolean) => setLive({ m, dragging }), []);

  // win check: the server replays the folds and saves the result
  useEffect(() => {
    if (done || folds === 0 || score < SOLVED_AT || saving) return;
    const r: Result = { day, folds, par: init.par, match: score, hinted };
    // Winning is a state the board reaches, not a click, so the result is recorded here once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalDone(r);
    if (!init.username) return;
    setSaving(true);
    fetch("/api/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ steps, hinted }) })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.message ?? "Could not save");
        const sr = j as SubmitResponse;
        setPlayed(sr.played);
        setStats(sr.stats);
        setCrowd(sr.crowd);
        setRank(sr.rank);
      })
      .catch((e: Error) => setSaveErr(e.message))
      .finally(() => setSaving(false));
  }, [score, folds, done, day, init.par, hinted, steps, saving, init.username]);

  const shownMatch = live.dragging && live.m != null ? live.m : score;
  const pct = Math.floor(shownMatch * 1000) / 10;
  const solved = !!done && stars(done) > 0;

  if (!seenIntro) return <Intro par={init.par} onPlay={() => { setSeenIntro(true); intro.mark(); }} />;

  return (
    <div className="app">
      <header className="top">
        <div className="brand"><Crane /> <span>Fold</span></div>
        <div className="meta">
          <span className="pill">#{init.number}</span>
          <span className="pill">par {init.par}</span>
          {stats.streak > 0 ? <span className="pill hot">🔥 {stats.streak}</span> : null}
        </div>
      </header>
      {init.author ? <p className="byline">Today’s paper was folded by u/{init.author}</p> : null}

      <Board sheet={sheet} target={target} locked={!!done} hint={showHint && folds === 0 ? init.hint : null} celebrate={solved} onFold={onFold} onPreview={onPreview} />

      <div className={`meter ${shownMatch >= SOLVED_AT ? "full" : ""}`} aria-label={`Match ${pct}%`}>
        <div className="bar" style={{ width: `${Math.min(100, pct)}%` }} />
        <span>{pct.toFixed(1)}% match{live.dragging ? " if you fold here" : ""}</span>
      </div>

      {done ? (
        <>
          <ResultCard r={done} number={init.number} stats={stats} progress={played?.progress ?? progress} crowd={crowd} rank={rank} saving={saving} saveErr={saveErr} canShare={!!played && !!init.username} sharedInit={init.shared} loggedIn={!!init.username} />
          <button className="make-cta" onClick={onMake}>Fold a puzzle for tomorrow →</button>
        </>
      ) : (
        <div className="controls">
          <span className="folds">Folds <b>{folds}</b><small> / par {init.par}</small></span>
          <button className="ghost" onClick={() => { setHinted(true); setShowHint(true); setHistory([freshSheet()]); setProgress([]); setSteps([]); }} disabled={showHint}>
            Hint <small>−1★</small>
          </button>
          <button className="ghost" onClick={() => { setHistory((h) => h.slice(0, -1)); setProgress((p) => p.slice(0, -1)); setSteps((st) => st.slice(0, -1)); }} disabled={!folds}>Undo</button>
          <button className="ghost" onClick={() => { setHistory([freshSheet()]); setProgress([]); setSteps([]); }} disabled={!folds}>Restart</button>
        </div>
      )}
      {!done ? <p className="hint">{showHint ? "Drag the dot along the green line to make the first fold." : "Drag a corner dot to where it should land. The paper folds along the red line."}</p> : null}
    </div>
  );
}

function ResultCard(p: { r: Result; number: number; stats: PlayerStats; progress: number[]; crowd: Crowd; rank: number; saving: boolean; saveErr: string | null; canShare: boolean; sharedInit: boolean; loggedIn: boolean }) {
  const { r, stats, crowd } = p;
  const s = stars(r);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(p.sharedInit);
  const [sharing, setSharing] = useState(false);
  const text = shareText({ ...r, day: `#${p.number}` }, p.progress, stats.streak);
  const entries = Object.entries(crowd.hist).map(([f, n]) => [Number(f), n] as const).sort((a, b) => a[0] - b[0]);
  const maxN = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <section className="result">
      <p className="stars" aria-label={`${s} of 3 stars`}>{[0, 1, 2].map((i) => <span key={i} className={i < s ? "on" : ""}>★</span>)}</p>
      <h2>{verdict(r)}</h2>
      <div className="stats">
        <div><b>{r.folds}</b><small>folds</small></div>
        <div><b>{r.par}</b><small>par</small></div>
        <div><b>{stats.streak}</b><small>streak</small></div>
        <div><b>{stats.stars}</b><small>stars</small></div>
      </div>
      {p.saving ? <p className="hint">Saving your folds…</p> : null}
      {p.saveErr ? <p className="hint err">{p.saveErr}</p> : null}
      {!p.loggedIn ? <p className="hint">Log in to keep your streak and appear on the board.</p> : null}
      {crowd.players > 0 ? (
        <div className="crowd">
          <p className="crowd-head">
            {crowd.players} {crowd.players === 1 ? "folder" : "folders"} today{p.rank ? ` · you're #${p.rank}` : ""}
          </p>
          <div className="hist">
            {entries.map(([f, n]) => (
              <div key={f} className={`col ${f === r.folds ? "me" : ""}`}>
                <span className="n">{n}</span>
                <i style={{ height: `${Math.max(8, (n / maxN) * 64)}px` }} />
                <span className="f">{f}</span>
              </div>
            ))}
          </div>
          <p className="crowd-foot">folds needed</p>
          {crowd.top.length ? (
            <ol className="leaders">
              {crowd.top.map((t) => (
                <li key={t.username}><span>u/{t.username}</span><b>{t.folds} folds · {"★".repeat(t.stars)}</b></li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
      <pre className="share">{text}</pre>
      <div className="actions">
        <button className="ghost" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); showToast("Copied"); } catch { setCopied(false); } }}>
          {copied ? "Copied" : "Copy"}
        </button>
        {p.canShare ? (
          <button
            className="primary"
            disabled={shared || sharing}
            onClick={async () => {
              setSharing(true);
              try {
                const res = await fetch("/api/share", { method: "POST" });
                const j = (await res.json()) as ShareResponse & { message: string };
                showToast(j.message);
                if (res.ok) setShared(true);
              } finally {
                setSharing(false);
              }
            }}
          >
            {shared ? "Shared" : sharing ? "Sharing…" : "Share my result"}
          </button>
        ) : null}
      </div>
      <p className="hint">{tier(stats.stars)} · best streak {stats.best}. A new paper is folded every day at 00:00 UTC.</p>
    </section>
  );
}

function Intro({ par, onPlay }: { par: number; onPlay: () => void }) {
  return (
    <div className="intro">
      <Crane big />
      <h1>Fold</h1>
      <p className="tag">One paper. One shape. A new one every day.</p>
      <ol className="how">
        <li><span>1</span> Look at the striped shape.</li>
        <li><span>2</span> Drag a corner of the paper to where it should land.</li>
        <li><span>3</span> Match the shape in {par} folds or fewer.</li>
      </ol>
      <button className="primary wide" onClick={onPlay}>Fold today's paper</button>
    </div>
  );
}

export function Crane({ big = false }: { big?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" width={big ? 84 : 30} height={big ? 84 : 30} aria-hidden className="crane">
      <path d="M6 40 L30 30 L36 12 L40 30 L58 22 L44 38 L30 52 Z" fill="#ffb48a" stroke="#c4673d" strokeWidth="2" strokeLinejoin="round" />
      <path d="M30 30 L40 30 L30 52 Z" fill="#fffcf3" stroke="#c4673d" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
