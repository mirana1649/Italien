import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { SpeakBtn, speak, useUI } from '../ui.jsx';
import { useLang } from '../i18n.jsx';

// Cartes mémoire : touchez la carte pour la retourner, puis « Je sais » ou « À revoir »
export default function Flashcards({ items }) {
  const { celebrate, toast } = useUI(); const { t, meaning } = useLang();
  const [known, setKnown] = useState(() => Object.fromEntries(items.map((x) => [x.id, x.known])));
  const [review, setReview] = useState(false); const [i, setI] = useState(0); const [flip, setFlip] = useState(false);
  const deck = review ? items.filter((x) => !known[x.id]) : items;
  const card = deck[Math.min(i, deck.length - 1)];
  const count = items.filter((x) => known[x.id]).length;

  const go = (d) => { setFlip(false); setTimeout(() => setI((v) => (v + d + deck.length) % deck.length), 150); };
  const mark = async (ok) => {
    setKnown((k) => ({ ...k, [card.id]: ok })); api(`/student/vocab/${card.id}`, { method: 'POST', body: { known: ok } }).catch(() => {});
    if (ok && count + 1 === items.length) { celebrate(); toast(t('fc_all'), 'green'); }
    if (review && ok) setFlip(false); else go(1);
  };
  useEffect(() => {
    const k = (e) => { if (e.target.tagName === 'INPUT') return; if (e.code === 'Space') { e.preventDefault(); setFlip((f) => !f); } if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  useEffect(() => { setI(0); }, [review]);

  if (!items.length) return <p className="muted">{t('fc_none')}</p>;
  return (
    <div>
      <div className="row between wrap">
        <strong>{t('fc_learned', count, items.length)}</strong>
        <label className="opt"><input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} />{t('fc_only')}</label>
      </div>
      <div className="bar"><i style={{ width: `${(count / items.length) * 100}%` }} /></div>
      {!card ? <p className="ok center">{t('fc_done')}</p> : (
        <>
          <div className="fc-wrap">
            <div className={`fc ${flip ? 'flip' : ''}`} onClick={() => { setFlip(!flip); if (!flip) speak(card.it); }} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setFlip(!flip)} aria-label="Retourner la carte">
              <div className="front"><p className="t">{card.it}</p><SpeakBtn text={card.it} /><small>{t('fc_tap')}</small></div>
              <div className="back"><p className="t">{meaning(card)}</p>{card.example && <small>« {card.example} »</small>}</div>
            </div>
          </div>
          <p className="muted center" style={{ padding: 0 }}>{Math.min(i, deck.length - 1) + 1} / {deck.length}{card.lesson ? ` · ${card.lesson}` : ''}</p>
          <div className="fc-actions">
            <button onClick={() => go(-1)} aria-label="Précédent">←</button>
            <button className="danger" onClick={() => mark(false)}>{t('fc_again')}</button>
            <button className="primary" onClick={() => mark(true)}>{t('fc_know')}</button>
            <button onClick={() => go(1)} aria-label="Suivant">→</button>
          </div>
        </>
      )}
    </div>
  );
}
