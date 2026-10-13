import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { pool, q } from '../db.js';
import { h, norm, MAX } from '../utils.js';
import { auth } from '../middleware/auth.js';
import { touchStreak, addXp, award, checkSessionBadges, wordOfTheDay } from '../gamification.js';
import { latestExamResult } from '../examlib.js';

const r = Router();
r.use(auth(['student']));

const upload = multer({
  // Audio enregistré sur le disque local (dossier « uploads »)
  storage: multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + (path.extname(file.originalname) || '.webm')),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const PUBLISHED = `l.status='published' AND (l.publish_at IS NULL OR l.publish_at<=now())`;

const mySession = async (sid, uid) =>
  (await q(`SELECT s.* FROM sessions s JOIN enrollments e ON e.id=s.enrollment_id WHERE s.id=$1 AND e.user_id=$2`, [sid, uid])).rows[0];

const meInfo = async (uid) => {
  const u = (await q(`SELECT xp, CASE WHEN last_activity >= (now() AT TIME ZONE 'Indian/Antananarivo')::date - 1 THEN streak ELSE 0 END AS streak FROM users WHERE id=$1`, [uid])).rows[0];
  const badges = (await q('SELECT code FROM user_badges WHERE user_id=$1', [uid])).rows.map((b) => b.code);
  return { xp: u.xp, streak: u.streak, badges };
};
const TODAY = `(now() AT TIME ZONE 'Indian/Antananarivo')::date`;
const checkinInfo = async (uid) => {
  const days = (await q(`SELECT to_char(day,'YYYY-MM-DD') d FROM checkins WHERE user_id=$1 AND day > ${TODAY} - 14`, [uid])).rows.map((x) => x.d);
  const today = (await q(`SELECT to_char(${TODAY},'YYYY-MM-DD') d`)).rows[0].d;
  const total = +(await q('SELECT count(*) n FROM checkins WHERE user_id=$1', [uid])).rows[0].n;
  return { today, checkedToday: days.includes(today), days, total };
};
r.post('/checkin', h(async (req, res) => {
  await q(`INSERT INTO checkins (user_id, day) VALUES ($1, ${TODAY}) ON CONFLICT DO NOTHING`, [req.user.id]);
  await touchStreak(pool, req.user.id);
  res.json(await checkinInfo(req.user.id));
}));
r.get('/stats', h(async (req, res) => res.json(await meInfo(req.user.id))));

// ---------- Tableau de bord ----------
r.get('/dashboard', h(async (req, res) => {
  const uid = req.user.id;
  const en = (await q(
    `SELECT e.id enrollment_id, e.sessions_remaining, c.id course_id, c.title, c.level, c.total_sessions, to_char(c.exam_date,'YYYY-MM-DD') AS exam_date,
            t.name teacher_name
     FROM enrollments e JOIN courses c ON c.id=e.course_id LEFT JOIN users t ON t.id=e.teacher_id
     WHERE e.user_id=$1 AND e.active ORDER BY e.id DESC LIMIT 1`, [uid])).rows[0];
  if (!en) return res.json({ enrollment: null });

  const lesson = (await q(
    `SELECT l.id, l.title FROM lessons l WHERE l.course_id=$1 AND ${PUBLISHED}
     AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.enrollment_id=$2 AND s.lesson_id=l.id AND s.validated_at IS NOT NULL)
     ORDER BY l.position, l.id LIMIT 1`, [en.course_id, en.enrollment_id])).rows[0];

  let session = null, steps = [];
  if (lesson) {
    session = (await q(
      `INSERT INTO sessions (enrollment_id, lesson_id) VALUES ($1,$2)
       ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET enrollment_id=EXCLUDED.enrollment_id RETURNING *`,
      [en.enrollment_id, lesson.id])).rows[0];
    const flags = [['lesson', 'Leçon', session.lesson_viewed], ['listening', 'Écoute', session.listening_done],
                   ['exercise', 'Exercice', session.exercise_done], ['oral', 'Oral', session.oral_done]];
    let current = false;
    steps = flags.map(([key, label, done]) => {
      let status = 'terminé';
      if (!done) { status = current ? 'à faire' : 'en cours'; current = true; }
      return { key, label, status };
    });
  }

  const sc = async (kind) => (await q(
    `SELECT s.score FROM submissions s JOIN sessions se ON se.id=s.session_id WHERE se.enrollment_id=$1 AND s.kind=$2
     ORDER BY s.created_at DESC LIMIT 1`, [en.enrollment_id, kind])).rows[0]?.score ?? null;
  const oral = (await q(
    `SELECT o.score, o.comment FROM oral_submissions o JOIN sessions se ON se.id=o.session_id
     WHERE se.enrollment_id=$1 ORDER BY o.created_at DESC LIMIT 1`, [en.enrollment_id])).rows[0];

  const history = (await q(
    `SELECT to_char(d,'DD/MM') date, kind, score FROM (
       SELECT s.created_at d, s.kind, s.score FROM submissions s JOIN sessions se ON se.id=s.session_id WHERE se.enrollment_id=$1
       UNION ALL
       SELECT o.graded_at, 'oral', o.score FROM oral_submissions o JOIN sessions se ON se.id=o.session_id
       WHERE se.enrollment_id=$1 AND o.score IS NOT NULL) x ORDER BY d`, [en.enrollment_id])).rows;

  // Examen à afficher : celui qui est ouvert, sinon le prochain, sinon le dernier avec une note. Note visible seulement une fois les résultats publiés.
  const exam = (await q(
    `SELECT x.id, x.title, to_char(x.exam_date,'YYYY-MM-DD') AS exam_date, x.status, x.duration_min, (x.results_published_at IS NOT NULL) AS published,
            (a.submitted_at IS NOT NULL) AS submitted, (a.id IS NOT NULL AND a.submitted_at IS NULL) AS in_progress,
            (SELECT count(*) FROM exam_questions WHERE exam_id=x.id)::int AS question_count,
            CASE WHEN x.results_published_at IS NOT NULL AND a.submitted_at IS NOT NULL THEN a.total ELSE r.score END AS score,
            CASE WHEN x.results_published_at IS NOT NULL AND a.submitted_at IS NOT NULL THEN a.max_total ELSE 72 END AS max_score
     FROM exams x
     LEFT JOIN exam_results r ON r.exam_id=x.id AND r.user_id=$2
     LEFT JOIN exam_attempts a ON a.exam_id=x.id AND a.user_id=$2
     WHERE x.course_id=$1 AND (x.status='open' OR x.exam_date >= ${TODAY} OR r.score IS NOT NULL
           OR (a.total IS NOT NULL AND x.results_published_at IS NOT NULL))
     ORDER BY (x.status='open' AND a.submitted_at IS NULL) DESC, (x.exam_date >= ${TODAY}) DESC, x.exam_date ASC LIMIT 1`, [en.course_id, uid])).rows[0]
    || (en.exam_date ? { id: null, title: 'Examen de fin de cours', exam_date: en.exam_date, score: null, status: 'draft', published: false, question_count: 0 } : null);
  if (exam && exam.score !== null && exam.score !== undefined) { exam.score = Number(exam.score); exam.max_score = Number(exam.max_score); }
  exam && (exam.can_take = !!exam.id && exam.status === 'open' && !exam.submitted && exam.question_count > 0);

  const agency = (await q(
    `SELECT u.agency_joined joined,
       (SELECT count(*) FROM agency_steps WHERE published) total,
       (SELECT count(*) FROM agency_progress p JOIN agency_steps s ON s.id=p.step_id WHERE p.user_id=u.id AND p.done AND s.published) done
     FROM users u WHERE u.id=$1`, [uid])).rows[0];

  const exerciseScore = await sc('exercise'), listeningScore = await sc('listening');
  const parts = [exerciseScore, listeningScore, oral && oral.score !== null ? oral.score : null].filter((v) => v !== null && v !== undefined).map(Number);
  const total = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) * 10) / 10 : null;

  // Dernier résultat d'examen publié par l'admin (affiché en annonce côté étudiant)
  const examResult = await latestExamResult(uid, en.course_id);

  res.json({
    enrollment: en, session, steps, lesson, me: await meInfo(uid), word: wordOfTheDay(),
    exam, exam_result: examResult, agency: { joined: agency.joined, total: +agency.total, done: +agency.done }, checkin: await checkinInfo(uid),
    evaluation: {
      exercise: exerciseScore, listening: listeningScore,
      oral: oral ? (oral.score === null ? 'En attente de correction' : oral.score) : null,
      total, max: MAX,
      comment: oral?.comment || null, history,
    },
  });
}));

