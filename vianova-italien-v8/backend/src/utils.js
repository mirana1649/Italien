import crypto from 'crypto';
export const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
// Barème : note d'un étudiant = exercice /25 + écoute /25 + oral /22 = /72
export const MAX = { exercise: 25, listening: 25, oral: 22, total: 72 };
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const tempPassword = () => crypto.randomBytes(6).toString('base64url');
export const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const norm = (s) =>
  String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
