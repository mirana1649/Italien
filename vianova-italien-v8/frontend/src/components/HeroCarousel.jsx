import { useEffect, useState } from 'react';

// Bandeau d'accueil : les diapositives défilent toutes les 5 secondes, en boucle.
// Pause quand la souris est dessus ; points cliquables ; défilement désactivé si « réduire les animations ».
export default function HeroCarousel({ slides, ms = 5000 }) {
  const [i, setI] = useState(0); const [paused, setPaused] = useState(false);
  const n = slides.length;
  useEffect(() => {
    if (n < 2 || paused || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => setI((v) => (v + 1) % n), ms);
    return () => clearTimeout(t);
  }, [i, n, paused, ms]);
  useEffect(() => { if (i >= n) setI(0); }, [n, i]);
  return (
    <section className="hs" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="hs-track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {slides.map((s, k) => (
          <div key={s.key} className={`hs-slide ${s.className || ''}`} aria-hidden={k !== i}>
            <div className="hs-in">{s.content}</div>
          </div>
        ))}
      </div>
      {n > 1 && <div className="hs-dots">{slides.map((s, k) => <button key={s.key} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`${k + 1} / ${n}`} />)}</div>}
    </section>
  );
}
