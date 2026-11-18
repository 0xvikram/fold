import { useCallback, useMemo, useState } from "react";
import { showToast } from "@devvit/web/client";
import { freshSheet, type Sheet } from "../shared/engine/geometry";
import { analyze, MAKER_MAX_FOLDS, MAKER_MIN_FOLDS } from "../shared/engine/maker";
import type { MakeResponse, Step } from "../shared/api";
import { Board } from "./Board";

// Players fold their own shape. Only folds are stored (no free text), so every puzzle is safe and solvable.
export function Maker({ loggedIn, onDone }: { loggedIn: boolean; onDone: () => void }) {
  const [history, setHistory] = useState<Sheet[]>([freshSheet()]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sheet = history[history.length - 1];
  const folds = steps.length;
  const a = useMemo(() => analyze(steps), [steps]);
  const badFold = a.perFold.findIndex((x) => x !== null);
  const check = a.final;
  const onFold = useCallback((step: Step, next: Sheet) => {
    setHistory((h) => [...h, next]);
    setSteps((s) => [...s, step]);
    setErr(null);
  }, []);
  const full = folds >= MAKER_MAX_FOLDS;

  const ready = !!check?.ok && badFold < 0;
  const tone: "bad" | "good" | "" = badFold >= 0 || (check && !check.ok) ? "bad" : ready ? "good" : "";
  const status =
    badFold >= 0
      ? `Fold ${badFold + 1}: ${a.perFold[badFold]}. Undo ${badFold === folds - 1 ? "it" : `back to fold ${badFold}`} and try another.`
      : folds < MAKER_MIN_FOLDS
        ? `Make ${MAKER_MIN_FOLDS - folds} more ${MAKER_MIN_FOLDS - folds === 1 ? "fold" : "folds"} to make a puzzle.`
        : check && !check.ok
          ? `${check.reason}${full ? "" : " Or keep folding."}`
          : `Looks good: a par ${folds} puzzle. Submit it${full ? "" : ", or keep folding"}.`;

  return (
    <div className="app">
      <header className="top">
        <div className="brand"><span>Make a Fold</span></div>
        <div className="meta"><span className="pill">{folds} / {MAKER_MAX_FOLDS} folds</span></div>
      </header>
      <p className="byline">Fold a shape for everyone to solve. Drops snap to the dots, so others can match it exactly.</p>
      <Board sheet={sheet} requireSnap showBounds locked={full || busy || badFold >= 0} onFold={onFold} />
      <p className={`maker-status ${tone}`} role="status">{status}</p>
      {err ? <p className="hint err">{err}</p> : null}
      <div className="controls">
        <button
          className={`ghost ${badFold >= 0 ? "attn" : ""}`}
          onClick={() => {
            const keep = badFold >= 0 ? badFold : folds - 1;
            setHistory((h) => h.slice(0, keep + 1));
            setSteps((s) => s.slice(0, keep));
          }}
          disabled={!folds || busy}
        >
          {badFold >= 0 && badFold < folds - 1 ? `Undo to fold ${badFold}` : "Undo"}
        </button>
        <button className="ghost" onClick={() => { setHistory([freshSheet()]); setSteps([]); }} disabled={!folds || busy}>Restart</button>
        <button
          className="primary grow"
          disabled={!ready || busy || !loggedIn}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              const res = await fetch("/api/maker/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ steps }) });
              const j = (await res.json()) as MakeResponse & { message: string };
              if (!res.ok) throw new Error(j.message);
              showToast(j.message);
              setHistory([freshSheet()]);
              setSteps([]);
              onDone();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Could not submit.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Submitting…" : "Submit puzzle"}
        </button>
      </div>
      {!loggedIn ? <p className="hint">Log in to submit puzzles.</p> : <p className="hint">The most-voted puzzle becomes a daily Fold, with your name on it.</p>}
    </div>
  );
}
