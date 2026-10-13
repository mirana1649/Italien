import { useEffect, useLayoutEffect } from 'react';

const calm = () => typeof matchMedia === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window);

// Fait « monter » les blocs au fur et à mesure qu'on descend : ils apparaissent un peu avant d'entrer dans l'écran.
// Les blocs ajoutés plus tard (données chargées) sont pris en compte. Rien n'est caché si « réduire les animations » est actif.
export function useReveal(rootRef, selector, deps = []) {
  useLayoutEffect(() => {
    const root = rootRef.current; if (!root || calm()) return;
    const io = new IntersectionObserver((entries) => {
      let i = 0;
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target; io.unobserve(el);
        el.style.setProperty('--rd', `${Math.min(i++, 5) * 90}ms`);
        el.classList.add('in');
        setTimeout(() => { el.classList.remove('rv', 'in'); el.style.removeProperty('--rd'); }, 1300);
      });
    }, { rootMargin: '0px 0px 12% 0px' });
    const seen = new WeakSet();
    const scan = () => root.querySelectorAll(selector).forEach((el) => { if (seen.has(el)) return; seen.add(el); el.classList.add('rv'); io.observe(el); });
    scan();
    const mo = new MutationObserver(scan); mo.observe(root, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); root.querySelectorAll('.rv:not(.in)').forEach((el) => el.classList.remove('rv')); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

// Page d'accueil (écran large) : dès qu'on descend un peu depuis le haut, la page glisse toute seule jusqu'à la section suivante ;
// en remontant un peu, elle revient en haut. Désactivé sur petit écran et si « réduire les animations » est actif.
export function useHeroSnap(deps = []) {
  useEffect(() => {
    if (calm()) return;
    let lock = false;
    const hero = () => document.querySelector('.pub-hero');
    const next = () => document.getElementById('services');
    const active = () => innerWidth >= 900 && hero() && next() && hero().offsetHeight <= innerHeight * 1.1;
    const target = () => next().getBoundingClientRect().top + scrollY - (document.querySelector('.pub-top')?.offsetHeight || 0);
    const go = (top) => { lock = true; scrollTo({ top, behavior: 'smooth' }); setTimeout(() => { lock = false; }, 1000); };
    const onWheel = (e) => {
      if (e.ctrlKey || !active()) return;
      if (lock) { e.preventDefault(); return; }
      const y = scrollY, t = target();
      if (e.deltaY > 8 && y < t - 4) { e.preventDefault(); go(t); }
      else if (e.deltaY < -8 && y > 4 && y <= t + 4) { e.preventDefault(); go(0); }
    };
    addEventListener('wheel', onWheel, { passive: false });
    return () => removeEventListener('wheel', onWheel);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
