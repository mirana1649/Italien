import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { q, pool } from '../db.js';
import { h } from '../utils.js';
import { auth } from '../middleware/auth.js';
import { SECTIONS, DEFAULT_MAX, gradeExam } from '../examlib.js';

const DATE = `to_char(x.exam_date,'YYYY-MM-DD')`;
const GRACE_MS = 60 * 1000; // marge de 60 s pour l'envoi après la fin du temps

/* =====================================================================
   CÔTÉ ÉTUDIANT : /api/student/exams
   ===================================================================== */
export const studentExams = Router();
studentExams.use(auth(['student']));

const myExam = async (id, uid) =>
  (await q(`SELECT x.*, ${DATE} AS date_str FROM exams x
            WHERE x.id=$1 AND x.course_id IN (SELECT course_id FROM enrollments WHERE user_id=$2 AND active)`, [id, uid])).rows[0];
const myAttempt = async (examId, uid) => (await q('SELECT * FROM exam_attempts WHERE exam_id=$1 AND user_id=$2', [examId, uid])).rows[0];
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

// Contenu de l'examen SANS les bonnes réponses
async function publicContent(examId) {
  const sections = (await q('SELECT kind, max_points, instructions, passage, audio_url FROM exam_sections WHERE exam_id=$1', [examId])).rows;
  const questions = (await q('SELECT id, section, type, prompt, options, answer FROM exam_questions WHERE exam_id=$1 ORDER BY position, id', [examId])).rows;
  return SECTIONS.map((kind) => {
    const s = sections.find((x) => x.kind === kind) || { kind, max_points: DEFAULT_MAX[kind] };
    return {
      kind, max_points: Number(s.max_points), instructions: s.instructions, passage: s.passage, audio_url: s.audio_url,
      questions: questions.filter((x) => x.section === kind).map((x) => {
        const out = { id: x.id, type: x.type, prompt: x.prompt, options: x.options };
        if (x.type === 'order') out.words = shuffle(String(x.answer).split(/\s+/));
        return out;
      }),
    };
  });
}

const stateOf = (x) => {
  if (x.published && x.submitted_at) return 'published';
  if (x.submitted_at) return 'submitted';
  if (x.status === 'draft') return 'upcoming';
  if (x.started_at) return x.status === 'open' ? 'in_progress' : 'missed';
  return x.status === 'open' ? 'open' : 'missed';
};

studentExams.get('/', h(async (req, res) => {
  const rows = (await q(
    `SELECT x.id, x.title, ${DATE} AS exam_date, x.status, x.duration_min, (x.results_published_at IS NOT NULL) AS published, x.results_published_at,
            (SELECT count(*) FROM exam_questions WHERE exam_id=x.id)::int AS question_count,
            a.started_at, a.submitted_at, a.total, a.max_total, a.scores
     FROM exams x LEFT JOIN exam_attempts a ON a.exam_id=x.id AND a.user_id=$1
     WHERE x.course_id IN (SELECT course_id FROM enrollments WHERE user_id=$1 AND active)
     ORDER BY x.exam_date DESC, x.id DESC`, [req.user.id])).rows;
  res.json(rows.map((x) => {
    const state = stateOf(x);
    const shown = state === 'published'; // la note n'apparaît qu'après l'annonce des résultats
    return {
      id: x.id, title: x.title, exam_date: x.exam_date, duration_min: x.duration_min, question_count: x.question_count, state,
      can_take: x.status === 'open' && x.question_count > 0 && ['open', 'in_progress'].includes(state),
      total: shown ? Number(x.total) : null, max_total: shown ? Number(x.max_total) : null, scores: shown ? x.scores : null, published_at: shown ? x.results_published_at : null,
    };
  }));
}));

