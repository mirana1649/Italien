import { useEffect, useState } from 'react';

// Texte de la première vue : il change toutes les 6,5 s (il « monte » et le suivant arrive du bas),
// pendant que la carte de connexion reste à sa place. Pause au survol ; points cliquables.
const MS = 6500;
export default function HeroStory({ c }) {
  const slides = [{ title: c.h1, text: c.lead }, ...c.story];
  const [i, setI] = useState(0); const [prev, setPrev] = useState(-1); const [paused, setPaused] = useState(false);
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = (k) => { if (k === i) return; setPrev(i); setI(k); };
  useEffect(() => {
    if (paused || still) return;
    const t = setTimeout(() => { setPrev(i); setI((i + 1) % slides.length); }, MS);
    return () => clearTimeout(t);
  }, [i, paused, still, slides.length]);
  return (
    <div className="story" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="story-stage">
        {slides.map((s, k) => {
          const Tag = k === 0 ? 'h1' : 'h2';
          return (
            <div key={k} className={`story-slide ${k === i ? 'on' : k === prev ? 'out' : ''}`} aria-hidden={k !== i}>
              <Tag className="story-title">{s.title}</Tag>
              <p className="lead">{s.text}</p>
            </div>
          );
        })}
      </div>
      <div className="story-dots">
        {slides.map((_, k) => <button key={k} type="button" className={k === i ? 'on' : ''} onClick={() => go(k)} aria-label={`${k + 1} / ${slides.length}`} aria-current={k === i} />)}
      </div>
    </div>
  );
}
