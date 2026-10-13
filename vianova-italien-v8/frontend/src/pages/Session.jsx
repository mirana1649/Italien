import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, mediaUrl } from '../api.js';
import Exercise from '../components/Exercise.jsx';
import Flashcards from '../components/Flashcards.jsx';
import { BADGES, useUI } from '../ui.jsx';
import { useAuth } from '../auth.jsx';
import { useLang } from '../i18n.jsx';

const TABS = [['lesson', 'tab_lesson'], ['vocab', 'tab_vocab'], ['listening', 'tab_listening'], ['exercise', 'tab_exercise'], ['oral', 'tab_oral'], ['result', 'tab_result']];
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function Video({ url, onPlay }) {
  const ref = useRef(null);
  const [rate, setRate] = useState(1);
  const yt = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  if (yt) return <iframe className="video" src={`https://www.youtube.com/embed/${yt[1]}`} allowFullScreen title="Leçon vidéo" onLoad={onPlay} />;
  return (
    <>
      <video ref={ref} className="video" controls src={mediaUrl(url)} onPlay={onPlay} />
      <label className="inline">Vitesse
        <select value={rate} onChange={(e) => { setRate(+e.target.value); ref.current.playbackRate = +e.target.value; }}>
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => <option key={v} value={v}>{v}x</option>)}
        </select>
      </label>
    </>
  );
}

function Recorder({ sessionId, existing, onSent }) {
  const [rec, setRec] = useState(null); const [blob, setBlob] = useState(null);
  const [state, setState] = useState('idle'); const [err, setErr] = useState(''); const [secs, setSecs] = useState(0);
  const chunks = useRef([]);
  const preview = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  useEffect(() => { if (state !== 'rec') return; const t = setInterval(() => setSecs((v) => v + 1), 1000); return () => clearInterval(t); }, [state]);

  const start = async () => {
    setErr(''); setSecs(0); setBlob(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = () => { setBlob(new Blob(chunks.current, { type: mr.mimeType })); stream.getTracks().forEach((t) => t.stop()); };
      mr.start(); setRec(mr); setState('rec');
    } catch { setErr("Impossible d'accéder au micro. Autorisez-le dans votre navigateur."); }
  };
  const stop = () => { rec.stop(); setState('done'); };
  const send = async () => {
    const fd = new FormData(); fd.append('audio', blob, 'oral.webm');
    try { await api(`/student/sessions/${sessionId}/oral`, { method: 'POST', form: fd }); setBlob(null); setState('idle'); onSent(); }
    catch (e) { setErr(e.message); }
  };
  return (
    <div className="rec">
      {existing && <p className="ok">✓ Enregistrement envoyé. {existing.score == null ? 'En attente de correction.' : `Note : ${existing.score}/22`}</p>}
      {state === 'rec' && <div className="wave" aria-hidden>{[...Array(14)].map((_, i) => <i key={i} />)}</div>}
      {state !== 'done' && <button className={`mic ${state === 'rec' ? 'live' : ''}`} onClick={state === 'rec' ? stop : start} aria-label={state === 'rec' ? 'Arrêter' : 'Enregistrer'}>{state === 'rec' ? <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" /></svg> : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v4" /></svg>}</button>}
      {state === 'rec' && <div className="timer">{fmtTime(secs)}</div>}
      {state === 'idle' && <p className="muted">{existing ? 'Touchez le micro pour refaire l\'enregistrement' : 'Touchez le micro pour commencer'}</p>}
      {blob && <><audio controls src={preview} /><div className="row" style={{ justifyContent: 'center' }}><button className="primary" onClick={send}>Envoyer à mon professeur</button><button className="ghost" onClick={() => { setBlob(null); setState('idle'); }}>Recommencer</button></div></>}
      {err && <p className="error">{err}</p>}
    </div>
  );
}

