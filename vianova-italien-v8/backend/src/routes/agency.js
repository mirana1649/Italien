import { Router } from 'express';
import { q } from '../db.js';
import { h } from '../utils.js';
import { auth } from '../middleware/auth.js';

export const AGENCY_CATEGORIES = ['bourse', 'visa', 'logement', 'inscription', 'accompagnement'];

const r = Router();

// ---------- Étudiant : voir les démarches, rejoindre l'agence, cocher ----------
r.get('/', auth(['student', 'admin', 'teacher']), h(async (req, res) => {
  const uid = req.user.id;
  const steps = (await q(
    `SELECT s.id, s.category, s.title, s.description, s.link_url, s.position, s.published,
            COALESCE(p.done,false) done
     FROM agency_steps s LEFT JOIN agency_progress p ON p.step_id=s.id AND p.user_id=$1
     WHERE ($2 OR s.published) ORDER BY s.category, s.position, s.id`, [uid, req.user.role === 'admin'])).rows;
  const me = (await q('SELECT agency_joined FROM users WHERE id=$1', [uid])).rows[0];
  res.json({ joined: !!me?.agency_joined, steps });
}));

r.post('/join', auth(['student']), h(async (req, res) => {
  await q('UPDATE users SET agency_joined=true, agency_joined_at=COALESCE(agency_joined_at, now()) WHERE id=$1', [req.user.id]);
  res.json({ ok: true });
}));

r.post('/steps/:id/toggle', auth(['student']), h(async (req, res) => {
  const me = (await q('SELECT agency_joined FROM users WHERE id=$1', [req.user.id])).rows[0];
  if (!me?.agency_joined) return res.status(403).json({ error: "Rejoignez d'abord l'agence pour suivre les démarches" });
  const step = (await q('SELECT id FROM agency_steps WHERE id=$1 AND published', [req.params.id])).rows[0];
  if (!step) return res.status(404).json({ error: 'Démarche introuvable' });
  const done = req.body?.done === true;
  await q(`INSERT INTO agency_progress (user_id, step_id, done) VALUES ($1,$2,$3)
           ON CONFLICT (user_id, step_id) DO UPDATE SET done=EXCLUDED.done, updated_at=now()`, [req.user.id, step.id, done]);
  res.json({ ok: true, done });
}));

// ---------- Admin SEUL : créer / modifier / supprimer les démarches ----------
const admin = auth(['admin']);
r.post('/steps', admin, h(async (req, res) => {
  const { category, title, description, link_url, published } = req.body || {};
  if (!AGENCY_CATEGORIES.includes(category) || !title?.trim()) return res.status(400).json({ error: 'Catégorie et titre requis' });
  const pos = (await q('SELECT COALESCE(max(position),0)+1 p FROM agency_steps WHERE category=$1', [category])).rows[0].p;
  res.status(201).json((await q(
    `INSERT INTO agency_steps (category,title,description,link_url,position,published) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [category, title.trim(), description?.trim() || null, link_url?.trim() || null, pos, published !== false])).rows[0]);
}));
r.patch('/steps/:id', admin, h(async (req, res) => {
  const { category, title, description, link_url, position, published } = req.body || {};
  if (category && !AGENCY_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Catégorie invalide' });
  const row = (await q(
    `UPDATE agency_steps SET category=COALESCE($1,category), title=COALESCE($2,title), description=COALESCE($3,description),
       link_url=COALESCE($4,link_url), position=COALESCE($5,position), published=COALESCE($6,published) WHERE id=$7 RETURNING *`,
    [category ?? null, title ?? null, description ?? null, link_url ?? null, position ?? null, published ?? null, req.params.id])).rows[0];
  if (!row) return res.status(404).json({ error: 'Démarche introuvable' });
  res.json(row);
}));
r.delete('/steps/:id', admin, h(async (req, res) => { await q('DELETE FROM agency_steps WHERE id=$1', [req.params.id]); res.json({ ok: true }); }));

// Suivi par l'admin : quels étudiants ont rejoint l'agence et où ils en sont
r.get('/admin/students', admin, h(async (req, res) => {
  const total = +(await q('SELECT count(*) n FROM agency_steps WHERE published')).rows[0].n;
  const rows = (await q(
    `SELECT u.id, u.name, u.level, u.city, u.phone, u.agency_joined_at,
       (SELECT count(*) FROM agency_progress p JOIN agency_steps s ON s.id=p.step_id WHERE p.user_id=u.id AND p.done AND s.published) done
     FROM users u WHERE u.role='student' AND u.agency_joined ORDER BY u.agency_joined_at DESC`)).rows;
  res.json({ total, students: rows.map((x) => ({ ...x, done: +x.done })) });
}));
r.get('/admin/students/:id', admin, h(async (req, res) => {
  res.json((await q(
    `SELECT s.id, s.category, s.title, COALESCE(p.done,false) done, p.updated_at
     FROM agency_steps s LEFT JOIN agency_progress p ON p.step_id=s.id AND p.user_id=$1
     WHERE s.published ORDER BY s.category, s.position, s.id`, [req.params.id])).rows);
}));

export default r;