r.get('/announcements', h(async (req, res) => {
  const { rows } = await q(
    `SELECT a.* FROM announcements a WHERE a.course_id IS NULL OR a.course_id IN
       (SELECT course_id FROM enrollments WHERE user_id=$1) ORDER BY a.created_at DESC LIMIT 20`, [req.user.id]);
  res.json(rows);
}));

// ---------- Séance ----------
r.get('/sessions/:id', h(async (req, res) => {
  const s = await mySession(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Séance introuvable' });
  const lesson = (await q('SELECT id, title FROM lessons WHERE id=$1', [s.lesson_id])).rows[0];
  const resources = (await q('SELECT id, type, url, content, file_name FROM lesson_resources WHERE lesson_id=$1 ORDER BY id', [s.lesson_id])).rows;
  const exercises = (await q(`SELECT id, title, kind FROM exercises WHERE lesson_id=$1 AND (available_from IS NULL OR available_from<=now()) ORDER BY id`, [s.lesson_id])).rows;
  for (const ex of exercises) {
    const qs = (await q('SELECT id, type, prompt, options, answer FROM questions WHERE exercise_id=$1 ORDER BY position, id', [ex.id])).rows;
    ex.questions = qs.map((x) => {
      const out = { id: x.id, type: x.type, prompt: x.prompt, options: x.options };
      if (x.type === 'order') out.words = String(x.answer).split(/\s+/).sort(() => Math.random() - 0.5);
      return out; // la bonne réponse n'est jamais envoyée avant correction
    });
  }
  const oral = (await q('SELECT id, score, comment, created_at FROM oral_submissions WHERE session_id=$1 ORDER BY created_at DESC LIMIT 1', [s.id])).rows[0] || null;
  const subs = (await q(`SELECT DISTINCT ON (kind) kind, score FROM submissions WHERE session_id=$1 ORDER BY kind, created_at DESC`, [s.id])).rows;
  const vocab = (await q(`SELECT v.id, v.it, v.fr, v.en, v.example, COALESCE(p.known,false) known FROM vocab_items v
    LEFT JOIN vocab_progress p ON p.vocab_id=v.id AND p.user_id=$2 WHERE v.lesson_id=$1 ORDER BY v.position, v.id`, [s.lesson_id, req.user.id])).rows;
  res.json({ session: s, lesson, vocab, resources, exercises, oral, scores: Object.fromEntries(subs.map((x) => [x.kind, x.score])) });
}));

r.post('/sessions/:id/viewed', h(async (req, res) => {
  const s = await mySession(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Séance introuvable' });
  await q('UPDATE sessions SET lesson_viewed=true WHERE id=$1', [s.id]);
  res.json({ ok: true });
}));

// Correction automatique et immédiate, avec explication de l'erreur
r.post('/sessions/:id/exercises/:exId', h(async (req, res) => {
  const s = await mySession(req.params.id, req.user.id);
  if (!s || s.validated_at) return res.status(404).json({ error: 'Séance introuvable ou déjà validée' });
  const ex = (await q('SELECT * FROM exercises WHERE id=$1 AND lesson_id=$2', [req.params.exId, s.lesson_id])).rows[0];
  if (!ex) return res.status(404).json({ error: 'Exercice introuvable' });
  const qs = (await q('SELECT * FROM questions WHERE exercise_id=$1 ORDER BY position, id', [ex.id])).rows;
  const answers = req.body?.answers || {};
  const results = qs.map((x) => {
    const given = answers[x.id];
    let ok = false, shown = x.answer;
    if (x.type === 'qcm') { ok = Number(given) === Number(x.answer); shown = x.options?.[Number(x.answer)]; }
    else if (x.type === 'gap') ok = String(x.answer).split('|').some((v) => norm(v) === norm(given));
    else if (x.type === 'order') ok = norm(Array.isArray(given) ? given.join(' ') : given) === norm(x.answer);
    return { id: x.id, correct: ok, correctAnswer: shown, explanation: x.explanation };
  });
  const score = qs.length ? Math.round((results.filter((x) => x.correct).length / qs.length) * MAX.exercise * 10) / 10 : 0; // sur 25
  const first = +(await q('SELECT count(*) n FROM submissions WHERE session_id=$1 AND exercise_id=$2', [s.id, ex.id])).rows[0].n === 0;
  await q('INSERT INTO submissions (session_id, exercise_id, kind, score, answers) VALUES ($1,$2,$3,$4,$5)',
    [s.id, ex.id, ex.kind, score, JSON.stringify(answers)]);
  const xp_gained = first ? Math.round((score / MAX.exercise) * 20) : 0; // XP seulement au premier essai (pas de triche)
  await addXp(pool, req.user.id, xp_gained);
  await touchStreak(pool, req.user.id);
  const badges = [];
  if (score >= MAX.exercise && (await award(pool, req.user.id, 'perfect'))) badges.push('perfect');
  if (ex.kind === 'listening') await q('UPDATE sessions SET listening_done=true WHERE id=$1', [s.id]);
  if (ex.kind === 'exercise') await q('UPDATE sessions SET exercise_done=true WHERE id=$1', [s.id]);
  res.json({ score, results, xp_gained, badges });
}));

// Oral : enregistrement audio envoyé au professeur
r.post('/sessions/:id/oral', upload.single('audio'), h(async (req, res) => {
  const s = await mySession(req.params.id, req.user.id);
  if (!s || s.validated_at) return res.status(404).json({ error: 'Séance introuvable ou déjà validée' });
  if (!req.file) return res.status(400).json({ error: 'Aucun enregistrement reçu' });
  const audioUrl = `/uploads/${req.file.filename}`;
  await q('INSERT INTO oral_submissions (session_id, audio_url) VALUES ($1,$2)', [s.id, audioUrl]);
  await q('UPDATE sessions SET oral_done=true WHERE id=$1', [s.id]);
  res.status(201).json({ ok: true });
}));

// Validation : écoute + exercice + oral faits ET résultat consulté. Le compteur ne baisse qu'une fois.
r.post('/sessions/:id/validate', h(async (req, res) => {
  if (req.body?.seen !== true) return res.status(400).json({ error: 'Cochez « J\'ai vu mon résultat et je termine cette séance »' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT s.*, e.id eid FROM sessions s JOIN enrollments e ON e.id=s.enrollment_id
       WHERE s.id=$1 AND e.user_id=$2 FOR UPDATE OF s`, [req.params.id, req.user.id]);
    const s = rows[0];
    if (!s) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Séance introuvable' }); }
    if (s.validated_at) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Séance déjà validée' }); }
    if (!(s.listening_done && s.exercise_done && s.oral_done)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Terminez l\'écoute, l\'exercice et l\'oral avant de valider' });
    }
    await client.query('UPDATE sessions SET result_seen=true, validated_at=now() WHERE id=$1', [s.id]);
    await client.query('UPDATE enrollments SET sessions_remaining=GREATEST(sessions_remaining-1,0) WHERE id=$1', [s.eid]);
    await client.query('INSERT INTO attendance (enrollment_id, session_id) VALUES ($1,$2)', [s.eid, s.id]);
    const avg = +((await client.query('SELECT COALESCE(avg(score),0) a FROM submissions WHERE session_id=$1', [s.id])).rows[0].a);
    const xp_gained = 50 + Math.round((avg / MAX.exercise) * 30);
    await addXp(client, req.user.id, xp_gained);
    const streak = await touchStreak(client, req.user.id);
    const badges = await checkSessionBadges(client, req.user.id, streak);
    await client.query('COMMIT');
    res.json({ ok: true, xp_gained, streak, badges });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// ---------- Vocabulaire (cartes mémoire) ----------
r.get('/vocab', h(async (req, res) => {
  res.json((await q(
    `SELECT v.id, v.it, v.fr, v.en, v.example, l.title lesson, COALESCE(p.known,false) known
     FROM vocab_items v JOIN lessons l ON l.id=v.lesson_id
     LEFT JOIN vocab_progress p ON p.vocab_id=v.id AND p.user_id=$1
     WHERE ${PUBLISHED} AND l.course_id IN (SELECT course_id FROM enrollments WHERE user_id=$1 AND active)
     ORDER BY l.position, l.id, v.position, v.id`, [req.user.id])).rows);
}));
r.post('/vocab/:id', h(async (req, res) => {
  await q(`INSERT INTO vocab_progress (user_id, vocab_id, known) VALUES ($1,$2,$3)
           ON CONFLICT (user_id, vocab_id) DO UPDATE SET known=EXCLUDED.known, updated_at=now()`,
    [req.user.id, req.params.id, req.body?.known === true]);
  res.json({ ok: true });
}));

// ---------- Classement du groupe (prénoms seulement) ----------
r.get('/leaderboard', h(async (req, res) => {
  const { rows } = await q(
    `SELECT u.id, split_part(u.name,' ',1) first_name, u.xp FROM users u
     WHERE u.role='student' AND u.active AND u.id IN (
       SELECT user_id FROM enrollments WHERE active AND course_id IN (SELECT course_id FROM enrollments WHERE user_id=$1))
     ORDER BY u.xp DESC, u.id LIMIT 5`, [req.user.id]);
  res.json(rows.map((x) => ({ first_name: x.first_name, xp: x.xp, me: x.id === req.user.id })));
}));

export default r;
