import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, mediaUrl } from '../api.js';
import { Order } from '../components/Exercise.jsx';
import { useLang } from '../i18n.jsx';
import { CountUp, ScoreRing, useUI } from '../ui.jsx';

const KINDS = ['lettura', 'ascolto', 'struttura'];
const ICON = { lettura: '📖', ascolto: '🎧', struttura: '🧩' };
const LOCALE = { fr: 'fr-FR', it: 'it-IT', en: 'en-GB' };

const isFilled = (q, v) => (q.type === 'order' ? Array.isArray(v) && v.length > 0 : q.type === 'gap' ? !!v?.trim() : v !== undefined && v !== null);
const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};
const fmtDate = (d, lang) => new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric' });

export default function Exam() {
  const { id } = useParams();
  return id ? <ExamRoom id={Number(id)} /> : <ExamList />;
}

/* ---------------- Liste des examens ---------------- */
function ExamList() {
  const { t, lang } = useLang();
  const [list, setList] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api('/student/exams').then(setList).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="error">{err}</p>;
  if (!list) return <p className="center">{t('loading')}</p>;
  const BADGE = { open: ['now', t('ex_open')], in_progress: ['now', t('ex_open')], upcoming: ['', t('ex_upcoming')], submitted: ['', t('ex_wait')], published: ['done', t('ex_done')], missed: ['alert', t('ex_missed')] };
  return (
    <div className="exam-page wide">
      <h2>{t('ex_title')}</h2>
      {!list.length && <p className="muted">{t('ex_none')}</p>}
      <div className="exam-layout">
      <div className="exam-list">
        {list.map((x, i) => (
          <article key={x.id} className={`card exam-card ${x.state}`} style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="row between wrap">
              <div>
                <h3>{x.title}</h3>
                <p className="muted" style={{ margin: 0 }}>{fmtDate(x.exam_date, lang)} · {t('ex_minutes', x.duration_min)} · {t('ex_questions', x.question_count)}</p>
              </div>
              <span className={`badge ${BADGE[x.state][0]}`}>{BADGE[x.state][1]}</span>
            </div>
            <div className="exam-parts">{KINDS.map((k) => <span key={k}>{ICON[k]} {t(`ex_part_${k}`)}{x.scores?.[k] ? <b> {x.scores[k].score}/{x.scores[k].max}</b> : ''}</span>)}</div>
            {x.state === 'published' && <p className="exam-total"><CountUp value={x.total} /> <small>/ {x.max_total}</small></p>}
            {x.can_take && <Link className="primary btn pulse-cta" to={`/examen/${x.id}`}>{x.state === 'in_progress' ? t('ex_resume') : t('ex_start')} →</Link>}
            {x.state === 'published' && <Link className="primary btn" to={`/examen/${x.id}`}>{t('ex_see')} →</Link>}
          </article>
        ))}
      </div>
      <ResultsSide list={list} />
      </div>
    </div>
  );
}

// Colonne de droite : notes de chaque partie + total sur 72 (visibles seulement une fois les résultats annoncés par l'admin)
function ResultsSide({ list }) {
  const { t } = useLang();
  const done = list.filter((x) => x.state === 'published' && x.scores);
  const last = done[0]; const others = done.slice(1);
  const [grow, setGrow] = useState(false);
  useEffect(() => { const i = setTimeout(() => setGrow(true), 200); return () => clearTimeout(i); }, []);
  return (
    <aside className="exam-side">
      <section className="card side-card">
        <h3>{t('ex_side')}</h3>
        {!last && <p className="muted">{t('ex_side_none')}</p>}
        {last && (
          <>
            <p className="muted" style={{ margin: '0 0 .6rem' }}>{last.title}</p>
            <div className="side-total"><span>{t('ex_side_total')}</span><b><CountUp value={last.total} /></b><small>/ {last.max_total}</small></div>
            <div className="sec-bars">
              {KINDS.map((k) => { const x = last.scores?.[k]; if (!x) return null; return (
                <div key={k} className="sec-bar">
                  <div className="row between"><span>{ICON[k]} {t(`ex_part_${k}`)}</span><b>{x.score} / {x.max}</b></div>
                  <div className="bar"><i style={{ width: grow ? `${x.max ? (x.score / x.max) * 100 : 0}%` : '0%' }} /></div>
                </div>); })}
            </div>
            <Link className="primary btn" to={`/examen/${last.id}`}>{t('ex_see')} →</Link>
          </>
        )}
      </section>
      {others.length > 0 && (
        <section className="card side-card">
          <h3>{t('ex_side_more')}</h3>
          {others.map((x) => <Link key={x.id} to={`/examen/${x.id}`} className="side-row"><span>{x.title}</span><b>{x.total} / {x.max_total}</b></Link>)}
        </section>
      )}
    </aside>
  );
}

