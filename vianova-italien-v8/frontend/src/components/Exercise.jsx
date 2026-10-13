import { useState } from 'react';
import { api } from '../api.js';
import { BADGES, ScoreRing, useUI } from '../ui.jsx';
import { useAuth } from '../auth.jsx';

const isFilled = (q, v) => (q.type === 'order' ? Array.isArray(v) && v.length > 0 : q.type === 'gap' ? !!v?.trim() : v !== undefined);

// Exercice question par question, avec correction immédiate à la fin
export default function Exercise({ sessionId, exercise, lastScore, onDone }) {
  const { celebrate, toast } = useUI(); const { refreshStats } = useAuth();
  const [idx, setIdx] = useState(0); const [ans, setAns] = useState({}); const [res, setRes] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const qs = exercise.questions; const q = qs[idx];
  const set = (id, v) => setAns((a) => ({ ...a, [id]: v }));
  const byId = Object.fromEntries((res?.results || []).map((r) => [r.id, r]));

  if (!qs.length) return <p className="muted">Cet exercice ne contient pas encore de questions.</p>;

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const body = { answers: Object.fromEntries(Object.entries(ans).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => x.w) : v])) };
      const r = await api(`/student/sessions/${sessionId}/exercises/${exercise.id}`, { method: 'POST', body });
      setRes(r);
      if (r.score >= 17.5) celebrate(); // 70 % de 25
      if (r.xp_gained) toast(`+${r.xp_gained} XP`, 'gold');
      r.badges?.forEach((c) => toast(`Nouveau badge : ${BADGES[c]?.icon} ${BADGES[c]?.title}`, 'green'));
      refreshStats(); onDone?.(r);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const retry = () => { setAns({}); setRes(null); setIdx(0); };

  if (res) {
    const msg = res.score >= 22.5 ? 'Fantastico !' : res.score >= 17.5 ? 'Bravo, très bien !' : res.score >= 12.5 ? 'Pas mal, continuez !' : 'Courage, réessayez !';
    return (
      <div>
        <h3>{exercise.title}</h3>
        <div style={{ textAlign: 'center' }}><ScoreRing score={res.score} max={25} /><h3 style={{ marginTop: '.8rem' }}>{msg}</h3></div>
        {qs.map((x, i) => { const r = byId[x.id]; return (
          <div className="review" key={x.id} style={{ animationDelay: `${i * 0.08}s` }}>
            <span className={`mark ${r.correct ? 'y' : 'n'}`}>{r.correct ? '✓' : '✕'}</span>
            <div><strong>{x.prompt}</strong>
              {!r.correct && <div className="error">Réponse attendue : {String(r.correctAnswer).split('|')[0]}</div>}
              {r.explanation && <div className="muted">{r.explanation}</div>}</div>
          </div>); })}
        <p><button className="ghost" onClick={retry}>↻ Refaire l'exercice</button></p>
      </div>
    );
  }

  const last = idx === qs.length - 1;
  return (
    <div>
      <h3>{exercise.title}</h3>
      {lastScore != null && <p className="muted">Dernier score : {lastScore}/25</p>}
      <div className="quiz-top"><div className="bar"><i style={{ width: `${(idx / qs.length) * 100}%` }} /></div><span>{idx + 1}/{qs.length}</span></div>
      <div className="qcard" key={q.id}>
        <h3>{q.prompt}</h3>
        {q.type === 'qcm' && <div className="opts">{q.options.map((o, k) => (
          <button type="button" key={k} className={`optc ${ans[q.id] === k ? 'sel' : ''}`} onClick={() => set(q.id, k)}><span className="k">{'ABCD'[k]}</span>{o}</button>))}</div>}
        {q.type === 'gap' && <input className="gap-in" autoFocus placeholder="Écrivez votre réponse" value={ans[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && isFilled(q, ans[q.id]) && (last ? submit() : setIdx(idx + 1))} />}
        {q.type === 'order' && <Order words={q.words} value={ans[q.id] || []} onChange={(v) => set(q.id, v)} />}
      </div>
      {err && <p className="error">{err}</p>}
      <div className="row between" style={{ marginTop: '1.2rem' }}>
        <button className="ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Précédent</button>
        {last ? <button className="primary" disabled={busy || !isFilled(q, ans[q.id])} onClick={submit}>{busy ? '…' : 'Corriger ✓'}</button>
              : <button className="primary" disabled={!isFilled(q, ans[q.id])} onClick={() => setIdx(idx + 1)}>Suivant →</button>}
      </div>
    </div>
  );
}

export function Order({ words, value, onChange }) {
  return (
    <div>
      <div className="chips target">{value.length ? value.map((v) => <button type="button" key={v.i} onClick={() => onChange(value.filter((x) => x.i !== v.i))}>{v.w}</button>) : <em className="muted">Touchez les mots dans l'ordre</em>}</div>
      <div className="chips">{words.map((w, i) => !value.some((v) => v.i === i) && <button type="button" key={i} onClick={() => onChange([...value, { w, i }])}>{w}</button>)}</div>
    </div>
  );
}
