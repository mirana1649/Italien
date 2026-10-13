import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const Ctx = createContext(null);
export const useUI = () => useContext(Ctx);

const COLORS = ['#008C45', '#FFFFFF', '#CD212A'];

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]); const [burst, setBurst] = useState(0); const id = useRef(0);
  const toast = useCallback((text, kind = '') => {
    const t = ++id.current; setToasts((a) => [...a, { id: t, text, kind }]);
    setTimeout(() => setToasts((a) => a.filter((x) => x.id !== t)), 3600);
  }, []);
  const celebrate = useCallback(() => { setBurst((b) => b + 1); setTimeout(() => setBurst(0), 4200); }, []);
  return (
    <Ctx.Provider value={{ toast, celebrate }}>
      {children}
      {burst > 0 && <Confetti key={burst} />}
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>
    </Ctx.Provider>
  );
}

function Confetti() {
  const pieces = useRef([...Array(70)].map(() => ({
    x: Math.random() * 100, c: COLORS[Math.floor(Math.random() * COLORS.length)], d: Math.random() * 0.7, t: 2.4 + Math.random() * 1.6,
  }))).current;
  return <div className="confetti" aria-hidden>{pieces.map((p, i) => <i key={i} style={{ '--x': `${p.x}%`, '--c': p.c, '--d': `${p.d}s`, '--t': `${p.t}s` }} />)}</div>;
}

// Nombre qui « monte » jusqu'à sa valeur
export function CountUp({ value, ms = 900 }) {
  const n = Number(value); const [v, setV] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(n)) return;
    let raf; const t0 = performance.now();
    const step = (t) => { const p = Math.min((t - t0) / ms, 1); setV(n * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [n, ms]);
  if (!Number.isFinite(n)) return value ?? '—';
  return Number.isInteger(n) ? Math.round(v) : v.toFixed(1);
}

export function ScoreRing({ score, max = 25, size = 140 }) {
  const r = 52, C = 2 * Math.PI * r; const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(Math.min(score / max, 1)), 80); return () => clearTimeout(t); }, [score, max]);
  const pct = max ? score / max : 0; const color = pct >= 0.7 ? 'var(--verde)' : pct >= 0.5 ? 'var(--gold)' : 'var(--rosso)';
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120"><circle className="bg" cx="60" cy="60" r={r} /><circle className="fg" cx="60" cy="60" r={r} stroke={color} strokeDasharray={C} strokeDashoffset={C * (1 - p)} /></svg>
      <b>{score}<small style={{ fontSize: '.9rem', color: 'var(--muted)' }}>/{max}</small></b>
    </div>
  );
}

// Prononciation italienne (synthèse vocale du navigateur)
export function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = 'it-IT'; u.rate = 0.9; window.speechSynthesis.speak(u);
}
export const SpeakBtn = ({ text }) => <button type="button" className="ghost speak" title="Écouter la prononciation" aria-label={`Écouter : ${text}`} onClick={(e) => { e.stopPropagation(); speak(text); }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg></button>;

export const BADGES = {
  first_session: { title: 'Primo passo', desc: 'Première séance terminée' },
  five_sessions: { title: 'Costante', desc: '5 séances terminées' },
  ten_sessions: { title: 'Romano', desc: '10 séances terminées' },
  streak_3: { title: 'Fiamma', desc: '3 jours de suite' },
  streak_7: { title: 'Vulcano', desc: '7 jours de suite' },
  perfect: { title: 'Perfetto', desc: '20/20 à un exercice' },
  voice: { title: 'Voce d\u2019oro', desc: 'Oral noté 16/20 ou plus' },
};

const TITLES = ['Turista', 'Viaggiatore', 'Studente', 'Cittadino', 'Romano', 'Maestro', 'Leggenda'];
export function levelOf(xp = 0) {
  const n = Math.floor(xp / 100); const into = xp % 100;
  return { n: n + 1, name: TITLES[Math.min(n, TITLES.length - 1)], into, pct: into };
}
