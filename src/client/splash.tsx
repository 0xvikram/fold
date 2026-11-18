import './splash.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Shape } from './Shape';
import type { InitResponse } from '../shared/api';

function Splash() {
  const [init, setInit] = useState<InitResponse | null>(null);
  useEffect(() => {
    fetch('/api/init').then((r) => (r.ok ? r.json() : null)).then((j) => j && setInit(j as InitResponse)).catch(() => undefined);
  }, []);
  const played = init?.played;
  return (
    <div className="splash">
      <div className="paper">
        {init ? <Shape sheet={init.shape} size={132} /> : <div className="ph" />}
      </div>
      <div className="copy">
        <p className="eyebrow">{init ? `Fold #${init.number} · par ${init.par}${init.author ? ` · by u/${init.author}` : ''}` : 'Fold'}</p>
        <h1>Fold the paper into this shape.</h1>
        <p className="sub">
          {played
            ? `You did it in ${played.folds} folds · ${'★'.repeat(played.stars)}${'☆'.repeat(3 - played.stars)}`
            : init?.crowd.players
              ? `${init.crowd.players} ${init.crowd.players === 1 ? 'person has' : 'people have'} folded it today`
              : 'A new paper every day'}
        </p>
        <button className="go" onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}>
          {played ? 'See results' : init?.stats.streak ? `Keep your ${init.stats.streak}-day streak` : 'Fold it'}
        </button>
        {context.username ? null : <p className="tiny">Log in to keep a streak</p>}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
