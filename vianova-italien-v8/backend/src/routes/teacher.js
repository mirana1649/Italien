import { Router } from 'express';
import { pool, q } from '../db.js';
import { award } from '../gamification.js';
import { h, MAX } from '../utils.js';
import { auth } from '../middleware/auth.js';

const r = Router();
r.use(auth(['teacher', 'admin']));

// Un professeur ne voit que ses étudiants ; l'admin voit tout
const scope = (req) => (req.user.role === 'admin' ? ['TRUE', []] : ['e.teacher_id=$1', [req.user.id]]);

r.get('/students', h(async (req, res) => {
  const [w, p] = scope(req);
  const { rows } = await q(
    `SELECT u.id, u.name, u.email, u.level, c.title course, e.sessions_remaining, u.last_login,
       (SELECT round(avg(score),1) FROM submissions s JOIN sessions se ON se.id=s.session_id WHERE se.enrollment_id=e.id) avg_score
     FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id
     WHERE ${w} AND e.active ORDER BY u.name`, p);
  res.json(rows);
}));

r.get('/oral', h(async (req, res) => {
  const [w, p] = scope(req);
  const pending = req.query.all ? '' : 'AND o.score IS NULL';
  const { rows } = await q(
    `SELECT o.id, o.audio_url, o.score, o.comment, o.created_at, u.name student, l.title lesson
     FROM oral_submissions o JOIN sessions s ON s.id=o.session_id JOIN enrollments e ON e.id=s.enrollment_id
     JOIN users u ON u.id=e.user_id JOIN lessons l ON l.id=s.lesson_id
     WHERE ${w} ${pending} ORDER BY o.created_at DESC LIMIT 100`, p);
  res.json(rows);
}));

r.post('/oral/:id/grade', h(async (req, res) => {
  const score = Number(req.body?.score);
  if (!(score >= 0 && score <= MAX.oral)) return res.status(400).json({ error: `Note entre 0 et ${MAX.oral}` });
  const [w, p] = scope(req);
  const ok = await q(
    `SELECT 1 FROM oral_submissions o JOIN sessions s ON s.id=o.session_id JOIN enrollments e ON e.id=s.enrollment_id
     WHERE o.id=$${p.length + 1} AND ${w}`, [...p, req.params.id]);
  if (!ok.rowCount) return res.status(404).json({ error: 'Enregistrement introuvable' });
  await q('UPDATE oral_submissions SET score=$1, comment=$2, graded_by=$3, graded_at=now() WHERE id=$4',
    [score, req.body?.comment || null, req.user.id, req.params.id]);
  if (score / MAX.oral >= 0.8) { // 80 % ou plus
    const st = (await q(`SELECT e.user_id FROM oral_submissions o JOIN sessions s ON s.id=o.session_id JOIN enrollments e ON e.id=s.enrollment_id WHERE o.id=$1`, [req.params.id])).rows[0];
    if (st) await award(pool, st.user_id, 'voice');
  }
  res.json({ ok: true });
}));

export default r;
