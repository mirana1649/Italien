import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/student.js';
import teacherRoutes from './routes/teacher.js';
import adminRoutes from './routes/admin.js';
import agencyRoutes from './routes/agency.js';
import { studentExams, adminExams } from './routes/exams.js';
import { pool, dbInfo, explainDbError } from './db.js';

const app = express();
const clients = (process.env.CLIENT_URL || '').split(',').map((x) => x.trim()).filter(Boolean);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  frameguard: false, // remplacé par frame-ancestors ci-dessous : le frontend peut afficher les PDF en local
  contentSecurityPolicy: { useDefaults: true, directives: { 'frame-ancestors': ["'self'", ...clients] } },
}));
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static('uploads')); // noms de fichiers aléatoires (UUID)

app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }));
app.use('/api/auth', authRoutes);
app.use('/api/student/exams', studentExams); // avant /api/student
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/admin/exams', adminExams); // avant /api/admin
app.use('/api/admin', adminRoutes);
app.use('/api/agency', agencyRoutes);
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/health/db', async (req, res) => {
  try { await pool.query('select 1'); res.json({ ok: true, mode: dbInfo.mode }); }
  catch (e) { res.status(503).json({ ok: false, error: e.message, hints: explainDbError(e) }); }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

const port = process.env.PORT || 4000;
app.listen(port, async () => {
  console.log(`API Vianona sur http://localhost:${port}`);
  dbInfo.warnings.forEach((w) => console.warn('[DB] ⚠', w));
  try { await pool.query('select 1'); console.log(`[DB] ✔ PostgreSQL connecté (${dbInfo.mode})`); }
  catch (e) { console.error('[DB] ✘', e.message); explainDbError(e).forEach((t) => console.error('[DB]  →', t)); }
});