// Démarrer (ou reprendre) l'examen : une seule tentative par étudiant, chronométrée côté serveur
studentExams.post('/:id/start', h(async (req, res) => {
  const exam = await myExam(req.params.id, req.user.id);
  if (!exam) return res.status(404).json({ error: 'Examen introuvable' });
  let att = await myAttempt(exam.id, req.user.id);
  if (att?.submitted_at) return res.status(409).json({ error: 'Vous avez déjà passé cet examen.' });
  if (!att) {
    if (exam.status !== 'open') return res.status(403).json({ error: 'Cet examen n’est pas ouvert pour le moment.' });
    const n = +(await q('SELECT count(*) n FROM exam_questions WHERE exam_id=$1', [exam.id])).rows[0].n;
    if (!n) return res.status(400).json({ error: 'Les sujets de cet examen ne sont pas encore prêts.' });
    att = (await q(`INSERT INTO exam_attempts (exam_id, user_id) VALUES ($1,$2)
                    ON CONFLICT (exam_id, user_id) DO UPDATE SET exam_id=EXCLUDED.exam_id RETURNING *`, [exam.id, req.user.id])).rows[0];
    if (att.submitted_at) return res.status(409).json({ error: 'Vous avez déjà passé cet examen.' });
  }
  const deadline = new Date(new Date(att.started_at).getTime() + exam.duration_min * 60 * 1000);
  res.json({
    exam: { id: exam.id, title: exam.title, duration_min: exam.duration_min },
    started_at: att.started_at, deadline: deadline.toISOString(), server_now: new Date().toISOString(),
    sections: await publicContent(exam.id),
  });
}));

// Remise des réponses : correction automatique, mais la note reste cachée jusqu'à l'annonce des résultats
studentExams.post('/:id/submit', h(async (req, res) => {
  const exam = await myExam(req.params.id, req.user.id);
  if (!exam) return res.status(404).json({ error: 'Examen introuvable' });
  const att = await myAttempt(exam.id, req.user.id);
  if (!att) return res.status(400).json({ error: 'Examen non démarré' });
  if (att.submitted_at) return res.status(409).json({ error: 'Examen déjà rendu' });
  const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  const sections = (await q('SELECT kind, max_points FROM exam_sections WHERE exam_id=$1', [exam.id])).rows;
  const questions = (await q('SELECT * FROM exam_questions WHERE exam_id=$1 ORDER BY position, id', [exam.id])).rows;
  const g = gradeExam(questions, sections, answers);
  const late = Date.now() > new Date(att.started_at).getTime() + exam.duration_min * 60 * 1000 + GRACE_MS;
  await q(`UPDATE exam_attempts SET submitted_at=now(), late=$2, answers=$3, scores=$4, total=$5, max_total=$6 WHERE id=$1`,
    [att.id, late, JSON.stringify(answers), JSON.stringify(g.scores), g.total, g.max_total]);
  res.json({ ok: true });
}));

// Résultat + correction détaillée (seulement après la publication par l'admin)
studentExams.get('/:id/result', h(async (req, res) => {
  const exam = await myExam(req.params.id, req.user.id);
  if (!exam) return res.status(404).json({ error: 'Examen introuvable' });
  const att = await myAttempt(exam.id, req.user.id);
  if (!exam.results_published_at || !att?.submitted_at) return res.status(403).json({ error: 'Les résultats ne sont pas encore annoncés.', published: false });
  const sections = (await q('SELECT kind, max_points, passage FROM exam_sections WHERE exam_id=$1', [exam.id])).rows;
  const questions = (await q('SELECT * FROM exam_questions WHERE exam_id=$1 ORDER BY position, id', [exam.id])).rows;
  const g = gradeExam(questions, sections, att.answers || {});
  const byId = Object.fromEntries(g.results.map((r) => [r.id, r]));
  res.json({
    exam: { id: exam.id, title: exam.title, exam_date: exam.date_str, published_at: exam.results_published_at },
    total: Number(att.total), max_total: Number(att.max_total), scores: att.scores, late: att.late,
    review: SECTIONS.map((kind) => ({
      kind, ...att.scores?.[kind],
      questions: questions.filter((x) => x.section === kind).map((x) => {
        const given = att.answers?.[x.id];
        const shownGiven = x.type === 'qcm' ? (given === undefined ? null : x.options?.[Number(given)]) : Array.isArray(given) ? given.join(' ') : given ?? null;
        return { id: x.id, prompt: x.prompt, correct: byId[x.id]?.correct, given: shownGiven, correctAnswer: byId[x.id]?.correctAnswer && String(byId[x.id].correctAnswer).split('|')[0], explanation: x.explanation };
      }),
    })),
  });
}));