/* ---------------- Salle d'examen : choisit l'écran selon l'état ---------------- */
function ExamRoom({ id }) {
  const { t } = useLang(); const nav = useNavigate();
  const [info, setInfo] = useState(null); const [err, setErr] = useState('');
  const [data, setData] = useState(null); const [starting, setStarting] = useState(false); const [sent, setSent] = useState(false);
  const load = useCallback(() => api('/student/exams').then((l) => setInfo(l.find((x) => x.id === id) || false)).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const begin = async () => {
    setErr(''); setStarting(true);
    try { setData(await api(`/student/exams/${id}/start`, { method: 'POST' })); } catch (e) { setErr(e.message); } finally { setStarting(false); }
  };

  if (err && !data) return <div><p className="error">{err}</p><Link to="/examen">{t('ex_back')}</Link></div>;
  if (info === null) return <p className="center">{t('loading')}</p>;
  if (info === false) return <div><p className="muted">{t('ex_none')}</p><Link to="/examen">{t('ex_back')}</Link></div>;
  if (sent) return <Sent onBack={() => nav('/examen')} />;
  if (data) return <ExamTake data={data} onSent={() => { setSent(true); load(); }} />;
  if (info.state === 'published') return <ExamResult id={id} />;

  const open = info.can_take;
  return (
    <div className="exam-page">
      <p><Link to="/examen">{t('ex_back')}</Link></p>
      <section className="card exam-intro">
        <h2>{info.title}</h2>
        <p className="muted">{t('ex_minutes', info.duration_min)} · {t('ex_questions', info.question_count)}</p>
        <div className="exam-parts big">{KINDS.map((k, i) => <span key={k} style={{ animationDelay: `${0.1 + i * 0.12}s` }}><i>{ICON[k]}</i><b>{t(`ex_part_${k}`)}</b><small>{t(`ex_sub_${k}`)}</small></span>)}</div>
        {open && <><p>{t('ex_intro')}</p><button className="primary btn pulse-cta" disabled={starting} onClick={begin}>{starting ? '…' : info.state === 'in_progress' ? t('ex_resume') : t('ex_begin')}</button></>}
        {info.state === 'submitted' && <p className="notice">{t('ex_sent_p')}</p>}
        {info.state === 'upcoming' && <p className="notice">{t('ex_upcoming')} · {fmtDate(info.exam_date, 'fr')}</p>}
        {info.state === 'missed' && <p className="muted">{t('ex_missed')}</p>}
        {err && <p className="error">{err}</p>}
      </section>
    </div>
  );
}

function Sent({ onBack }) {
  const { t } = useLang(); const { celebrate } = useUI();
  useEffect(() => { celebrate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="exam-page"><section className="card exam-sent">
      <svg className="check-draw" viewBox="0 0 52 52" width="96" height="96" aria-hidden><circle cx="26" cy="26" r="24" /><path d="M14 27l8 8 16-17" /></svg>
      <h2>{t('ex_sent')}</h2><p className="muted">{t('ex_sent_p')}</p>
      <button className="primary btn" onClick={onBack}>{t('ex_back')}</button>
    </section></div>
  );
}

/* ---------------- Passage de l'examen (chronométré) ---------------- */
function ExamTake({ data, onSent }) {
  const { t } = useLang(); const { toast } = useUI();
  const { exam, sections } = data;
  const key = `exam_ans_${exam.id}`;
  const offset = useMemo(() => Date.parse(data.server_now) - Date.now(), [data.server_now]); // horloge du serveur = référence
  const deadline = Date.parse(data.deadline);
  const [left, setLeft] = useState(() => deadline - (Date.now() + offset));
  const [ans, setAns] = useState(() => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } });
  const [tab, setTab] = useState(() => sections.find((s) => s.questions.length)?.kind || 'lettura');
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const sentRef = useRef(false); const ansRef = useRef(ans);
  useEffect(() => { ansRef.current = ans; try { localStorage.setItem(key, JSON.stringify(ans)); } catch { /* stockage plein : sans gravité */ } }, [ans, key]);

  const all = sections.flatMap((s) => s.questions);
  const done = all.filter((q) => isFilled(q, ans[q.id])).length;
  const set = (qid, v) => setAns((a) => ({ ...a, [qid]: v }));

  const submit = useCallback(async () => {
    if (sentRef.current) return; sentRef.current = true; setBusy(true); setErr('');
    try {
      const body = { answers: Object.fromEntries(Object.entries(ansRef.current).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => x.w) : v])) };
      await api(`/student/exams/${exam.id}/submit`, { method: 'POST', body });
      try { localStorage.removeItem(key); } catch { /* rien */ }
      onSent();
    } catch (e) { sentRef.current = false; setBusy(false); setConfirm(false); setErr(e.message); toast(e.message, 'red'); }
  }, [exam.id, key, onSent, toast]);

  useEffect(() => {
    const i = setInterval(() => { const l = deadline - (Date.now() + offset); setLeft(l); if (l <= 0) submit(); }, 1000);
    return () => clearInterval(i);
  }, [deadline, offset, submit]);
  useEffect(() => { // évite de quitter l'examen par erreur
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    addEventListener('beforeunload', warn); return () => removeEventListener('beforeunload', warn);
  }, []);

  const sec = sections.find((s) => s.kind === tab) || sections[0];
  const idx = KINDS.indexOf(sec.kind);
  const low = left <= 5 * 60 * 1000;
  const pct = all.length ? (done / all.length) * 100 : 0;

  return (
    <div className="exam-page">
      <div className={`exam-bar ${low ? 'low' : ''}`}>
        <div className="exam-bar-in">
          <strong className="exam-name">{exam.title}</strong>
          <span className="exam-timer" aria-live="off" title={t('ex_left')}>⏱ {clock(left)}</span>
        </div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <small className="muted">{t('ex_answered', done, all.length)}</small>
      </div>

      <div className="stepper exam-tabs">
        {sections.map((s) => {
          const a = s.questions.filter((q) => isFilled(q, ans[q.id])).length;
          return (
            <button key={s.kind} className={`${tab === s.kind ? 'on' : ''} ${s.questions.length && a === s.questions.length ? 'fin' : ''}`} onClick={() => setTab(s.kind)}>
              <span className="n">{s.questions.length && a === s.questions.length ? '✓' : ICON[s.kind]}</span>
              <span>{t(`ex_part_${s.kind}`)}<small className="muted"> {a}/{s.questions.length}</small></span>
            </button>
          );
        })}
      </div>

      <section className="card exam-sec" key={sec.kind}>
        <h3>{ICON[sec.kind]} {t(`ex_part_${sec.kind}`)} <small className="muted">· {t(`ex_sub_${sec.kind}`)}</small></h3>
        {sec.instructions && <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{sec.instructions}</p>}
        {sec.kind === 'ascolto' && sec.audio_url && <div className="audio-box"><p className="muted" style={{ margin: '0 0 .4rem' }}>{t('ex_listen_hint')}</p><audio controls src={mediaUrl(sec.audio_url)} /></div>}
        {sec.passage && <article className="paper"><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{sec.passage}</p></article>}
        {!sec.questions.length && <p className="muted">—</p>}
        {sec.questions.map((q, n) => (
          <div className="exam-q" key={q.id} style={{ animationDelay: `${Math.min(n, 8) * 0.06}s` }}>
            <h4><span className="qn">{n + 1}</span>{q.prompt}</h4>
            {q.type === 'qcm' && <div className="opts">{q.options.map((o, k) => (
              <button type="button" key={k} className={`optc ${ans[q.id] === k ? 'sel' : ''}`} onClick={() => set(q.id, k)}><span className="k">{'ABCDEF'[k]}</span>{o}</button>))}</div>}
            {q.type === 'gap' && <input className="gap-in" placeholder={t('ex_write')} value={ans[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} autoComplete="off" autoCapitalize="off" />}
            {q.type === 'order' && <><p className="muted" style={{ margin: '0 0 .3rem' }}>{t('ex_order_hint')}</p><Order words={q.words} value={ans[q.id] || []} onChange={(v) => set(q.id, v)} /></>}
          </div>
        ))}
      </section>

      {err && <p className="error">{err}</p>}
      <div className="next-bar" style={{ borderTop: 0 }}>
        {idx > 0 ? <button className="ghost" onClick={() => { setTab(KINDS[idx - 1]); scrollTo({ top: 0, behavior: 'smooth' }); }}>{t('prev')}</button> : <span />}
        {idx < KINDS.length - 1
          ? <button className="primary btn" onClick={() => { setTab(KINDS[idx + 1]); scrollTo({ top: 0, behavior: 'smooth' }); }}>{t('next')}</button>
          : <button className="primary btn pulse-cta" onClick={() => setConfirm(true)}>{t('ex_send')}</button>}
      </div>
      {idx < KINDS.length - 1 && <p style={{ textAlign: 'center' }}><button className="ghost" onClick={() => setConfirm(true)}>{t('ex_send')}</button></p>}

      {confirm && (
        <div className="overlay" onClick={() => !busy && setConfirm(false)}>
          <div className="modal" role="dialog" aria-label={t('ex_confirm_t')} onClick={(e) => e.stopPropagation()}>
            <h2>{t('ex_confirm_t')}</h2>
            <p>{t('ex_confirm_p', all.length - done)}</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="primary btn" disabled={busy} onClick={submit}>{busy ? '…' : t('ex_send')}</button>
              <button className="ghost" disabled={busy} onClick={() => setConfirm(false)}>{t('ex_cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Résultats + correction (après l'annonce de l'admin) ---------------- */
function ExamResult({ id }) {
  const { t } = useLang(); const { celebrate } = useUI();
  const [r, setR] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api(`/student/exams/${id}/result`).then((x) => { setR(x); if (x.total / x.max_total >= 0.7) celebrate(); }).catch((e) => setErr(e.message)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [grow, setGrow] = useState(false);
  useEffect(() => { if (!r) return; const i = setTimeout(() => setGrow(true), 150); return () => clearTimeout(i); }, [r]);
  if (err) return <div><p className="error">{err}</p><Link to="/examen">{t('ex_back')}</Link></div>;
  if (!r) return <p className="center">{t('loading')}</p>;
  return (
    <div className="exam-page">
      <p><Link to="/examen">{t('ex_back')}</Link></p>
      <section className="card exam-result">
        <h2>{r.exam.title}</h2>
        <ScoreRing score={r.total} max={r.max_total} size={170} />
        <p className="exam-total"><CountUp value={r.total} /> <small>/ {r.max_total}</small></p>
        {r.late && <p className="muted">{t('ex_late')}</p>}
        <div className="sec-bars">
          {KINDS.map((k, i) => { const s = r.scores?.[k]; if (!s) return null; return (
            <div key={k} className="sec-bar" style={{ animationDelay: `${0.2 + i * 0.15}s` }}>
              <div className="row between"><span>{ICON[k]} {t(`ex_part_${k}`)}</span><b>{s.score} / {s.max}</b></div>
              <div className="bar"><i style={{ width: grow ? `${s.max ? (s.score / s.max) * 100 : 0}%` : '0%' }} /></div>
            </div>); })}
        </div>
      </section>

      <h3>{t('ex_review')}</h3>
      {r.review.map((s) => s.questions.length > 0 && (
        <details key={s.kind} className="card review-sec">
          <summary>{ICON[s.kind]} {t(`ex_part_${s.kind}`)} <span className="badge">{s.correct}/{s.count}</span></summary>
          {s.questions.map((q) => (
            <div className="review" key={q.id}>
              <span className={`mark ${q.correct ? 'y' : 'n'}`}>{q.correct ? '✓' : '✕'}</span>
              <div>
                <strong>{q.prompt}</strong>
                <div className={q.correct ? 'ok' : 'error'}>{t('ex_your_answer')} : {q.given ? String(q.given) : t('ex_no_answer')}</div>
                {!q.correct && <div className="muted">{t('ex_expected')} : {String(q.correctAnswer ?? '')}</div>}
                {q.explanation && <div className="muted">{q.explanation}</div>}
              </div>
            </div>
          ))}
        </details>
      ))}
    </div>
  );
}