export default function Session() {
  const { id } = useParams(); const nav = useNavigate();
  const [d, setD] = useState(null); const [tab, setTab] = useState('lesson');
  const [seen, setSeen] = useState(false); const [err, setErr] = useState(''); const [win, setWin] = useState(null);
  const { celebrate, toast } = useUI(); const { refreshStats } = useAuth(); const { t } = useLang();
  const load = () => api(`/student/sessions/${id}`).then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]);
  if (err) return <p className="error">{err}</p>;
  if (!d) return <p className="center">Chargement…</p>;

  const { session: s, resources, exercises, oral, scores, vocab } = d;
  const res = (t) => resources.filter((r) => r.type === t);
  const exs = (k) => exercises.filter((e) => e.kind === k);
  const flags = { lesson: s.lesson_viewed, vocab: vocab.length > 0 && vocab.every((v) => v.known), listening: s.listening_done, exercise: s.exercise_done, oral: s.oral_done, result: !!s.validated_at };
  const markViewed = () => !s.lesson_viewed && api(`/student/sessions/${id}/viewed`, { method: 'POST' }).then(load);
  const visible = TABS.filter(([k]) => k !== 'vocab' || vocab.length);
  const idx = visible.findIndex(([k]) => k === tab);
  const goNext = () => idx < visible.length - 1 && (setTab(visible[idx + 1][0]), window.scrollTo({ top: 0, behavior: 'smooth' }));
  const goPrev = () => idx > 0 && setTab(visible[idx - 1][0]);
  const finishLesson = async () => { await markViewed(); toast(t('lesson_done'), 'green'); setTab(vocab.length ? 'vocab' : 'listening'); };
  const ready = s.listening_done && s.exercise_done && s.oral_done;

  const validate = async () => {
    try { const r = await api(`/student/sessions/${id}/validate`, { method: 'POST', body: { seen: true } }); setWin(r); celebrate(); refreshStats(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <p><Link to="/espace">{t('session_back')}</Link></p>
      <h2>{d.lesson.title}</h2>
      <div className="bar" title="Progression de la séance"><i style={{ width: `${([s.lesson_viewed, s.listening_done, s.exercise_done, s.oral_done].filter(Boolean).length / 4) * 100}%` }} /></div>
      <div className="stepper">
        {visible.map(([k, l], i) => (
          <button key={k} className={`${tab === k ? 'on' : ''} ${flags[k] ? 'fin' : ''}`} onClick={() => setTab(k)}>
            <span className="n">{flags[k] ? '✓' : i + 1}</span><span>{t(l)}</span>
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'lesson' && (
          <>
            {(res('video').length > 0 || res('written').length > 0 || res('pdf').length === 0) && <div className="lesson-split">
              <div>
                {res('video').map((r) => <Video key={r.id} url={r.url} onPlay={markViewed} />)}
                {!res('video').length && <p className="muted">Pas de vidéo pour cette leçon.</p>}
              </div>
              <aside>
                <h3>{t('lesson_h')}</h3>
                {res('written').map((r) => (
                  <article key={r.id} className="paper">
                    {r.url && <img src={mediaUrl(r.url)} alt="Leçon manuscrite" />}
                    {r.content && <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{r.content}</p>}
                  </article>
                ))}
                {!res('written').length && <p className="muted">Pas de texte pour cette leçon.</p>}
              </aside>
            </div>}
            {res('pdf').map((r) => (
              <section key={r.id} className="pdf-block">
                <div className="row between wrap">
                  <h3>{t('lesson_pdf')}{r.file_name && <small className="muted"> · {r.file_name}</small>}</h3>
                  <a className="primary btn" href={mediaUrl(r.url)} target="_blank" rel="noreferrer" onClick={markViewed}>{t('pdf_open')}</a>
                </div>
                <iframe className="pdf-frame" src={mediaUrl(r.url)} title={r.file_name || t('lesson_pdf')} />
                <p className="muted pdf-note">{t('pdf_fallback')}</p>
              </section>
            ))}
            <div className="next-bar">
              <span className="muted">Regarde la vidéo en suivant la leçon à côté, puis passe à l’exercice et à l’oral.</span>
              {!s.lesson_viewed ? <button className="primary btn" onClick={finishLesson}>{t('lesson_done')}</button> : <button className="primary btn" onClick={goNext}>{t('next')}</button>}
            </div>
          </>
        )}
        {tab === 'vocab' && <Flashcards items={vocab} />}
        {tab === 'listening' && (
          <>
            {res('audio').map((r) => <audio key={r.id} controls src={mediaUrl(r.url)} />)}
            {exs('listening').map((e) => <Exercise key={e.id} sessionId={id} exercise={e} lastScore={scores.listening} onDone={load} />)}
            {!exs('listening').length && <p className="muted">Pas d'écoute pour cette séance.</p>}
            {res('reading').map((r) => <article key={r.id} className="paper"><h3>Lecture</h3><p style={{ whiteSpace: 'pre-wrap' }}>{r.content}</p></article>)}
            {exs('reading').map((e) => <Exercise key={e.id} sessionId={id} exercise={e} onDone={load} />)}
          </>
        )}
        {tab === 'exercise' && (
          <>
            {exs('exercise').map((e) => <Exercise key={e.id} sessionId={id} exercise={e} lastScore={scores.exercise} onDone={load} />)}
            {!exs('exercise').length && <p className="muted">Aucun exercice pour cette séance.</p>}
          </>
        )}
        {tab === 'oral' && (
          <>
            <p>Lisez le texte à voix haute, puis enregistrez-vous.</p>
            {res('reading').map((r) => <article key={r.id} className="paper"><p style={{ whiteSpace: 'pre-wrap' }}>{r.content}</p></article>)}
            <Recorder sessionId={id} existing={oral} onSent={load} />
          </>
        )}
        {tab === 'result' && (
          <>
            <div className="scores">
              <div><b>{scores.exercise ?? '—'}</b><span>Exercice /25</span></div>
              <div><b>{scores.listening ?? '—'}</b><span>Écoute /25</span></div>
              <div><b className={oral && oral.score == null ? 'pending' : ''}>{oral ? (oral.score ?? 'En attente de correction') : '—'}</b><span>Oral /22</span></div>
            </div>
            {oral?.comment && <blockquote>{oral.comment}</blockquote>}
            {s.validated_at ? <p className="ok">Séance validée.</p> : (
              <>
                {!ready && <p className="muted">Pour valider : terminez l'écoute, l'exercice et l'oral.</p>}
                <label className="opt"><input type="checkbox" disabled={!ready} checked={seen} onChange={(e) => setSeen(e.target.checked)} />J'ai vu mon résultat et je termine cette séance</label>
                <button className="primary" disabled={!ready || !seen} onClick={validate}>{t('end_session')}</button>
              </>
            )}
          </>
        )}
      </div>
      {tab !== 'lesson' && tab !== 'result' && (
        <div className="next-bar" style={{ borderTop: 0 }}>
          <button className="ghost" onClick={goPrev}>{t('prev')}</button>
          <button className="primary btn" onClick={goNext}>{t('next')}</button>
        </div>
      )}
      {win && (
        <div className="overlay"><div className="modal" role="dialog" aria-label="Séance terminée">
          <h2>{t('session_done')}</h2>
          <div className="gain">+{win.xp_gained} XP</div>
          <p>Série : <strong>{win.streak} jour{win.streak > 1 ? 's' : ''}</strong></p>
          {win.badges?.map((c) => <p key={c} className="notice">{t('new_badge')} : <strong>{BADGES[c]?.title}</strong></p>)}
          <button className="primary big" onClick={() => nav('/espace')}>{t('back_btn')}</button>
        </div></div>
      )}
    </div>
  );
}