/* =====================================================================
   CÔTÉ ADMIN : /api/admin/exams
   ===================================================================== */
export const adminExams = Router();
adminExams.use(auth(['admin']));

const audioUpload = multer({
  storage: multer.diskStorage({ destination: 'uploads', filename: (req, f, cb) => cb(null, 'examen-' + crypto.randomUUID() + (path.extname(f.originalname) || '.mp3')) }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, f, cb) => cb(/^audio\//.test(f.mimetype) || /\.(mp3|m4a|wav|ogg|aac|webm)$/i.test(f.originalname) ? null : new Error('Fichier audio requis (mp3, m4a, wav, ogg)'), true),
});

const LIST_SQL = `SELECT x.id, x.course_id, x.title, ${DATE} AS exam_date, x.status, x.duration_min, x.results_published_at, c.title course,
    (SELECT count(*) FROM exam_questions WHERE exam_id=x.id)::int question_count,
    (SELECT count(*) FROM exam_attempts WHERE exam_id=x.id)::int attempts,
    (SELECT count(*) FROM exam_attempts WHERE exam_id=x.id AND submitted_at IS NOT NULL)::int submitted,
    (SELECT count(*) FROM enrollments e WHERE e.course_id=x.course_id AND e.active)::int enrolled,
    (SELECT COALESCE(sum(max_points),0) FROM exam_sections WHERE exam_id=x.id)::float AS max_total
  FROM exams x JOIN courses c ON c.id=x.course_id`;

adminExams.get('/', h(async (req, res) => {
  res.json((await q(`${LIST_SQL} ORDER BY x.exam_date DESC, x.id DESC`)).rows);
}));

adminExams.post('/', h(async (req, res) => {
  const { course_id, title, exam_date, duration_min } = req.body || {};
  if (!course_id || !title?.trim() || !exam_date) return res.status(400).json({ error: 'Cours, titre et date requis' });
  const dur = Number(duration_min || 60);
  if (!(dur >= 5 && dur <= 300)) return res.status(400).json({ error: 'Durée entre 5 et 300 minutes' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE courses SET exam_date=$1 WHERE id=$2', [exam_date, course_id]);
    const ex = (await client.query('INSERT INTO exams (course_id,title,exam_date,duration_min) VALUES ($1,$2,$3,$4) RETURNING id', [course_id, title.trim(), exam_date, dur])).rows[0];
    for (const kind of SECTIONS) await client.query('INSERT INTO exam_sections (exam_id, kind, max_points) VALUES ($1,$2,$3)', [ex.id, kind, DEFAULT_MAX[kind]]);
    await client.query('COMMIT');
    res.status(201).json((await q(`${LIST_SQL} WHERE x.id=$1`, [ex.id])).rows[0]);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));

adminExams.patch('/:id', h(async (req, res) => {
  const { title, exam_date, status, duration_min } = req.body || {};
  if (status && !['draft', 'open', 'closed'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  if (duration_min !== undefined && !(Number(duration_min) >= 5 && Number(duration_min) <= 300)) return res.status(400).json({ error: 'Durée entre 5 et 300 minutes' });
  if (status === 'open') {
    const n = +(await q('SELECT count(*) n FROM exam_questions WHERE exam_id=$1', [req.params.id])).rows[0].n;
    if (!n) return res.status(400).json({ error: 'Ajoutez d’abord des questions avant d’ouvrir l’examen.' });
  }
  const { rowCount } = await q(`UPDATE exams SET title=COALESCE($1,title), exam_date=COALESCE($2,exam_date), status=COALESCE($3,status), duration_min=COALESCE($4,duration_min) WHERE id=$5`,
    [title?.trim() || null, exam_date || null, status || null, duration_min ? Number(duration_min) : null, req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Examen introuvable' });
  res.json((await q(`${LIST_SQL} WHERE x.id=$1`, [req.params.id])).rows[0]);
}));

adminExams.delete('/:id', h(async (req, res) => { await q('DELETE FROM exams WHERE id=$1', [req.params.id]); res.json({ ok: true }); }));

// Contenu complet (avec bonnes réponses) pour l'éditeur de sujets
adminExams.get('/:id', h(async (req, res) => {
  const exam = (await q(`${LIST_SQL} WHERE x.id=$1`, [req.params.id])).rows[0];
  if (!exam) return res.status(404).json({ error: 'Examen introuvable' });
  const sections = (await q('SELECT kind, max_points, instructions, passage, audio_url FROM exam_sections WHERE exam_id=$1', [exam.id])).rows;
  const questions = (await q('SELECT * FROM exam_questions WHERE exam_id=$1 ORDER BY position, id', [exam.id])).rows;
  res.json({
    exam,
    sections: SECTIONS.map((kind) => {
      const s = sections.find((x) => x.kind === kind) || { kind, max_points: DEFAULT_MAX[kind] };
      return { ...s, max_points: Number(s.max_points), questions: questions.filter((x) => x.section === kind) };
    }),
  });
}));

const sectionKind = (req, res, next) => (SECTIONS.includes(req.params.kind) ? next() : res.status(400).json({ error: 'Partie inconnue (lettura, ascolto, struttura)' }));

adminExams.patch('/:id/sections/:kind', sectionKind, h(async (req, res) => {
  const { max_points, instructions, passage, audio_url } = req.body || {};
  if (max_points !== undefined && !(Number(max_points) >= 0 && Number(max_points) <= 72)) return res.status(400).json({ error: 'Barème entre 0 et 72' });
  const has = (k) => Object.prototype.hasOwnProperty.call(req.body || {}, k);
  await q(`INSERT INTO exam_sections (exam_id, kind, max_points) VALUES ($1,$2,$3) ON CONFLICT (exam_id, kind) DO NOTHING`, [req.params.id, req.params.kind, DEFAULT_MAX[req.params.kind]]);
  const row = (await q(`UPDATE exam_sections SET max_points=COALESCE($3,max_points),
      instructions=CASE WHEN $4 THEN $5 ELSE instructions END, passage=CASE WHEN $6 THEN $7 ELSE passage END, audio_url=CASE WHEN $8 THEN $9 ELSE audio_url END
    WHERE exam_id=$1 AND kind=$2 RETURNING kind, max_points, instructions, passage, audio_url`,
    [req.params.id, req.params.kind, max_points ?? null, has('instructions'), instructions?.trim() || null, has('passage'), passage?.trim() || null, has('audio_url'), audio_url?.trim() || null])).rows[0];
  res.json(row);
}));

// Audio de la partie Ascolto (fichier envoyé par l'admin)
adminExams.post('/:id/sections/:kind/audio', sectionKind,
  (req, res, next) => audioUpload.single('audio')(req, res, (err) => (err ? res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Audio trop lourd (25 Mo maximum)' : err.message }) : next())),
  h(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier audio reçu' });
    const url = `/uploads/${req.file.filename}`;
    await q(`INSERT INTO exam_sections (exam_id, kind, max_points) VALUES ($1,$2,$3) ON CONFLICT (exam_id, kind) DO NOTHING`, [req.params.id, req.params.kind, DEFAULT_MAX[req.params.kind]]);
    await q('UPDATE exam_sections SET audio_url=$3 WHERE exam_id=$1 AND kind=$2', [req.params.id, req.params.kind, url]);
    res.status(201).json({ audio_url: url });
  }));

adminExams.post('/:id/questions', h(async (req, res) => {
  const { section, type, prompt, options, answer, explanation } = req.body || {};
  if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'Partie invalide' });
  if (!['qcm', 'gap', 'order'].includes(type)) return res.status(400).json({ error: 'Type de question invalide' });
  if (!prompt?.trim()) return res.status(400).json({ error: 'Énoncé requis' });
  if (type === 'qcm') {
    if (!Array.isArray(options) || options.length < 2) return res.status(400).json({ error: 'Un QCM demande au moins 2 options' });
    if (!Number.isInteger(Number(answer)) || Number(answer) < 0 || Number(answer) >= options.length) return res.status(400).json({ error: 'Numéro de bonne option invalide' });
  } else if (!String(answer ?? '').trim()) return res.status(400).json({ error: 'Réponse attendue requise' });
  if (!(await q('SELECT 1 FROM exams WHERE id=$1', [req.params.id])).rowCount) return res.status(404).json({ error: 'Examen introuvable' });
  const pos = (await q('SELECT COALESCE(max(position),0)+1 p FROM exam_questions WHERE exam_id=$1 AND section=$2', [req.params.id, section])).rows[0].p;
  res.status(201).json((await q(
    `INSERT INTO exam_questions (exam_id, section, type, prompt, options, answer, explanation, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.params.id, section, type, prompt.trim(), type === 'qcm' ? JSON.stringify(options) : null, JSON.stringify(type === 'qcm' ? Number(answer) : String(answer).trim()), explanation?.trim() || null, pos])).rows[0]);
}));

adminExams.delete('/questions/:qid', h(async (req, res) => { await q('DELETE FROM exam_questions WHERE id=$1', [req.params.qid]); res.json({ ok: true }); }));

// Qui a passé l'examen, avec les notes de chaque partie et le total
adminExams.get('/:id/attempts', h(async (req, res) => {
  const exam = (await q(`${LIST_SQL} WHERE x.id=$1`, [req.params.id])).rows[0];
  if (!exam) return res.status(404).json({ error: 'Examen introuvable' });
  const rows = (await q(
    `SELECT u.id user_id, u.name, a.started_at, a.submitted_at, a.late, a.scores, a.total, a.max_total
     FROM enrollments e JOIN users u ON u.id=e.user_id LEFT JOIN exam_attempts a ON a.exam_id=$1 AND a.user_id=u.id
     WHERE e.course_id=$2 AND e.active ORDER BY u.name`, [exam.id, exam.course_id])).rows;
  res.json({ exam, students: rows.map((r) => ({ ...r, total: r.total === null ? null : Number(r.total), max_total: r.max_total === null ? null : Number(r.max_total),
    status: r.submitted_at ? 'rendu' : r.started_at ? 'en cours' : 'pas commencé' })) });
}));

// Permet à un étudiant de repasser l'examen (ex. coupure de connexion)
adminExams.delete('/:id/attempts/:userId', h(async (req, res) => {
  await q('DELETE FROM exam_attempts WHERE exam_id=$1 AND user_id=$2', [req.params.id, req.params.userId]); res.json({ ok: true });
}));

// Annonce (ou retrait) des résultats : visibles côté étudiant dès la publication
adminExams.post('/:id/publish', h(async (req, res) => {
  const exam = (await q('SELECT * FROM exams WHERE id=$1', [req.params.id])).rows[0];
  if (!exam) return res.status(404).json({ error: 'Examen introuvable' });
  if (req.body?.publish === false) {
    await q('UPDATE exams SET results_published_at=NULL WHERE id=$1', [exam.id]);
  } else {
    const n = +(await q('SELECT count(*) n FROM exam_attempts WHERE exam_id=$1 AND submitted_at IS NOT NULL', [exam.id])).rows[0].n;
    if (!n) return res.status(400).json({ error: 'Aucun étudiant n’a encore rendu cet examen.' });
    await q(`UPDATE exams SET results_published_at=now(), status='closed' WHERE id=$1`, [exam.id]);
    const title = `Résultats : ${exam.title}`;
    if (!(await q('SELECT 1 FROM announcements WHERE title=$1 AND course_id=$2', [title, exam.course_id])).rowCount)
      await q('INSERT INTO announcements (title, body, course_id) VALUES ($1,$2,$3)',
        [title, 'Les résultats de l’examen sont disponibles dans la rubrique « Examen ». Ta note est sur 72.', exam.course_id]);
  }
  res.json((await q(`${LIST_SQL} WHERE x.id=$1`, [exam.id])).rows[0]);
}));
