import { useState } from 'react';
import { CONTACT } from './Layout.jsx';

// « Nos services » : « Apprendre l'italien » s'affiche en premier. Toutes les 6 secondes il part vers la gauche,
// « Partir en Italie » monte à sa place et ses titres apparaissent un par un ; puis on repasse au premier, en boucle.
// Le changement est déclenché par la fin de la barre de progression (6 s) : pause au survol, onglets cliquables.
// Si « réduire les animations » est actif, rien ne bouge tout seul : on change avec les onglets.
const SECONDS = 6;
export default function ServicesSlider({ c }) {
  const panels = [['learn', c.learn], ['go', c.go]];
  const [i, setI] = useState(0); const [prev, setPrev] = useState(-1); const [paused, setPaused] = useState(false);
  const go = (k) => { if (k === i) return; setPrev(i); setI(k); setTimeout(() => setPrev(-1), 800); };
  return (
    <div className={`sv ${paused ? 'paused' : ''}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="sv-tabs" role="tablist">
        {panels.map(([k, g], n) => (
          <button key={k} type="button" role="tab" aria-selected={n === i} className={`sv-tab ${k} ${n === i ? 'on' : ''}`} onClick={() => go(n)}>
            <span>{g.title}</span>
            {n === i && <i key={i} className="sv-fill" style={{ animationDuration: `${SECONDS}s` }} onAnimationEnd={() => go((i + 1) % panels.length)} />}
          </button>
        ))}
      </div>
      <div className="sv-stage">
        {panels.map(([k, g], n) => (
          <div key={k} role="tabpanel" aria-hidden={n !== i} className={`sv-panel ${k} ${n === i ? 'on' : n === prev ? 'out' : ''}`}>
            <h3 style={{ '--k': 0 }}>{g.title}</h3>
            {g.sub && <p className="sv-sub" style={{ '--k': 1 }}>{g.sub}</p>}
            <ul className={k === 'go' ? 'two' : ''}>
              {g.items.map(([t, d], m) => (
                <li key={t} style={{ '--k': m + 2 }}>
                  {k === 'go' && <em className="sv-n">{m + 1}</em>}
                  <div><b>{t}</b><span>{d}</span></div>
                </li>
              ))}
            </ul>
            {k === 'go' && g.cta && (
              <div className="sv-contact" style={{ '--k': g.items.length + 2 }}>
                <a className="btn primary" href={CONTACT.whatsappLink} target="_blank" rel="noreferrer">{g.cta} · {CONTACT.whatsapp}</a>
                <span className="muted">Facebook : {CONTACT.facebook}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
