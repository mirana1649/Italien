import jwt from 'jsonwebtoken';
import { q } from '../db.js';

export const sign = (u) =>
  jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

// auth(['admin']) : accès réservé aux rôles listés (vide = tout utilisateur connecté)
export const auth = (roles = []) => async (req, res, next) => {
  try {
    const hdr = req.headers.authorization || '';
    if (!hdr.startsWith('Bearer ')) return res.status(401).json({ error: 'Non connecté' });
    let payload;
    try { payload = jwt.verify(hdr.slice(7), process.env.JWT_SECRET); }
    catch { return res.status(401).json({ error: 'Session expirée' }); }
    const { rows } = await q('SELECT id, role, active FROM users WHERE id=$1', [payload.id]);
    if (!rows[0] || !rows[0].active) return res.status(401).json({ error: 'Compte désactivé' });
    req.user = { id: rows[0].id, role: rows[0].role };
    if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Accès refusé' });
    next();
  } catch (e) { next(e); }
};
