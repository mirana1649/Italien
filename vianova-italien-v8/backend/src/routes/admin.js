import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import crypto from 'crypto';
import { pool, q } from '../db.js';
import { h, LEVELS, tempPassword, MAX } from '../utils.js';
import { auth } from '../middleware/auth.js';
import { sendMail, admissionEmail } from '../mailer.js';

const r = Router();
r.use(auth(['admin']));
const FEES = ['unpaid', 'partial', 'paid'];

// Leçons PDF (15 Mo max) : stockées dans le dossier local « uploads »
const pdfUpload = multer({
  storage: multer.diskStorage({ destination: 'uploads', filename: (req, f, cb) => cb(null, 'lecon-' + crypto.randomUUID() + '.pdf') }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, f, cb) => cb(f.mimetype === 'application/pdf' || /\.pdf$/i.test(f.originalname) ? null : new Error('Seuls les fichiers PDF sont acceptés'), true),
});
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const COURSE_COLS = `*, to_char(start_date,'YYYY-MM-DD') starts_on, to_char(start_time,'HH24:MI') start_hhmm`;

// ---------- Utilisateurs ----------
r.get('/users', h(async (req, res) => {
  const { role } = req.query;
  const { rows } = await q(
    `SELECT id, name, email, role, level, city, phone, fee_status, active, last_login, created_at FROM users
     WHERE ($1::text IS NULL OR role::text=$1) ORDER BY created_at DESC`, [role || null]);
  res.json(rows);
}));

