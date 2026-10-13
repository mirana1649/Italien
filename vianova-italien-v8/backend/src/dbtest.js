import 'dotenv/config';
import dns from 'dns/promises';
import net from 'net';
import { pool, dbInfo, explainDbError } from './db.js';

const ok = (s) => console.log('  ✔', s), ko = (s) => console.log('  ✘', s), info = (s) => console.log('   ', s);
const tcp = (host, port) => new Promise((res) => {
  const s = net.connect({ host, port, family: 4, timeout: 6000 });
  s.on('connect', () => { s.destroy(); res(true); }); s.on('timeout', () => { s.destroy(); res(false); }); s.on('error', () => res(false));
});

console.log('\n=== Diagnostic de connexion PostgreSQL ===\n');
console.log('1) Configuration lue');
info(`Source      : ${dbInfo.source}`); info(`Hôte        : ${dbInfo.host || '(vide)'}`); info(`Port        : ${dbInfo.port}`);
info(`Utilisateur : ${dbInfo.user || '(vide)'}`); info(`Mot de passe: ${dbInfo.passwordLength} caractères`); info(`Mode        : ${dbInfo.mode}`);
dbInfo.warnings.forEach((w) => ko(w));

if (dbInfo.host && !/^[\d.]+$/.test(dbInfo.host)) {
  console.log('\n2) Réseau');
  const v4 = await dns.resolve4(dbInfo.host).catch(() => []); const v6 = await dns.resolve6(dbInfo.host).catch(() => []);
  v4.length ? ok(`Adresse IPv4 trouvée (${v4[0]})`) : ko(v6.length ? 'Aucune adresse IPv4 trouvée (IPv6 seulement)' : 'Nom d\'hôte introuvable (DNS)');
  { const p = dbInfo.port || 5432; (await tcp(dbInfo.host, p)) ? ok(`Port ${p} joignable`) : ko(`Port ${p} NON joignable (PostgreSQL arrêté, pare-feu, ou mauvais port)`); }
}

console.log('\n3) Connexion à la base');
try {
  const r = await pool.query('select now() as now, current_user as usr, version() as v');
  ok(`Connecté en tant que ${r.rows[0].usr}`); info(r.rows[0].v.split(',')[0]);
  const t = await pool.query("select count(*)::int n from information_schema.tables where table_schema='public' and table_name in ('users','courses','lessons')");
  t.rows[0].n === 3 ? ok('Les tables existent déjà') : ko('Les tables n\'existent pas encore → lancez : npm run db:init');
  console.log('\nTout est bon. Vous pouvez lancer : npm run dev\n');
} catch (e) {
  ko(`Échec : ${e.message}`);
  console.log('\nQue faire :'); explainDbError(e).forEach((t) => console.log('  →', t));
  console.log('');
  process.exitCode = 1;
} finally { await pool.end(); }
