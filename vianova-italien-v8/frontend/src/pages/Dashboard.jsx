import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import EvolutionChart from '../components/EvolutionChart.jsx';
import HeroCarousel from '../components/HeroCarousel.jsx';
import { useLang } from '../i18n.jsx';
import { BADGES, CountUp, SpeakBtn, levelOf, useUI } from '../ui.jsx';

const LOCALE = { fr: 'fr-FR', it: 'it-IT', en: 'en-GB' };
const CalIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;

const examDate = (d) => new Date(`${String(d).slice(0, 10)}T00:00:00`);
function useNow(ms = 1000) { const [n, setN] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t); }, [ms]); return n; }

// Contenu de la diapositive « examen + annonce importante »
function ExamNews({ exam, news }) {
  const { t, lang } = useLang(); const now = useNow();
  const fmt = (d) => examDate(d).toLocaleDateString(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  let examEl = null;
  if (exam) {
    const diff = examDate(exam.exam_date) - now; const over = diff <= 0;
    const d = Math.floor(diff / 864e5), hh = Math.floor((diff % 864e5) / 36e5), mm = Math.floor((diff % 36e5) / 6e4), ss = Math.floor((diff % 6e4) / 1e3);
    const hasScore = exam.score !== null && exam.score !== undefined;
    examEl = (
      <div className="hs-block">
        <span className="tag">{hasScore ? t('exam_result') : over ? t('exam_over') : d <= 7 ? t('exam_soon') : t('exam_tag')}</span>
        <h2>{exam.title}</h2>
        <p className="row"><CalIcon /> {fmt(exam.exam_date)}</p>
        {hasScore ? <div className="cd score"><div><b><CountUp value={exam.score} /></b><span>/ {exam.max_score ?? 72}</span></div></div>
          : !over && <div className="cd">{[[d, t('d')], [hh, t('h')], [mm, t('m')], [ss, t('s')]].map(([v, l]) => <div key={l}><b>{String(v).padStart(2, '0')}</b><span>{l}</span></div>)}</div>}
        {exam.can_take && <Link className="btn-white pulse-cta" to={`/examen/${exam.id}`}>{exam.in_progress ? t('ex_resume') : t('ex_start')} →</Link>}
        {!exam.can_take && exam.submitted && !exam.published && <p className="hs-small">{t('ex_wait')}</p>}
        {exam.published && hasScore && <Link className="btn-white" to={`/examen/${exam.id}`}>{t('ex_see')} →</Link>}
      </div>
    );
  }
  const a = news[0];
  return (
    <div className={`hs-cols ${examEl && a ? '' : 'one'}`}>
      {examEl}
      {a && <div className="hs-block"><span className="tag">{t('news_important')}</span><h2>{a.title}</h2><p>{a.body}</p></div>}
    </div>
  );
}

function Presence({ checkin, onDone }) {
  const { toast } = useUI(); const { t } = useLang(); const [busy, setBusy] = useState(false);
  const click = async () => {
    setBusy(true);
    try { const r = await api('/student/checkin', { method: 'POST' }); onDone(r); toast(t('presence_ok'), 'green'); } finally { setBusy(false); }
  };
  const days = [...Array(14)].map((_, i) => { const d = new Date(checkin.today + 'T00:00:00'); d.setDate(d.getDate() - (13 - i)); return d.toISOString().slice(0, 10); });
  return (
    <section className="card presence">
      <h2>{t('presence')}</h2>
      <button className={`big-btn ${checkin.checkedToday ? 'ok' : ''}`} disabled={checkin.checkedToday || busy} onClick={click}>
        {checkin.checkedToday ? `✓ ${t('present_today')}` : t('mark_present')}
      </button>
      <div className="days">{days.map((d) => <i key={d} className={`${checkin.days.includes(d) ? 'on' : ''} ${d === checkin.today ? 'today' : ''}`} />)}</div>
      <p className="muted" style={{ margin: 0 }}>{t('presence_n', checkin.total)}</p>
    </section>
  );
}

export default function Dashboard() {
  const { user, refreshStats } = useAuth(); const { t } = useLang();
  const { celebrate } = useUI(); const [popup, setPopup] = useState(false);
  const [d, setD] = useState(null); const [news, setNews] = useState([]); const [board, setBoard] = useState([]); const [err, setErr] = useState('');
  useEffect(() => {
    api('/student/dashboard').then((x) => { setD(x); refreshStats(); }).catch((e) => setErr(e.message));
    api('/student/announcements').then(setNews).catch(() => {});
    api('/student/leaderboard').then(setBoard).catch(() => {});
  }, []);
  // Annonce des résultats d'examen : fenêtre de félicitations une seule fois par publication
  const seenKey = d?.exam_result ? `exam_seen_${d.exam_result.id}_${d.exam_result.published_at}` : null;
  useEffect(() => { if (seenKey && !localStorage.getItem(seenKey)) { setPopup(true); celebrate(); } }, [seenKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const closePopup = () => { if (seenKey) localStorage.setItem(seenKey, '1'); setPopup(false); };
  if (err) return <p className="error">{err}</p>;
  if (!d) return <p className="center">{t('loading')}</p>;
  const first = user.name.split(' ')[0];
  const h = new Date().getHours(); const hello = h < 13 ? t('morning') : h < 18 ? t('afternoon') : t('evening');
  const en = d.enrollment; const agency = d.agency;
  const pct = agency.total ? Math.round((agency.done / agency.total) * 100) : 0;
  const started = d.steps?.some((s) => s.status !== 'à faire');
  const lvl = levelOf(d.me?.xp);

  // 1) Bonjour  2) Examen + annonce importante  3) Agence (photo)
  const slides = [{
    key: 'hello', className: 'green',
    content: en ? (
      <>
        <h1>{hello}, {first}</h1>
        <p>{d.me.streak > 1 ? t('streak_msg', d.me.streak) : t('streak_none')}</p>
        <p className="hs-meta">{t('streak')} : {t('days', d.me.streak)} · {t('level')} {en.level} · {lvl.name}</p>
        <div className="xpbar" title={`${d.me.xp} XP`}><i style={{ width: `${lvl.pct}%` }} /></div>
        <p className="hs-small">{t('xp_next', 100 - lvl.into)}</p>
        {d.session && <Link className="btn-white" to={`/seance/${d.session.id}`}>{started ? t('resume') : t('start')} →</Link>}
      </>
    ) : <><h1>{hello}, {first}</h1><p>{t('declared')} : <strong>{user.level}</strong>. {t('no_enroll')}</p></>,
  }];
  if (en && (d.exam || news.length)) slides.push({ key: 'exam', className: 'red', content: <ExamNews exam={d.exam} news={news} /> });
  slides.push({
    key: 'agency', className: 'photo',
    content: (
      <>
        <span className="tag">{t('agency_tag')}</span>
        <h2>{agency.joined ? t('agency_mine') : t('agency_new')}</h2>
        <p>{agency.joined ? t('agency_text_joined', agency.done, agency.total) : t('agency_text_new')}</p>
        {agency.joined && <div className="xpbar" title={`${pct}%`}><i style={{ width: `${pct}%` }} /></div>}
        <Link to="/agence" className="btn-white">{agency.joined ? t('agency_go2') : t('agency_go')} →</Link>
      </>
    ),
  });

  if (!en) return <HeroCarousel slides={slides} />;
  const done = en.total_sessions - en.sessions_remaining;
  const { evaluation: ev, me, word } = d;
  const STEP = { lesson: t('st_lesson'), listening: t('st_listen'), exercise: t('st_exo'), oral: t('st_oral') };

  return (
    <div>
      <HeroCarousel slides={slides} />
      {d.exam_result && (
        <Link to={`/examen/${d.exam_result.id}`} className="res-banner">
          <div className="res-badge"><b><CountUp value={d.exam_result.total} /></b><span>/ {d.exam_result.max_total}</span></div>
          <div className="res-txt"><strong>{t('ex_result_t')}</strong><span>{d.exam_result.title}</span>
            <div className="res-parts">{['lettura', 'ascolto', 'struttura'].map((k) => { const x = d.exam_result.scores?.[k]; return x ? <i key={k}>{t(`ex_part_${k}`)} <b>{x.score}/{x.max}</b></i> : null; })}</div>
          </div>
          <span className="res-go">{t('ex_see')} →</span>
        </Link>
      )}
      <h2 className="sec">{t('space')}</h2>
      <div className="grid3">
        <section className="card">
          <h3>{t('current')}</h3>
          {d.session ? (
            <>
              <p className="muted" style={{ marginTop: 0 }}>{d.lesson.title}</p>
              <div className="path">{d.steps.map((s, i) => (
                <div key={s.key} className={`node ${s.status === 'terminé' ? 'done' : s.status === 'en cours' ? 'now' : ''}`}>
                  <div className="dot">{s.status === 'terminé' ? '✓' : i + 1}</div>{STEP[s.key]}
                </div>))}</div>
              <Link className="primary btn" to={`/seance/${d.session.id}`}>{t('open_lesson')}</Link>
            </>
          ) : <p>{t('no_session')}</p>}
        </section>

        <section className="card">
          <h3>{t('notes')}</h3>
          <div className="scores">
            <div><b><CountUp value={ev.exercise} /></b><span>{t('exo')}</span></div>
            <div><b><CountUp value={ev.listening} /></b><span>{t('listen')}</span></div>
            <div><b className={typeof ev.oral === 'string' ? 'pending' : ''}>{typeof ev.oral === 'string' ? ev.oral : <CountUp value={ev.oral} />}</b><span>{t('oral')}</span></div>
            <div className="total"><b><CountUp value={ev.total} /></b><span>{t('total_note')}</span></div>
          </div>
          {ev.comment && <blockquote>{ev.comment}<footer>{t('comment_of', en.teacher_name || t('teacher'))}</footer></blockquote>}
          <EvolutionChart history={ev.history} />
        </section>

        <Presence checkin={d.checkin} onDone={(checkin) => setD({ ...d, checkin })} />

        <section className="card">
          <h3>{t('my_course')}</h3>
          <dl>
            <dt>{t('course')}</dt><dd>{en.title}</dd>
            <dt>{t('teacher')}</dt><dd>{en.teacher_name || t('to_assign')}</dd>
            <dt>{t('level')}</dt><dd>{en.level}</dd>
          </dl>
          <p style={{ margin: '1rem 0 .4rem', fontWeight: 700 }}>{t('sessions_done', done, en.sessions_remaining)}</p>
          <div className="bar"><i style={{ width: `${(done / en.total_sessions) * 100}%` }} /></div>
        </section>

        <section className="card word">
          <h3>{t('word')}</h3>
          <p className="it">{word.it}</p><p className="fr">{word.fr}</p>
          <SpeakBtn text={word.it} />
          <p><em>« {word.example} »</em></p>
          <Link to="/vocabulaire" className="btn primary">{t('review_cards')}</Link>
        </section>

        <section className="card">
          <h3>{t('ranking')}</h3>
          <ol className="board">{board.map((b, i) => <li key={i} className={b.me ? 'me' : ''}>{b.first_name}{b.me && ` (${t('me')})`}<span>{b.xp} XP</span></li>)}</ol>
        </section>

        <section className="card full">
          <h3>{t('badges')}</h3>
          <div className="badges">{Object.entries(BADGES).map(([code, b]) => (
            <div key={code} className={`bdg ${me.badges.includes(code) ? 'on' : 'off'}`} title={b.desc}>{b.title}</div>))}</div>
        </section>

        {popup && d.exam_result && (
          <div className="overlay" onClick={closePopup}><div className="modal" role="dialog" aria-label={t('ex_new_result')} onClick={(e) => e.stopPropagation()}>
            <div className="trophy" aria-hidden>🏆</div>
            <h2>{t('ex_new_result')}</h2>
            <p>{t('ex_new_result_p', d.exam_result.title)}</p>
            <div className="gain"><CountUp value={d.exam_result.total} /> / {d.exam_result.max_total}</div>
            <div className="row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
              <Link className="primary btn" to={`/examen/${d.exam_result.id}`} onClick={closePopup}>{t('ex_see')}</Link>
              <button className="ghost" onClick={closePopup}>OK</button>
            </div>
          </div></div>
        )}

        {news.length > 1 && (
          <section className="card full">
            <h3>{t('news')}</h3>
            {news.slice(0, 4).map((a) => <p key={a.id}><strong>{a.title}</strong> – {a.body}</p>)}
          </section>
        )}
      </div>
    </div>
  );
}
