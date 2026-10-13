import 'dotenv/config';
import fs from 'fs';
import { pool, explainDbError } from './db.js';
const sql = fs.readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8');
try {
  await pool.query(sql);
  console.log('Schéma créé / mis à jour (vous pouvez relancer cette commande sans risque).');
} catch (e) {
  console.error('Échec :', e.message);
  explainDbError(e).forEach((t) => console.error(' →', t));
  process.exitCode = 1;
} finally { await pool.end(); }