// Création d'un compte (professeur, étudiant, admin) avec mot de passe temporaire
r.post('/users', h(async (req, res) => {
  const { name, email, role, level, city, phone, fee_status } = req.body || {};
  if (fee_status && !FEES.includes(fee_status)) return res.status(400).json({ error: 'Statut écolage invalide' });
  if (!name?.trim() || !email?.includes('@')) return res.status(400).json({ error: 'Nom et email valides requis' });
  if (!['student', 'teacher', 'admin'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  if (level && !LEVELS.includes(level)) return res.status(400).json({ error: 'Niveau invalide' });
  if ((await q('SELECT 1 FROM users WHERE email=$1', [email.toLowerCase()])).rowCount)
    return res.status(409).json({ error: 'Email déjà utilisé' });
  const temp = tempPassword();
  const { rows } = await q(
    `INSERT INTO users (name,email,password_hash,role,level,city,phone,fee_status,must_change_password) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
     RETURNING id,name,email,role,level`, [name.trim(), email.toLowerCase(), await bcrypt.hash(temp, 10), role, level || null, city?.trim() || null, phone?.trim() || null, fee_status || 'unpaid']);
  res.status(201).json({ user: rows[0], temporaryPassword: temp }); // affiché une seule fois
}));

r.patch('/users/:id', h(async (req, res) => {
  const { name, level, active, city, phone, fee_status } = req.body || {};
  if (level && !LEVELS.includes(level)) return res.status(400).json({ error: 'Niveau invalide' });
  if (fee_status && !FEES.includes(fee_status)) return res.status(400).json({ error: 'Statut écolage invalide' });
  const { rows } = await q(
    `UPDATE users SET name=COALESCE($1,name), level=COALESCE($2::cefr_level,level), active=COALESCE($3,active),
       city=COALESCE($5,city), phone=COALESCE($6,phone), fee_status=COALESCE($7,fee_status)
     WHERE id=$4 RETURNING id,name,email,role,level,active,city,phone,fee_status`,
    [name ?? null, level ?? null, active ?? null, req.params.id, city ?? null, phone ?? null, fee_status ?? null]);
  if (!rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(rows[0]);
}));

r.post('/users/:id/reset-password', h(async (req, res) => {
  const temp = tempPassword();
  await q('UPDATE users SET password_hash=$1, must_change_password=true WHERE id=$2', [await bcrypt.hash(temp, 10), req.params.id]);
  res.json({ temporaryPassword: temp });
}));

// ---------- Cours ----------
r.get('/courses', h(async (req, res) => {
  res.json((await q(`SELECT c.*, to_char(c.start_date,'YYYY-MM-DD') starts_on, to_char(c.start_time,'HH24:MI') start_hhmm,
    (SELECT count(*) FROM enrollments e WHERE e.course_id=c.id) students FROM courses c ORDER BY c.id DESC`)).rows);
}));
// Planning : date du premier cours, heure et rythme (ils figurent dans l'e-mail d'admission)
const planning = (b) => ({ start_date: b.start_date || null, start_time: b.start_time || null, schedule: b.schedule?.trim() || null });
const planningError = (b) => (b.start_time && !TIME_RE.test(b.start_time) ? 'Heure invalide (format 14:30)' : null);
r.post('/courses', h(async (req, res) => {
  const { title, level, total_sessions } = req.body || {};
  if (!title?.trim() || !LEVELS.includes(level)) return res.status(400).json({ error: 'Titre et niveau (A1–C2) requis' });
  if (planningError(req.body)) return res.status(400).json({ error: planningError(req.body) });
  const p = planning(req.body);
  res.status(201).json((await q(`INSERT INTO courses (title,level,total_sessions,exam_date,start_date,start_time,schedule) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${COURSE_COLS}`,
    [title.trim(), level, total_sessions || 20, req.body.exam_date || null, p.start_date, p.start_time, p.schedule])).rows[0]);
}));
r.patch('/courses/:id', h(async (req, res) => {
  const { title, level, total_sessions, exam_date } = req.body || {};
  if (planningError(req.body)) return res.status(400).json({ error: planningError(req.body) });
  const b = req.body || {}; const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const p = planning(b);
  res.json((await q(`UPDATE courses SET title=COALESCE($1,title), level=COALESCE($2::cefr_level,level),
    total_sessions=COALESCE($3,total_sessions), exam_date=COALESCE($4,exam_date),
    start_date=CASE WHEN $6 THEN $7::date ELSE start_date END,
    start_time=CASE WHEN $6 THEN $8::time ELSE start_time END,
    schedule=CASE WHEN $6 THEN $9 ELSE schedule END
    WHERE id=$5 RETURNING ${COURSE_COLS}`,
    [title ?? null, level ?? null, total_sessions ?? null, exam_date ?? null, req.params.id, has('start_date') || has('start_time') || has('schedule'), p.start_date, p.start_time, p.schedule])).rows[0]);
}));
r.delete('/courses/:id', h(async (req, res) => { await q('DELETE FROM courses WHERE id=$1', [req.params.id]); res.json({ ok: true }); }));

// ---------- Leçons & ressources ----------
r.get('/courses/:id/lessons', h(async (req, res) => {
  const lessons = (await q('SELECT * FROM lessons WHERE course_id=$1 ORDER BY position, id', [req.params.id])).rows;
  for (const l of lessons) {
    l.resources = (await q('SELECT * FROM lesson_resources WHERE lesson_id=$1 ORDER BY id', [l.id])).rows;
    l.vocab = (await q('SELECT * FROM vocab_items WHERE lesson_id=$1 ORDER BY position, id', [l.id])).rows;
    l.exercises = (await q(`SELECT e.*, (SELECT count(*) FROM questions WHERE exercise_id=e.id) question_count FROM exercises e WHERE lesson_id=$1 ORDER BY id`, [l.id])).rows;
  }
  res.json(lessons);
}));
r.post('/courses/:id/lessons', h(async (req, res) => {
  const { title, position, status, publish_at, video_url, written } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'Titre requis' });
  const pos = position ?? ((await q('SELECT COALESCE(max(position),0)+1 p FROM lessons WHERE course_id=$1', [req.params.id])).rows[0].p);
  const lesson = (await q('INSERT INTO lessons (course_id,title,position,status,publish_at) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [req.params.id, title.trim(), pos, status || 'draft', publish_at || null])).rows[0];
  // La vidéo et le texte de la leçon se saisissent directement à la création
  if (video_url?.trim()) await q(`INSERT INTO lesson_resources (lesson_id,type,url) VALUES ($1,'video',$2)`, [lesson.id, video_url.trim()]);
  if (written?.trim()) await q(`INSERT INTO lesson_resources (lesson_id,type,content) VALUES ($1,'written',$2)`, [lesson.id, written.trim()]);
  res.status(201).json(lesson);
}));
r.patch('/lessons/:id', h(async (req, res) => {
  const { title, position, status, publish_at } = req.body || {};
  res.json((await q(`UPDATE lessons SET title=COALESCE($1,title), position=COALESCE($2,position),
    status=COALESCE($3,status), publish_at=COALESCE($4,publish_at) WHERE id=$5 RETURNING *`,
    [title ?? null, position ?? null, status ?? null, publish_at ?? null, req.params.id])).rows[0]);
}));
r.delete('/lessons/:id', h(async (req, res) => { await q('DELETE FROM lessons WHERE id=$1', [req.params.id]); res.json({ ok: true }); }));

r.post('/lessons/:id/resources', h(async (req, res) => {
  const { type, url, content } = req.body || {};
  if (!['video', 'written', 'audio', 'reading'].includes(type)) return res.status(400).json({ error: 'Type invalide' });
  res.status(201).json((await q('INSERT INTO lesson_resources (lesson_id,type,url,content) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.params.id, type, url || null, content || null])).rows[0]);
}));
// Leçon en PDF : l'admin envoie le fichier, l'étudiant le lit dans sa séance
r.post('/lessons/:id/pdf', (req, res, next) => pdfUpload.single('pdf')(req, res, (err) => (err ? res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'PDF trop lourd (15 Mo maximum)' : err.message }) : next())),
  h(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier PDF reçu' });
    if (!(await q('SELECT 1 FROM lessons WHERE id=$1', [req.params.id])).rowCount) return res.status(404).json({ error: 'Leçon introuvable' });
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json((await q(`INSERT INTO lesson_resources (lesson_id,type,url,file_name) VALUES ($1,'pdf',$2,$3) RETURNING *`,
      [req.params.id, url, req.file.originalname])).rows[0]);
  }));
r.delete('/resources/:id', h(async (req, res) => { await q('DELETE FROM lesson_resources WHERE id=$1', [req.params.id]); res.json({ ok: true }); }));

// ---------- Exercices ----------
r.post('/lessons/:id/exercises', h(async (req, res) => {
  const { title, kind, available_from, questions = [] } = req.body || {};
  if (!title?.trim() || !['exercise', 'listening', 'reading'].includes(kind || 'exercise')) return res.status(400).json({ error: 'Titre et type requis' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ex = (await client.query('INSERT INTO exercises (lesson_id,title,kind,available_from) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.id, title.trim(), kind || 'exercise', available_from || null])).rows[0];
    let pos = 1;
    for (const x of questions) {
      await client.query(
        'INSERT INTO questions (exercise_id,type,prompt,options,answer,explanation,position) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [ex.id, x.type, x.prompt, x.options ? JSON.stringify(x.options) : null, JSON.stringify(x.answer), x.explanation || null, pos++]);
    }
    await client.query('COMMIT');
    res.status(201).json(ex);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));
r.delete('/exercises/:id', h(async (req, res) => { await q('DELETE FROM exercises WHERE id=$1', [req.params.id]); res.json({ ok: true }); }));

// ---------- Inscriptions ----------
r.get('/enrollments', h(async (req, res) => {
  res.json((await q(`SELECT e.id, e.sessions_remaining, e.admission_email_at, u.name student, u.email, u.level, c.title course, t.name teacher
    FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id
    LEFT JOIN users t ON t.id=e.teacher_id ORDER BY e.id DESC`)).rows);
}));
// Envoie (ou renvoie) l'e-mail de confirmation d'admission : cours, professeur, date et heure
async function sendAdmission(enrollmentId) {
  const row = (await q(`SELECT u.name student_name, u.email, t.name teacher_name,
      c.title, c.level, c.total_sessions, c.schedule, to_char(c.start_date,'YYYY-MM-DD') starts_on, to_char(c.start_time,'HH24:MI') start_time
    FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id LEFT JOIN users t ON t.id=e.teacher_id
    WHERE e.id=$1`, [enrollmentId])).rows[0];
  if (!row) return { sent: false, reason: 'introuvable' };
  const mail = admissionEmail({ student: { name: row.student_name }, teacher: row.teacher_name, course: row });
  const r = await sendMail({ to: row.email, ...mail });
  if (r.sent) await q('UPDATE enrollments SET admission_email_at=now() WHERE id=$1', [enrollmentId]);
  return { ...r, to: row.email };
}
r.post('/enrollments', h(async (req, res) => {
  const { user_id, course_id, teacher_id } = req.body || {};
  const c = (await q('SELECT total_sessions FROM courses WHERE id=$1', [course_id])).rows[0];
  if (!c) return res.status(404).json({ error: 'Cours introuvable' });
  const stu = (await q(`SELECT 1 FROM users WHERE id=$1 AND role='student'`, [user_id])).rowCount;
  if (!stu) return res.status(404).json({ error: 'Étudiant introuvable' });
  const { rows } = await q(
    `INSERT INTO enrollments (user_id,course_id,teacher_id,sessions_remaining) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id,course_id) DO UPDATE SET teacher_id=EXCLUDED.teacher_id, active=true RETURNING *`,
    [user_id, course_id, teacher_id || null, c.total_sessions]);
  const email = await sendAdmission(rows[0].id); // jamais bloquant : l'inscription reste valable même si l'e-mail échoue
  res.status(201).json({ ...rows[0], email });
}));
r.post('/enrollments/:id/resend-email', h(async (req, res) => {
  const email = await sendAdmission(req.params.id);
  res.json({ email });
}));

// ---------- Examens ----------
// La création, l'édition des sujets, l'ouverture et la publication des examens sont dans routes/exams.js.
// Saisie manuelle d'une note (examen sur papier) : sur 72.
r.post('/exams/:id/results', h(async (req, res) => {
  const { user_id, score } = req.body || {};
  if (!(Number(score) >= 0 && Number(score) <= MAX.total)) return res.status(400).json({ error: `Note entre 0 et ${MAX.total}` });
  res.json((await q(`INSERT INTO exam_results (exam_id,user_id,score) VALUES ($1,$2,$3)
    ON CONFLICT (exam_id,user_id) DO UPDATE SET score=EXCLUDED.score RETURNING *`, [req.params.id, user_id, score])).rows[0]);
}));

// ---------- Tableau des étudiants (infos complètes) ----------
r.get('/students', h(async (req, res) => {
  const total = +(await q('SELECT count(*) n FROM agency_steps WHERE published')).rows[0].n;
  const rows = (await q(
    `SELECT u.id, u.name, u.email, u.phone, u.city, u.level, u.fee_status, u.active, u.last_login, u.created_at, u.agency_joined,
       (SELECT c.title FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=u.id AND e.active ORDER BY e.id DESC LIMIT 1) course,
       (SELECT count(*) FROM checkins ck WHERE ck.user_id=u.id) presences,
       (SELECT count(*) FROM agency_progress p JOIN agency_steps s ON s.id=p.step_id WHERE p.user_id=u.id AND p.done AND s.published) agency_done
     FROM users u WHERE u.role='student' ORDER BY u.name`)).rows;
  res.json({ agency_total: total, students: rows.map((x) => ({ ...x, presences: +x.presences, agency_done: +x.agency_done })) });
}));

// ---------- Suivi ----------
const TRACK_SQL = `
  SELECT u.id, u.name, u.email, u.level, c.title course, e.sessions_remaining, c.total_sessions, u.last_login,
    (SELECT count(*) FROM sessions s WHERE s.enrollment_id=e.id AND s.validated_at IS NOT NULL) sessions_done,
    (SELECT count(*) FROM checkins ck WHERE ck.user_id=u.id) attendance,
    (SELECT round(avg(score),1) FROM submissions s JOIN sessions se ON se.id=s.session_id WHERE se.enrollment_id=e.id AND s.kind='exercise') exercise_avg,
    (SELECT round(avg(score),1) FROM submissions s JOIN sessions se ON se.id=s.session_id WHERE se.enrollment_id=e.id AND s.kind='listening') listening_avg,
    (SELECT round(avg(o.score),1) FROM oral_submissions o JOIN sessions se ON se.id=o.session_id WHERE se.enrollment_id=e.id) oral_avg
  FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id WHERE e.active ORDER BY u.name`;

r.get('/tracking', h(async (req, res) => {
  const rows = (await q(TRACK_SQL)).rows.map((s) => {
    // Total /72 = moyenne exercice /25 + moyenne écoute /25 + moyenne oral /22 (parties déjà notées)
    const parts = [['exercise_avg', MAX.exercise], ['listening_avg', MAX.listening], ['oral_avg', MAX.oral]].filter(([k]) => s[k] !== null);
    const got = parts.reduce((a, [k]) => a + Number(s[k]), 0), possible = parts.reduce((a, [, m]) => a + m, 0);
    const inactive = !s.last_login || Date.now() - new Date(s.last_login).getTime() > 7 * 864e5;
    return {
      ...s, total: parts.length === 3 ? Math.round(got * 10) / 10 : null, average: possible ? Math.round((got / possible) * 1000) / 10 : null, // average = pourcentage
      alert: inactive ? 'inactif' : possible && got / possible < 0.5 ? 'en difficulté' : null,
    };
  });
  res.json(rows);
}));

r.get('/tracking/:userId/history', h(async (req, res) => {
  res.json((await q(
    `SELECT to_char(d,'DD/MM') date, kind, score FROM (
       SELECT s.created_at d, s.kind, s.score FROM submissions s JOIN sessions se ON se.id=s.session_id
         JOIN enrollments e ON e.id=se.enrollment_id WHERE e.user_id=$1
       UNION ALL
       SELECT o.graded_at, 'oral', o.score FROM oral_submissions o JOIN sessions se ON se.id=o.session_id
         JOIN enrollments e ON e.id=se.enrollment_id WHERE e.user_id=$1 AND o.score IS NOT NULL) x ORDER BY d`, [req.params.userId])).rows);
}));

// Export CSV (s'ouvre directement dans Excel)
r.get('/export/results.csv', h(async (req, res) => {
  const rows = (await q(TRACK_SQL)).rows;
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Nom', 'Email', 'Niveau', 'Cours', 'Séances terminées', 'Séances restantes', 'Présences', 'Moy. exercices /25', 'Moy. écoute /25', 'Moy. oral /22', 'Total /72', 'Dernière connexion'];
  const lines = rows.map((s) => {
    const all = [s.exercise_avg, s.listening_avg, s.oral_avg].every((v) => v !== null);
    const total = all ? Math.round((Number(s.exercise_avg) + Number(s.listening_avg) + Number(s.oral_avg)) * 10) / 10 : '';
    return [s.name, s.email, s.level, s.course, s.sessions_done, s.sessions_remaining, s.attendance, s.exercise_avg, s.listening_avg, s.oral_avg, total, s.last_login?.toISOString?.() ?? ''].map(esc).join(';');
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="resultats.csv"');
  res.send('\uFEFF' + [head.map(esc).join(';'), ...lines].join('\n'));
}));

// ---------- Annonces ----------
r.get('/announcements', h(async (req, res) => { res.json((await q('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50')).rows); }));
r.post('/announcements', h(async (req, res) => {
  const { title, body, course_id } = req.body || {};
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: 'Titre et message requis' });
  res.status(201).json((await q('INSERT INTO announcements (title,body,course_id) VALUES ($1,$2,$3) RETURNING *', [title, body, course_id || null])).rows[0]);
}));

// ---------- Vocabulaire ----------
r.post('/lessons/:id/vocab', h(async (req, res) => {
  const items = (req.body?.items || []).filter((x) => x.it?.trim() && x.fr?.trim());
  if (!items.length) return res.status(400).json({ error: 'Aucun mot valide (format : italien = français)' });
  let pos = (await q('SELECT COALESCE(max(position),0) p FROM vocab_items WHERE lesson_id=$1', [req.params.id])).rows[0].p;
  for (const x of items) await q('INSERT INTO vocab_items (lesson_id,it,fr,en,example,position) VALUES ($1,$2,$3,$4,$5,$6)',
    [req.params.id, x.it.trim(), x.fr.trim(), x.en?.trim() || null, x.example?.trim() || null, ++pos]);
  res.status(201).json({ added: items.length });
}));
r.delete('/vocab/:id', h(async (req, res) => { await q('DELETE FROM vocab_items WHERE id=$1', [req.params.id]); res.json({ ok: true }); }));

// ---------- Chiffres clés ----------
r.get('/stats', h(async (req, res) => {
  const n = async (sql) => +(await q(sql)).rows[0].n;
  res.json({
    students: await n(`SELECT count(*) n FROM users WHERE role='student' AND active`),
    teachers: await n(`SELECT count(*) n FROM users WHERE role='teacher' AND active`),
    courses: await n(`SELECT count(*) n FROM courses`),
    pending_orals: await n(`SELECT count(*) n FROM oral_submissions WHERE score IS NULL`),
    validated_week: await n(`SELECT count(*) n FROM sessions WHERE validated_at > now() - interval '7 days'`),
    active_week: await n(`SELECT count(*) n FROM users WHERE role='student' AND last_login > now() - interval '7 days'`),
  });
}));

export default r;
