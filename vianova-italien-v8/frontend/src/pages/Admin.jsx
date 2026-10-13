import { useEffect, useState } from 'react';
import { api, download, mediaUrl } from '../api.js';
import EvolutionChart from '../components/EvolutionChart.jsx';
import { AGENCY_CATS } from '../agencyMeta.js';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const ROLES = { student: 'Étudiant', teacher: 'Professeur', admin: 'Administrateur' };
const useList = (path) => { const [rows, setRows] = useState([]); const load = () => api(path).then(setRows); useEffect(() => { load(); }, [path]); return [rows, load]; };

/* ---------------- Utilisateurs & inscriptions ---------------- */
// Résultat de l'envoi de l'e-mail de confirmation d'admission
function MailResult({ r }) {
  if (!r) return null;
  if (r.sent) return <p className="notice">Étudiant admis. E-mail de confirmation envoyé à <strong>{r.to}</strong> (cours, professeur, date et heure).</p>;
  if (r.reason === 'smtp_not_configured') return <p className="notice">Étudiant admis, mais l’e-mail n’a pas été envoyé : le serveur d’e-mail n’est pas configuré. Renseignez les lignes SMTP du fichier <code>backend/.env</code>, puis cliquez sur « Envoyer » dans le tableau des inscriptions.</p>;
  return <p className="error">Étudiant admis, mais l’e-mail n’a pas pu partir : {r.reason}. Vérifiez les réglages SMTP puis cliquez sur « Envoyer ».</p>;
}
export function AdminUsers() {
  const [users, load] = useList('/admin/users');
  const [courses] = useList('/admin/courses');
  const [enr, loadEnr] = useList('/admin/enrollments');
  const [f, setF] = useState({ name: '', email: '', role: 'teacher', level: '', city: '', phone: '' });
  const [temp, setTemp] = useState(null); const [err, setErr] = useState('');
  const [en, setEn] = useState({ user_id: '', course_id: '', teacher_id: '' });
  const [mail, setMail] = useState(null);
  const teachers = users.filter((u) => u.role === 'teacher' && u.active);
  const students = users.filter((u) => u.role === 'student' && u.active);

  const create = async (e) => {
    e.preventDefault(); setErr('');
    try { const r = await api('/admin/users', { method: 'POST', body: { ...f, level: f.level || undefined } }); setTemp(r); setF({ name: '', email: '', role: 'teacher', level: '', city: '', phone: '' }); load(); }
    catch (x) { setErr(x.message); }
  };
  const toggle = async (u) => { await api(`/admin/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } }); load(); };
  const reset = async (u) => setTemp({ user: u, ...(await api(`/admin/users/${u.id}/reset-password`, { method: 'POST' })) });
  const setLevel = async (u, level) => { await api(`/admin/users/${u.id}`, { method: 'PATCH', body: { level } }); load(); };
  const enroll = async (e) => {
    e.preventDefault();
    setErr(''); setMail(null);
    try { const r = await api('/admin/enrollments', { method: 'POST', body: en }); setMail(r.email); loadEnr(); setEn({ user_id: '', course_id: '', teacher_id: '' }); } catch (x) { setErr(x.message); }
  };
  const resend = async (id) => { setMail(null); try { setMail((await api(`/admin/enrollments/${id}/resend-email`, { method: 'POST' })).email); loadEnr(); } catch (x) { setErr(x.message); } };

  return (
    <div>
      <h2>Créer un compte</h2>
      <form className="card row wrap" onSubmit={create}>
        <input required placeholder="Nom complet" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input required type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        {f.role === 'student' && <><input placeholder="Ville / quartier" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /><input placeholder="Téléphone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></>}
        {f.role === 'student' && <select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option value="">Niveau…</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>}
        <button className="primary">Créer</button>
      </form>
      {err && <p className="error">{err}</p>}
      {temp && <p className="notice">Mot de passe temporaire pour <strong>{temp.user.name}</strong> : <code>{temp.temporaryPassword}</code> — transmettez-le maintenant, il ne sera plus affiché.</p>}

      <h2>Inscrire un étudiant à un cours</h2>
      <form className="card row wrap" onSubmit={enroll}>
        <select required value={en.user_id} onChange={(e) => setEn({ ...en, user_id: e.target.value })}><option value="">Étudiant…</option>{students.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.level || '—'})</option>)}</select>
        <select required value={en.course_id} onChange={(e) => setEn({ ...en, course_id: e.target.value })}><option value="">Cours…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.level})</option>)}</select>
        <select value={en.teacher_id} onChange={(e) => setEn({ ...en, teacher_id: e.target.value })}><option value="">Professeur…</option>{teachers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <button className="primary">Inscrire</button>
      </form>
      <MailResult r={mail} />

      <h2>Comptes</h2>
      <div className="card scroll"><table>
        <thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Niveau</th><th>Statut</th><th></th></tr></thead>
        <tbody>{users.map((u) => (
          <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{ROLES[u.role]}</td>
            <td>{u.role === 'student' ? <select value={u.level || ''} onChange={(e) => setLevel(u, e.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select> : '—'}</td>
            <td>{u.active ? 'Actif' : 'Désactivé'}</td>
            <td className="row"><button className="ghost" onClick={() => toggle(u)}>{u.active ? 'Désactiver' : 'Réactiver'}</button><button className="ghost" onClick={() => reset(u)}>Nouveau mot de passe</button></td></tr>
        ))}</tbody>
      </table></div>

      <h2>Inscriptions</h2>
      <div className="card scroll"><table>
        <thead><tr><th>Étudiant</th><th>Cours</th><th>Professeur</th><th>Séances restantes</th><th>E-mail d’admission</th></tr></thead>
        <tbody>{enr.map((e) => <tr key={e.id}><td>{e.student}</td><td>{e.course}</td><td>{e.teacher || '—'}</td><td>{e.sessions_remaining}</td>
          <td className="row">{e.admission_email_at ? `Envoyé le ${new Date(e.admission_email_at).toLocaleDateString('fr-FR')}` : 'Pas envoyé'}<button className="ghost" onClick={() => resend(e.id)}>{e.admission_email_at ? 'Renvoyer' : 'Envoyer'}</button></td></tr>)}</tbody>
      </table></div>
    </div>
  );
}

/* ---------------- Cours, leçons, ressources, exercices ---------------- */
function QuestionEditor({ onAdd }) {
  const empty = { type: 'qcm', prompt: '', options: '', answer: '', explanation: '' };
  const [q, setQ] = useState(empty);
  const add = () => {
    if (!q.prompt || q.answer === '') return;
    const base = { type: q.type, prompt: q.prompt, explanation: q.explanation };
    if (q.type === 'qcm') { const options = q.options.split(';').map((s) => s.trim()).filter(Boolean); onAdd({ ...base, options, answer: Number(q.answer) - 1 }); }
    else onAdd({ ...base, answer: q.answer });
    setQ(empty);
  };
  const hint = { qcm: 'Numéro de la bonne option (1, 2, 3…)', gap: 'Réponse attendue (variantes séparées par |)', order: 'Phrase correcte complète' }[q.type];
  return (
    <div className="row wrap">
      <select value={q.type} onChange={(e) => setQ({ ...q, type: e.target.value })}><option value="qcm">QCM</option><option value="gap">Texte à trous</option><option value="order">Remise en ordre</option></select>
      <input placeholder={q.type === 'gap' ? 'Phrase avec ___ à la place du trou' : 'Énoncé'} value={q.prompt} onChange={(e) => setQ({ ...q, prompt: e.target.value })} />
      {q.type === 'qcm' && <input placeholder="Options séparées par ;" value={q.options} onChange={(e) => setQ({ ...q, options: e.target.value })} />}
      <input placeholder={hint} value={q.answer} onChange={(e) => setQ({ ...q, answer: e.target.value })} />
      <input placeholder="Explication de l'erreur" value={q.explanation} onChange={(e) => setQ({ ...q, explanation: e.target.value })} />
      <button type="button" className="ghost" onClick={add}>Ajouter la question</button>
    </div>
  );
}

function LessonCard({ l, reload }) {
  const [open, setOpen] = useState(false);
  const [r, setR] = useState({ type: 'video', url: '', content: '' });
  const [ex, setEx] = useState({ title: '', kind: 'exercise', questions: [] });
  const addRes = async () => { await api(`/admin/lessons/${l.id}/resources`, { method: 'POST', body: r }); setR({ type: 'video', url: '', content: '' }); reload(); };
  const addEx = async () => { await api(`/admin/lessons/${l.id}/exercises`, { method: 'POST', body: ex }); setEx({ title: '', kind: 'exercise', questions: [] }); reload(); };
  const patch = async (body) => { await api(`/admin/lessons/${l.id}`, { method: 'PATCH', body }); reload(); };
  const [vtxt, setVtxt] = useState('');
  const [file, setFile] = useState(null); const [perr, setPerr] = useState('');
  const addPdf = async () => {
    setPerr(''); const fd = new FormData(); fd.append('pdf', file);
    try { await api(`/admin/lessons/${l.id}/pdf`, { method: 'POST', form: fd }); setFile(null); reload(); } catch (x) { setPerr(x.message); }
  };
  const addVocab = async () => {
    const items = vtxt.split('\n').map((line) => { const [pair, example] = line.split('|'); const [it, fr, en] = (pair || '').split('='); return { it, fr, en, example }; }).filter((x) => x.it?.trim() && x.fr?.trim());
    if (!items.length) return; await api(`/admin/lessons/${l.id}/vocab`, { method: 'POST', body: { items } }); setVtxt(''); reload();
  };
  const needText = r.type === 'written' || r.type === 'reading';
  return (
    <div className="card">
      <div className="row between">
        <strong>{l.position}. {l.title} <span className={`badge ${l.status === 'published' ? 'done' : ''}`}>{l.status === 'published' ? 'publié' : 'brouillon'}</span></strong>
        <span className="row">
          <button className="ghost" onClick={() => patch({ status: l.status === 'published' ? 'draft' : 'published' })}>{l.status === 'published' ? 'Dépublier' : 'Publier'}</button>
          <button className="ghost" onClick={() => setOpen(!open)}>{open ? 'Fermer' : 'Modifier'}</button>
          <button className="ghost" onClick={async () => { if (confirm('Supprimer cette leçon ?')) { await api(`/admin/lessons/${l.id}`, { method: 'DELETE' }); reload(); } }}>Supprimer</button>
        </span>
      </div>
      <p className="muted">{l.resources.length} ressource(s) · {l.exercises.length} exercice(s){l.publish_at ? ` · publication le ${new Date(l.publish_at).toLocaleDateString('fr-FR')}` : ''}</p>
      {open && (
        <>
          <label className="inline">Date de publication programmée<input type="datetime-local" onChange={(e) => patch({ publish_at: e.target.value || null, status: 'published' })} /></label>
          <label className="inline">Ordre<input type="number" defaultValue={l.position} style={{ width: 80 }} onBlur={(e) => patch({ position: Number(e.target.value) })} /></label>
          <h4>Ressources</h4>
          <ul>{l.resources.map((x) => <li key={x.id}>{x.type === 'pdf' ? <>PDF : <a href={mediaUrl(x.url)} target="_blank" rel="noreferrer">{x.file_name || 'ouvrir'}</a></> : <>{x.type} {x.url || (x.content || '').slice(0, 40)}</>} <button className="link" onClick={async () => { await api(`/admin/resources/${x.id}`, { method: 'DELETE' }); reload(); }}>retirer</button></li>)}</ul>
          <div className="row wrap">
            <select value={r.type} onChange={(e) => setR({ ...r, type: e.target.value })}><option value="video">Vidéo (lien)</option><option value="written">Leçon écrite</option><option value="audio">Audio (lien)</option><option value="reading">Texte à lire</option></select>
            <input placeholder={needText ? 'Lien de l\'image du manuscrit (facultatif)' : 'Lien https://…'} value={r.url} onChange={(e) => setR({ ...r, url: e.target.value })} />
            {needText && <textarea placeholder="Texte" value={r.content} onChange={(e) => setR({ ...r, content: e.target.value })} />}
            <button className="ghost" onClick={addRes}>Ajouter</button>
          </div>
          <div className="row wrap">
            <label className="inline">Ajouter un PDF<input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files[0] || null)} /></label>
            <button className="ghost" disabled={!file} onClick={addPdf}>Envoyer le PDF</button>
            {perr && <span className="error">{perr}</span>}
          </div>
          <h4>Vocabulaire ({(l.vocab || []).length} mots)</h4>
          <div className="vocab-list">{(l.vocab || []).map((v) => <span key={v.id}>{v.it} = {v.fr} <button className="link" onClick={async () => { await api(`/admin/vocab/${v.id}`, { method: 'DELETE' }); reload(); }}>✕</button></span>)}</div>
          <textarea placeholder={'Un mot par ligne : italien = français = anglais (facultatif) | exemple (facultatif)\nciao = salut = hello | Ciao Marco !\ngrazie = merci = thank you'} value={vtxt} onChange={(e) => setVtxt(e.target.value)} />
          <button className="ghost" onClick={addVocab}>Ajouter ces mots</button>
          <h4>Exercices</h4>
          <ul>{l.exercises.map((x) => <li key={x.id}>{x.title} ({x.kind}, {x.question_count} questions) <button className="link" onClick={async () => { await api(`/admin/exercises/${x.id}`, { method: 'DELETE' }); reload(); }}>supprimer</button></li>)}</ul>
          <div className="row wrap">
            <input placeholder="Titre de l'exercice" value={ex.title} onChange={(e) => setEx({ ...ex, title: e.target.value })} />
            <select value={ex.kind} onChange={(e) => setEx({ ...ex, kind: e.target.value })}><option value="exercise">Exercice</option><option value="listening">Écoute</option><option value="reading">Lecture</option></select>
          </div>
          <QuestionEditor onAdd={(x) => setEx({ ...ex, questions: [...ex.questions, x] })} />
          {ex.questions.length > 0 && <p className="muted">{ex.questions.length} question(s) prête(s)</p>}
          <button className="primary" disabled={!ex.title || !ex.questions.length} onClick={addEx}>Enregistrer l'exercice</button>
        </>
      )}
    </div>
  );
}

// Planning du cours : ces informations figurent dans l'e-mail envoyé à chaque étudiant admis
function CoursePlanning({ course, reload }) {
  const [p, setP] = useState({ start_date: course.starts_on || '', start_time: course.start_hhmm || '', schedule: course.schedule || '' });
  const [saved, setSaved] = useState(false); const [err, setErr] = useState('');
  const save = async (e) => {
    e.preventDefault(); setErr(''); setSaved(false);
    try { await api(`/admin/courses/${course.id}`, { method: 'PATCH', body: p }); setSaved(true); reload(); } catch (x) { setErr(x.message); }
  };
  return (
    <form className="card row wrap" onSubmit={save}>
      <strong>Planning de « {course.title} »</strong>
      <label className="inline">Début<input type="date" value={p.start_date} onChange={(e) => { setSaved(false); setP({ ...p, start_date: e.target.value }); }} /></label>
      <label className="inline">Heure<input type="time" value={p.start_time} onChange={(e) => { setSaved(false); setP({ ...p, start_time: e.target.value }); }} /></label>
      <input placeholder="Rythme (ex. lundi et jeudi)" value={p.schedule} onChange={(e) => { setSaved(false); setP({ ...p, schedule: e.target.value }); }} />
      <button className="primary">Enregistrer</button>
      {saved && <span className="ok">Planning enregistré.</span>}{err && <span className="error">{err}</span>}
      <p className="muted" style={{ width: '100%', margin: 0 }}>Heure de Madagascar. Date, heure et rythme sont envoyés par e-mail à chaque étudiant admis dans ce cours.</p>
    </form>
  );
}

export function AdminCourses() {
  const [courses, loadC] = useList('/admin/courses');
  const [sel, setSel] = useState(null);
  const [lessons, setLessons] = useState([]);
  const blank = { title: '', level: 'A1', total_sessions: 20, start_date: '', start_time: '', schedule: '' };
  const [c, setC] = useState(blank);
  const [lf, setLf] = useState({ title: '', video_url: '', written: '' });
  const [pdf, setPdf] = useState(null); const [lerr, setLerr] = useState('');
  const [lvl, setLvl] = useState('A1');
  const shown = courses.filter((x) => x.level === lvl);
  const loadL = () => sel && api(`/admin/courses/${sel}/lessons`).then(setLessons);
  useEffect(() => { loadL(); }, [sel]);
  const create = async (e) => { e.preventDefault(); await api('/admin/courses', { method: 'POST', body: c }); setC(blank); loadC(); };
  const addLesson = async (e) => {
    e.preventDefault(); setLerr('');
    try {
      const l = await api(`/admin/courses/${sel}/lessons`, { method: 'POST', body: { ...lf, status: 'published' } });
      if (pdf) { const fd = new FormData(); fd.append('pdf', pdf); await api(`/admin/lessons/${l.id}/pdf`, { method: 'POST', form: fd }); }
      setLf({ title: '', video_url: '', written: '' }); setPdf(null); e.target.reset(); loadL();
    } catch (x) { setLerr(x.message); loadL(); }
  };

  return (
    <div>
      <h2>Nouveau cours</h2>
      <form className="card row wrap" onSubmit={create}>
        <input required placeholder="Titre du cours" value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} />
        <select value={c.level} onChange={(e) => setC({ ...c, level: e.target.value })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
        <label className="inline">Séances<input type="number" min="1" value={c.total_sessions} style={{ width: 80 }} onChange={(e) => setC({ ...c, total_sessions: Number(e.target.value) })} /></label>
        <label className="inline">Début<input type="date" value={c.start_date} onChange={(e) => setC({ ...c, start_date: e.target.value })} /></label>
        <label className="inline">Heure<input type="time" value={c.start_time} onChange={(e) => setC({ ...c, start_time: e.target.value })} /></label>
        <input placeholder="Rythme (ex. lundi et jeudi)" value={c.schedule} onChange={(e) => setC({ ...c, schedule: e.target.value })} />
        <button className="primary">Créer</button>
      </form>
      <h2>Cours par niveau</h2>
      <div className="lvl-tabs">{LEVELS.map((l) => <button key={l} className={lvl === l ? 'on' : ''} onClick={() => { setLvl(l); setSel(null); setLessons([]); }}>{l} <small>({courses.filter((x) => x.level === l).length})</small></button>)}</div>
      {!shown.length && <p className="muted">Aucun cours au niveau {lvl}. Créez-en un ci-dessus.</p>}
      <div className="chips">{shown.map((x) => <button key={x.id} className={sel === x.id ? 'on' : ''} onClick={() => setSel(x.id)}>{x.title} · {x.students} étudiant(s)</button>)}</div>
      {sel && courses.find((x) => x.id === sel) && <CoursePlanning key={sel} course={courses.find((x) => x.id === sel)} reload={loadC} />}
      {sel && (
        <>
          <div className="row between"><h2>Leçons</h2><button className="ghost" onClick={async () => { if (confirm('Supprimer ce cours et tout son contenu ?')) { await api(`/admin/courses/${sel}`, { method: 'DELETE' }); setSel(null); setLessons([]); loadC(); } }}>Supprimer le cours</button></div>
          <form className="card" onSubmit={addLesson}>
            <h3>Insérer une leçon (niveau {courses.find((x) => x.id === sel)?.level})</h3>
            <label>Titre de la leçon<input required value={lf.title} onChange={(e) => setLf({ ...lf, title: e.target.value })} /></label>
            <label>Lien de la vidéo (YouTube, Vimeo…)<input type="url" placeholder="https://youtu.be/…" value={lf.video_url} onChange={(e) => setLf({ ...lf, video_url: e.target.value })} /></label>
            <label>Texte de la leçon (affiché à côté de la vidéo)<textarea value={lf.written} onChange={(e) => setLf({ ...lf, written: e.target.value })} /></label>
            <label>Leçon en PDF (15 Mo maximum, facultatif)<input type="file" accept="application/pdf,.pdf" onChange={(e) => setPdf(e.target.files[0] || null)} /></label>
            {lerr && <p className="error">{lerr}</p>}
            <p className="muted">Les exercices, l’oral et le vocabulaire s’ajoutent ensuite avec « Modifier » sur la leçon.</p>
            <button className="primary">Publier la leçon</button>
          </form>
          {lessons.map((l) => <LessonCard key={l.id} l={l} reload={loadL} />)}
        </>
      )}
    </div>
  );
}

/* ---------------- Suivi des étudiants ---------------- */
export function AdminTracking() {
  const [rows] = useList('/admin/tracking'); const [kpi, setKpi] = useState(null);
  useEffect(() => { api('/admin/stats').then(setKpi).catch(() => {}); }, []);
  const [sel, setSel] = useState(null); const [hist, setHist] = useState([]);
  const open = async (s) => { setSel(s); setHist(await api(`/admin/tracking/${s.id}/history`)); };
  const alerts = rows.filter((r) => r.alert);
  return (
    <div>
      <div className="row between"><h2>Suivi des étudiants</h2><button className="ghost" onClick={() => download('/admin/export/results.csv', 'resultats.csv')}>Exporter (Excel / CSV)</button></div>
      {kpi && <div className="kpis">
        <div className="kpi"><b>{kpi.students}</b><span>Étudiants actifs</span></div><div className="kpi"><b>{kpi.active_week}</b><span>Connectés cette semaine</span></div>
        <div className="kpi"><b>{kpi.validated_week}</b><span>Séances validées (7 j)</span></div><div className="kpi"><b>{kpi.pending_orals}</b><span>Oraux à corriger</span></div>
        <div className="kpi"><b>{kpi.teachers}</b><span>Professeurs</span></div><div className="kpi"><b>{kpi.courses}</b><span>Cours</span></div></div>}
      {alerts.length > 0 && <p className="notice">{alerts.length} alerte(s) : {alerts.map((a) => `${a.name} (${a.alert})`).join(', ')}</p>}
      <div className="card scroll"><table>
        <thead><tr><th>Étudiant</th><th>Niveau</th><th>Séances</th><th>Présences</th><th>Exercices /25</th><th>Écoute /25</th><th>Oral /22</th><th>Total /72</th><th>Dernière connexion</th><th></th></tr></thead>
        <tbody>{rows.map((s) => (
          <tr key={s.id} onClick={() => open(s)} className="click">
            <td>{s.name}</td><td>{s.level}</td><td>{s.sessions_done}/{s.total_sessions}</td><td>{s.attendance}</td>
            <td>{s.exercise_avg ?? '—'}</td><td>{s.listening_avg ?? '—'}</td><td>{s.oral_avg ?? '—'}</td><td><strong>{s.total ?? '—'}</strong></td>
            <td>{s.last_login ? new Date(s.last_login).toLocaleDateString('fr-FR') : 'Jamais'}</td>
            <td>{s.alert && <span className="badge alert">{s.alert}</span>}</td>
          </tr>
        ))}</tbody>
      </table></div>
      {sel && <div className="card"><h3>Évolution de {sel.name}</h3><EvolutionChart history={hist} /></div>}
    </div>
  );
}

/* ---------------- Examens & annonces ---------------- */
export function AdminMisc() {
  const [courses] = useList('/admin/courses'); const [exams] = useList('/admin/exams');
  const [users] = useList('/admin/users?role=student'); const [news, loadN] = useList('/admin/announcements');
  const [res, setRes] = useState({ exam_id: '', user_id: '', score: '' });
  const [a, setA] = useState({ title: '', body: '', course_id: '' });
  const addRes = async (e) => { e.preventDefault(); await api(`/admin/exams/${res.exam_id}/results`, { method: 'POST', body: res }); setRes({ exam_id: '', user_id: '', score: '' }); };
  const addNews = async (e) => { e.preventDefault(); await api('/admin/announcements', { method: 'POST', body: a }); setA({ title: '', body: '', course_id: '' }); loadN(); };
  return (
    <div>
      <p className="notice">Pour créer un examen, insérer les sujets (Lettura, Ascolto, Struttura) et publier les résultats, utilisez l’onglet <strong>Examens</strong>.</p>
      <h2>Saisir une note à la main (examen sur papier)</h2>
      <form className="card row wrap" onSubmit={addRes}>
        <select required value={res.exam_id} onChange={(e) => setRes({ ...res, exam_id: e.target.value })}><option value="">Examen…</option>{exams.map((e) => <option key={e.id} value={e.id}>{e.title} – {e.course}</option>)}</select>
        <select required value={res.user_id} onChange={(e) => setRes({ ...res, user_id: e.target.value })}><option value="">Étudiant…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <input required type="number" min="0" max="72" step="0.5" placeholder="Note /72" value={res.score} onChange={(e) => setRes({ ...res, score: e.target.value })} style={{ maxWidth: 120 }} />
        <button className="primary">Enregistrer</button>
      </form>
      <h2>Nouvelle annonce</h2>
      <form className="card" onSubmit={addNews}>
        <div className="row wrap">
          <input required placeholder="Titre" value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} />
          <select value={a.course_id} onChange={(e) => setA({ ...a, course_id: e.target.value })}><option value="">Tous les étudiants</option>{courses.map((c) => <option key={c.id} value={c.id}>Groupe : {c.title}</option>)}</select>
        </div>
        <textarea required placeholder="Message" value={a.body} onChange={(e) => setA({ ...a, body: e.target.value })} />
        <button className="primary">Publier l'annonce</button>
      </form>
      {news.map((n) => <p key={n.id} className="muted"><strong>{n.title}</strong> – {n.body}</p>)}
    </div>
  );
}

/* ---------------- Tableau des étudiants (infos complètes) ---------------- */
const FEE = { paid: 'Payé', partial: 'Partiel', unpaid: 'Non payé' };
const NEXT_FEE = { unpaid: 'partial', partial: 'paid', paid: 'unpaid' };

export function AdminStudents() {
  const [data, setData] = useState({ students: [], agency_total: 0 });
  const [q, setQ] = useState(''); const [lvl, setLvl] = useState(''); const [fee, setFee] = useState('');
  const load = () => api('/admin/students').then(setData);
  useEffect(() => { load(); }, []);
  const patch = async (u, body) => { await api(`/admin/users/${u.id}`, { method: 'PATCH', body }); load(); };
  const rows = data.students.filter((u) =>
    (!lvl || u.level === lvl) && (!fee || u.fee_status === fee) &&
    (!q || [u.name, u.city, u.email, u.phone].some((v) => (v || '').toLowerCase().includes(q.toLowerCase()))));
  const count = (k) => data.students.filter((u) => u.fee_status === k).length;
  return (
    <div>
      <h2>Étudiants</h2>
      <div className="kpis">
        <div className="kpi"><b>{data.students.length}</b><span>Étudiants inscrits</span></div>
        <div className="kpi"><b>{count('paid')}</b><span>Écolage payé</span></div>
        <div className="kpi"><b>{count('partial')}</b><span>Paiement partiel</span></div>
        <div className="kpi"><b>{count('unpaid')}</b><span>Non payé</span></div>
        <div className="kpi"><b>{data.students.filter((u) => u.agency_joined).length}</b><span>Suivent l’agence</span></div>
      </div>
      <div className="filters">
        <input placeholder="Rechercher : nom, ville, téléphone, email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={lvl} onChange={(e) => setLvl(e.target.value)}><option value="">Tous les niveaux</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
        <select value={fee} onChange={(e) => setFee(e.target.value)}><option value="">Écolage : tous</option>{Object.entries(FEE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <div className="card table-card"><div className="scroll"><table>
        <thead><tr><th>Nom</th><th>Niveau</th><th>Cours</th><th>Écolage</th><th>Ville / quartier</th><th>Téléphone</th><th>Présences</th><th>Agence</th><th>Dernière connexion</th></tr></thead>
        <tbody>{rows.map((u) => (
          <tr key={u.id} style={u.active ? undefined : { opacity: .5 }}>
            <td><strong>{u.name}</strong><br /><small className="muted">{u.email}</small></td>
            <td><select value={u.level || ''} onChange={(e) => patch(u, { level: e.target.value })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></td>
            <td>{u.course || <span className="muted">Non inscrit</span>}</td>
            <td><button className={`fee ${u.fee_status}`} title="Cliquer pour changer" onClick={() => patch(u, { fee_status: NEXT_FEE[u.fee_status] })}>{FEE[u.fee_status]}</button></td>
            <td><input className="cell-in" defaultValue={u.city || ''} placeholder="—" onBlur={(e) => e.target.value !== (u.city || '') && patch(u, { city: e.target.value })} /></td>
            <td><input className="cell-in" defaultValue={u.phone || ''} placeholder="—" onBlur={(e) => e.target.value !== (u.phone || '') && patch(u, { phone: e.target.value })} /></td>
            <td>{u.presences}</td>
            <td>{u.agency_joined ? <><span className="mini-bar"><i style={{ width: `${data.agency_total ? (u.agency_done / data.agency_total) * 100 : 0}%` }} /></span>{u.agency_done}/{data.agency_total}</> : <span className="muted">—</span>}</td>
            <td>{u.last_login ? new Date(u.last_login).toLocaleDateString('fr-FR') : 'Jamais'}</td>
          </tr>))}
          {!rows.length && <tr><td colSpan="9" className="muted">Aucun étudiant trouvé.</td></tr>}
        </tbody>
      </table></div></div>
    </div>
  );
}

/* ---------------- Agence : démarches (admin seul) + suivi des étudiants ---------------- */
export function AdminAgency() {
  const [data, setData] = useState({ steps: [] }); const [follow, setFollow] = useState({ total: 0, students: [] });
  const [f, setF] = useState({ category: 'inscription', title: '', description: '', link_url: '' });
  const [detail, setDetail] = useState(null); const [err, setErr] = useState('');
  const load = () => { api('/agency').then(setData); api('/agency/admin/students').then(setFollow); };
  useEffect(() => { load(); }, []);
  const add = async (e) => { e.preventDefault(); setErr(''); try { await api('/agency/steps', { method: 'POST', body: f }); setF({ ...f, title: '', description: '', link_url: '' }); load(); } catch (x) { setErr(x.message); } };
  const patch = async (st, body) => { await api(`/agency/steps/${st.id}`, { method: 'PATCH', body }); load(); };
  const del = async (st) => { if (confirm(`Supprimer « ${st.title} » ?`)) { await api(`/agency/steps/${st.id}`, { method: 'DELETE' }); load(); } };
  const edit = (st) => { const title = prompt('Titre', st.title); if (title === null) return; const description = prompt('Description', st.description || ''); patch(st, { title, description: description ?? st.description }); };
  const open = async (u) => setDetail({ u, steps: await api(`/agency/admin/students/${u.id}`) });
  return (
    <div>
      <h2>Agence – démarches</h2>
      <p className="muted">Vous seul(e) pouvez créer, modifier ou retirer les démarches. Les étudiants ne peuvent que cocher les étapes terminées.</p>
      <form className="card" onSubmit={add}>
        <h3>Nouvelle démarche</h3>
        <div className="row wrap">
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(AGENCY_CATS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select>
          <input required placeholder="Titre de la démarche" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
        <textarea placeholder="Explication pour l’étudiant (documents, délais…)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <input type="url" placeholder="Lien utile (facultatif) https://…" value={f.link_url} onChange={(e) => setF({ ...f, link_url: e.target.value })} style={{ width: '100%', marginBottom: '.6rem' }} />
        {err && <p className="error">{err}</p>}<button className="primary">Ajouter</button>
      </form>

      <div className="ag-cats">
        {Object.entries(AGENCY_CATS).map(([k, c]) => {
          const list = data.steps.filter((x) => x.category === k); if (!list.length) return null;
          return (
            <section key={k} className="card ag-cat">
              <div className="ribbon"><span>{c.label}</span><span>{list.length}</span></div>
              {list.map((st) => (
                <div key={st.id} className="step"><span style={{ flex: 1 }}><b>{st.title} {!st.published && <span className="badge">masqué</span>}</b>{st.description && <small>{st.description}</small>}</span>
                  <span className="row"><button className="ghost" onClick={() => edit(st)}>Modifier</button><button className="ghost" onClick={() => patch(st, { published: !st.published })}>{st.published ? 'Masquer' : 'Publier'}</button><button className="ghost" onClick={() => del(st)}>✕</button></span></div>
              ))}
            </section>
          );
        })}
      </div>

      <h2>Étudiants qui suivent l’agence ({follow.students.length})</h2>
      <div className="card table-card"><div className="scroll"><table>
        <thead><tr><th>Étudiant</th><th>Niveau</th><th>Ville</th><th>Téléphone</th><th>Avancement</th><th>Depuis</th></tr></thead>
        <tbody>{follow.students.map((u) => (
          <tr key={u.id} className="click" onClick={() => open(u)}><td><strong>{u.name}</strong></td><td>{u.level}</td><td>{u.city || '—'}</td><td>{u.phone || '—'}</td>
            <td><span className="mini-bar"><i style={{ width: `${follow.total ? (u.done / follow.total) * 100 : 0}%` }} /></span>{u.done}/{follow.total}</td>
            <td>{new Date(u.agency_joined_at).toLocaleDateString('fr-FR')}</td></tr>))}
          {!follow.students.length && <tr><td colSpan="6" className="muted">Aucun étudiant n’a encore rejoint l’agence.</td></tr>}</tbody>
      </table></div></div>
      {detail && (
        <div className="card"><div className="row between"><h3>Démarches de {detail.u.name}</h3><button className="ghost" onClick={() => setDetail(null)}>Fermer</button></div>
          {Object.entries(AGENCY_CATS).map(([k, c]) => { const l = detail.steps.filter((x) => x.category === k); return l.length ? (
            <div key={k}><h4>{c.label}</h4>{l.map((x) => <p key={x.id} style={{ margin: '.2rem 0' }}>{x.done ? '✓' : '○'} {x.title}</p>)}</div>) : null; })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Examens en ligne : sujets, ouverture, résultats ---------------- */
const PARTS = { lettura: ['📖', 'Lettura', 'Lecture : un texte et des questions'], ascolto: ['🎧', 'Ascolto', 'Écoute : un audio et des questions'], struttura: ['🧩', 'Struttura', 'Grammaire et structures'] };
const KINDS = ['lettura', 'ascolto', 'struttura'];
const XSTATUS = { draft: ['', 'Brouillon'], open: ['now', 'Ouvert aux étudiants'], closed: ['done', 'Fermé'] };
const QLABEL = { qcm: 'QCM', gap: 'Texte à trous', order: 'Remise en ordre' };

function SectionEditor({ examId, s, reload }) {
  const [f, setF] = useState({ max_points: s.max_points, instructions: s.instructions || '', passage: s.passage || '', audio_url: s.audio_url || '' });
  const [file, setFile] = useState(null); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [icon, name, hint] = PARTS[s.kind];
  const save = async () => {
    setErr(''); setMsg('');
    try {
      await api(`/admin/exams/${examId}/sections/${s.kind}`, { method: 'PATCH', body: { max_points: Number(f.max_points), instructions: f.instructions, passage: f.passage, audio_url: f.audio_url } });
      setMsg('Enregistré.'); reload();
    } catch (x) { setErr(x.message); }
  };
  const sendAudio = async () => {
    setErr(''); setBusy(true); const fd = new FormData(); fd.append('audio', file);
    try { const r = await api(`/admin/exams/${examId}/sections/${s.kind}/audio`, { method: 'POST', form: fd }); setF({ ...f, audio_url: r.audio_url }); setFile(null); setMsg('Audio envoyé.'); reload(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const addQ = async (x) => { setErr(''); try { await api(`/admin/exams/${examId}/questions`, { method: 'POST', body: { ...x, section: s.kind } }); reload(); } catch (e) { setErr(e.message); } };
  const delQ = async (q) => { await api(`/admin/exams/questions/${q.id}`, { method: 'DELETE' }); reload(); };
  return (
    <section className="card exam-edit-sec">
      <div className="row between wrap"><h3 style={{ margin: 0 }}>{icon} {name} <small className="muted">· {hint}</small></h3>
        <label className="inline">Barème<input type="number" min="0" max="72" step="0.5" value={f.max_points} style={{ width: 90 }} onChange={(e) => setF({ ...f, max_points: e.target.value })} /> points</label></div>
      <label>Consigne (facultatif)<textarea value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} placeholder="Ex. Lisez le texte puis répondez aux questions." /></label>
      {s.kind === 'lettura' && <label>Texte à lire<textarea style={{ minHeight: 140 }} value={f.passage} onChange={(e) => setF({ ...f, passage: e.target.value })} placeholder="Collez ici le texte du sujet de lecture." /></label>}
      {s.kind === 'ascolto' && (
        <div className="audio-edit">
          <label>Lien de l’audio (https://…) ou envoyez un fichier<input type="url" value={f.audio_url} onChange={(e) => setF({ ...f, audio_url: e.target.value })} placeholder="https://…" /></label>
          <div className="row wrap"><input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" onChange={(e) => setFile(e.target.files[0] || null)} /><button type="button" className="ghost" disabled={!file || busy} onClick={sendAudio}>{busy ? 'Envoi…' : 'Envoyer l’audio'}</button></div>
          {f.audio_url && <audio controls src={mediaUrl(f.audio_url)} />}
        </div>
      )}
      <div className="row"><button className="primary" onClick={save}>Enregistrer la partie</button>{msg && <span className="ok">{msg}</span>}{err && <span className="error">{err}</span>}</div>

      <h4>Questions ({s.questions.length})</h4>
      <ol className="q-list">{s.questions.map((q) => (
        <li key={q.id}><span><span className="badge">{QLABEL[q.type]}</span> {q.prompt}
          <small className="muted"> — réponse : {q.type === 'qcm' ? `${Number(q.answer) + 1}. ${q.options?.[Number(q.answer)] ?? ''}` : String(q.answer)}</small></span>
          <button className="link" onClick={() => delQ(q)}>supprimer</button></li>))}</ol>
      <QuestionEditor onAdd={addQ} />
    </section>
  );
}

function ExamEditor({ id, onChanged }) {
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  const load = () => api(`/admin/exams/${id}`).then((x) => { setD(x); onChanged?.(); }).catch((e) => setErr(e.message));
  useEffect(() => { setD(null); load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <p className="error">{err}</p>;
  if (!d) return <p className="muted">Chargement…</p>;
  const total = d.sections.reduce((a, s) => a + Number(s.max_points), 0);
  return (
    <div>
      <p className={total === 72 ? 'ok' : 'notice'}>Barème total : <strong>{total} points</strong>{total === 72 ? ' (25 + 25 + 22)' : ' — le barème habituel est de 72 points (25 + 25 + 22).'} · {d.exam.question_count} question(s) au total.</p>
      {d.sections.map((s) => <SectionEditor key={s.kind + id} examId={id} s={s} reload={load} />)}
    </div>
  );
}

function ExamResults({ id, onChanged }) {
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  const load = () => api(`/admin/exams/${id}/attempts`).then(setD).catch((e) => setErr(e.message));
  useEffect(() => { setD(null); load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const publish = async (pub) => {
    if (pub && !confirm('Annoncer les résultats ? Les étudiants verront leur note sur 72 et la correction, et une annonce sera créée.')) return;
    setErr(''); try { await api(`/admin/exams/${id}/publish`, { method: 'POST', body: { publish: pub } }); await load(); onChanged?.(); } catch (e) { setErr(e.message); }
  };
  const reset = async (s) => { if (confirm(`Autoriser ${s.name} à repasser l’examen ? Sa tentative sera supprimée.`)) { await api(`/admin/exams/${id}/attempts/${s.user_id}`, { method: 'DELETE' }); load(); onChanged?.(); } };
  if (err && !d) return <p className="error">{err}</p>;
  if (!d) return <p className="muted">Chargement…</p>;
  const { exam, students } = d; const published = !!exam.results_published_at;
  const sc = (s, k) => (s.scores?.[k] ? `${s.scores[k].score} / ${s.scores[k].max}` : '—');
  return (
    <div>
      <div className="card row between wrap">
        <span><strong>{exam.submitted}</strong> / {exam.enrolled} étudiants ont rendu l’examen{published ? ` · résultats annoncés le ${new Date(exam.results_published_at).toLocaleDateString('fr-FR')}` : ''}</span>
        <span className="row">
          {published && <button className="ghost" onClick={() => publish(false)}>Retirer l’annonce</button>}
          <button className="primary" disabled={!exam.submitted} onClick={() => publish(true)}>{published ? 'Republier' : 'Annoncer les résultats'}</button>
        </span>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="card table-card"><div className="scroll"><table>
        <thead><tr><th>Étudiant</th><th>État</th><th>Lettura</th><th>Ascolto</th><th>Struttura</th><th>Total /72</th><th></th></tr></thead>
        <tbody>{students.map((s) => (
          <tr key={s.user_id}><td><strong>{s.name}</strong></td>
            <td><span className={`badge ${s.status === 'rendu' ? 'done' : s.status === 'en cours' ? 'now' : ''}`}>{s.status}</span>{s.late && <span className="badge alert" title="Rendu après la fin du temps"> en retard</span>}</td>
            <td>{sc(s, 'lettura')}</td><td>{sc(s, 'ascolto')}</td><td>{sc(s, 'struttura')}</td>
            <td><strong>{s.total ?? '—'}</strong>{s.total !== null && ` / ${s.max_total}`}</td>
            <td>{s.status !== 'pas commencé' && <button className="ghost" onClick={() => reset(s)}>Repasser</button>}</td></tr>))}
          {!students.length && <tr><td colSpan="7" className="muted">Aucun étudiant inscrit à ce cours.</td></tr>}</tbody>
      </table></div></div>
    </div>
  );
}

export function AdminExams() {
  const [courses] = useList('/admin/courses'); const [exams, loadX] = useList('/admin/exams');
  const blank = { course_id: '', title: '', exam_date: '', duration_min: 60 };
  const [f, setF] = useState(blank); const [sel, setSel] = useState(null); const [view, setView] = useState('edit'); const [err, setErr] = useState('');
  const create = async (e) => {
    e.preventDefault(); setErr('');
    try { const x = await api('/admin/exams', { method: 'POST', body: f }); setF(blank); await loadX(); setSel(x.id); setView('edit'); } catch (x) { setErr(x.message); }
  };
  const patch = async (x, body) => { setErr(''); try { await api(`/admin/exams/${x.id}`, { method: 'PATCH', body }); loadX(); } catch (e) { setErr(e.message); } };
  const del = async (x) => { if (confirm(`Supprimer l’examen « ${x.title} » avec ses sujets et ses notes ?`)) { await api(`/admin/exams/${x.id}`, { method: 'DELETE' }); if (sel === x.id) setSel(null); loadX(); } };
  const cur = exams.find((x) => x.id === sel);
  return (
    <div>
      <h2>Nouvel examen</h2>
      <form className="card row wrap" onSubmit={create}>
        <select required value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}><option value="">Cours…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.level})</option>)}</select>
        <input required placeholder="Intitulé de l’examen" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input required type="date" value={f.exam_date} onChange={(e) => setF({ ...f, exam_date: e.target.value })} />
        <label className="inline">Durée<input type="number" min="5" max="300" value={f.duration_min} style={{ width: 80 }} onChange={(e) => setF({ ...f, duration_min: e.target.value })} /> min</label>
        <button className="primary">Créer</button>
        <p className="muted" style={{ width: '100%', margin: 0 }}>Trois parties sont créées : Lettura, Ascolto et Struttura (barème 25 + 25 + 22 = 72). Vous insérez ensuite les sujets, puis vous ouvrez l’examen aux étudiants.</p>
      </form>
      {err && <p className="error">{err}</p>}

      <h2>Examens</h2>
      {!exams.length && <p className="muted">Aucun examen pour le moment.</p>}
      {exams.map((x) => (
        <div key={x.id} className={`card exam-admin ${sel === x.id ? 'sel' : ''}`}>
          <div className="row between wrap">
            <div>
              <strong>{x.title}</strong> <span className={`badge ${XSTATUS[x.status][0]}`}>{XSTATUS[x.status][1]}</span> {x.results_published_at && <span className="badge done">résultats annoncés</span>}
              <p className="muted" style={{ margin: '.2rem 0 0' }}>{x.course} · {new Date(`${x.exam_date}T00:00:00`).toLocaleDateString('fr-FR')} · {x.duration_min} min · {x.question_count} question(s) · {x.submitted}/{x.enrolled} ont rendu</p>
            </div>
            <span className="row wrap">
              <button className="ghost" onClick={() => { setSel(x.id); setView('edit'); }}>Sujets</button>
              <button className="ghost" onClick={() => { setSel(x.id); setView('results'); }}>Résultats</button>
              {x.status !== 'open' ? <button className="primary" onClick={() => patch(x, { status: 'open' })}>Ouvrir l’examen</button> : <button className="ghost" onClick={() => patch(x, { status: 'closed' })}>Fermer l’examen</button>}
              <button className="ghost" onClick={() => del(x)}>✕</button>
            </span>
          </div>
        </div>
      ))}

      {cur && (
        <>
          <div className="row between wrap"><h2>{view === 'edit' ? 'Sujets' : 'Résultats'} · {cur.title}</h2>
            <div className="lvl-tabs"><button className={view === 'edit' ? 'on' : ''} onClick={() => setView('edit')}>Sujets</button><button className={view === 'results' ? 'on' : ''} onClick={() => setView('results')}>Résultats</button></div></div>
          {view === 'edit' ? <ExamEditor id={cur.id} onChanged={loadX} /> : <ExamResults id={cur.id} onChanged={loadX} />}
        </>
      )}
    </div>
  );
}
