import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { q } from '../db.js';
import { h, LEVELS, sha } from '../utils.js';
import { auth, sign } from '../middleware/auth.js';

const r = Router();
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, level: u.level, city: u.city, phone: u.phone, agency_joined: u.agency_joined, lang: u.lang, must_change_password: u.must_change_password });

// Inscription publique : uniquement des comptes ÉTUDIANT, avec le niveau choisi
r.post('/register', h(async (req, res) => {
  const { name, email, password, level, city, phone, lang } = req.body || {};
  if (!name?.trim() || !email?.includes('@')) return res.status(400).json({ error: 'Nom et email valides requis' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum' });
  if (!LEVELS.includes(level)) return res.status(400).json({ error: 'Choisissez votre niveau (A1 à C2)' });
  const exists = await q('SELECT 1 FROM users WHERE email=$1', [email.toLowerCase()]);
  if (exists.rowCount) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await q(
    `INSERT INTO users (name,email,password_hash,role,level,city,phone,lang) VALUES ($1,$2,$3,'student',$4,$5,$6,$7) RETURNING *`,
    [name.trim(), email.toLowerCase(), hash, level, city?.trim() || null, phone?.trim() || null, ['fr', 'it', 'en'].includes(lang) ? lang : 'fr']);
  res.status(201).json({ token: sign(rows[0]), user: publicUser(rows[0]) });
}));

r.post('/login', h(async (req, res) => {
  const { email, password } = req.body || {};
  const { rows } = await q('SELECT * FROM users WHERE email=$1', [String(email || '').toLowerCase()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  if (!u.active) return res.status(403).json({ error: "Compte désactivé, contactez l'administration" });
  await q('UPDATE users SET last_login=now() WHERE id=$1', [u.id]);
  res.json({ token: sign(u), user: publicUser(u) });
}));

r.get('/me', auth(), h(async (req, res) => {
  const { rows } = await q('SELECT * FROM users WHERE id=$1', [req.user.id]);
  const e = await q(
    `SELECT c.title course, c.level course_level, t.name teacher FROM enrollments e
     JOIN courses c ON c.id=e.course_id LEFT JOIN users t ON t.id=e.teacher_id
     WHERE e.user_id=$1 AND e.active ORDER BY e.id DESC LIMIT 1`, [req.user.id]);
  res.json({ ...publicUser(rows[0]), enrollment: e.rows[0] || null });
}));

// Langue d'étude (fr / it / en)
r.patch('/lang', auth(), h(async (req, res) => {
  const { lang } = req.body || {};
  if (!['fr', 'it', 'en'].includes(lang)) return res.status(400).json({ error: 'Langue invalide' });
  await q('UPDATE users SET lang=$1 WHERE id=$2', [lang, req.user.id]);
  res.json({ ok: true, lang });
}));

r.post('/change-password', auth(), h(async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 8) return res.status(400).json({ error: '8 caractères minimum' });
  await q('UPDATE users SET password_hash=$1, must_change_password=false WHERE id=$2', [await bcrypt.hash(password, 10), req.user.id]);
  res.json({ ok: true });
}));

// Réinitialisation : sans service d'email, le lien est affiché dans la console du serveur
r.post('/forgot-password', h(async (req, res) => {
  const { rows } = await q('SELECT id FROM users WHERE email=$1 AND active', [String(req.body?.email || '').toLowerCase()]);
  if (rows[0]) {
    const token = crypto.randomBytes(24).toString('hex');
    await q(`INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '1 hour')`, [rows[0].id, sha(token)]);
    console.log(`[RESET] ${process.env.CLIENT_URL}/reset?token=${token}`);
  }
  res.json({ message: 'Si ce compte existe, un lien de réinitialisation a été envoyé.' });
}));

r.post('/reset-password', h(async (req, res) => {
  const { token, password } = req.body || {};
  if (!password || password.length < 8) return res.status(400).json({ error: '8 caractères minimum' });
  const { rows } = await q('SELECT * FROM password_resets WHERE token_hash=$1 AND expires_at>now()', [sha(token || '')]);
  if (!rows[0]) return res.status(400).json({ error: 'Lien invalide ou expiré' });
  await q('UPDATE users SET password_hash=$1, must_change_password=false WHERE id=$2', [await bcrypt.hash(password, 10), rows[0].user_id]);
  await q('DELETE FROM password_resets WHERE user_id=$1', [rows[0].user_id]);
  res.json({ ok: true });
}));

export default r;
