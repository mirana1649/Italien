import pg from 'pg';

/**
 * Connexion à PostgreSQL (installation classique : locale, serveur, Docker…).
 * Deux façons de configurer (au choix) :
 *  1) DATABASE_URL=postgresql://utilisateur:motdepasse@hote:5432/nom_base
 *  2) DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME  (aucun encodage nécessaire)
 * SSL : désactivé par défaut ; DB_SSL=true pour un serveur distant qui l'exige.
 */
function readConfig() {
  const env = process.env;
  const warnings = [];
  let c = {};
  let source = 'aucune';

  if (env.DB_HOST) {
    source = 'DB_HOST / DB_USER / DB_PASSWORD';
    c = { host: env.DB_HOST.trim(), port: Number(env.DB_PORT || 5432), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME || 'vianova' };
  } else if (env.DATABASE_URL) {
    source = 'DATABASE_URL';
    const raw = env.DATABASE_URL.trim().replace(/^["']|["']$/g, '');
    const m = raw.match(/^postgres(?:ql)?:\/\/([^:@/]+):(.*)@([^@/?#]+)\/([^?]*)(?:\?.*)?$/s);
    if (!m) {
      warnings.push('DATABASE_URL illisible ou coupée. Format : postgresql://utilisateur:motdepasse@hote:5432/nom_base . ATTENTION : si le mot de passe contient #, le .env coupe la ligne à cet endroit → mettez toute la valeur entre guillemets (ou utilisez DB_HOST/DB_PASSWORD).');
    } else {
      const [, user, pwdRaw, hostport, database] = m;
      const hp = hostport.match(/^(.*?)(?::(\d+))?$/);
      let password = pwdRaw;
      try { password = decodeURIComponent(password); } catch { /* mot de passe brut */ }
      let usr = user; try { usr = decodeURIComponent(user); } catch { /* brut */ }
      c = { host: hp[1], port: Number(hp[2] || 5432), user: usr, password, database: database || 'vianova' };
    }
  } else {
    warnings.push("Ni DATABASE_URL ni DB_HOST dans backend/.env (le fichier doit s'appeler .env, pas .env.example).");
  }
  return { ...c, source, warnings };
}

const cfg = readConfig();
export const dbInfo = { source: cfg.source, host: cfg.host, port: cfg.port, user: cfg.user, database: cfg.database, mode: cfg.host ? `${cfg.host}:${cfg.port}/${cfg.database}` : 'inconnu', passwordLength: (cfg.password || '').length, warnings: cfg.warnings };

export const pool = new pg.Pool({
  host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_POOL_MAX || 10),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  keepAlive: true,
});
pool.on('error', (e) => console.error('[DB] connexion inactive perdue :', e.message));
export const q = (text, params) => pool.query(text, params);

/** Transforme une erreur de connexion en conseils concrets (français). */
export function explainDbError(err) {
  const msg = `${err?.message || ''} ${err?.code || ''}`;
  const tips = [];
  if (/password authentication failed|28P01/i.test(msg)) tips.push("Mot de passe refusé : vérifiez l'utilisateur et le mot de passe PostgreSQL dans backend/.env.");
  if (/does not exist|3D000/i.test(msg)) tips.push("La base n'existe pas : créez-la d'abord (ex. « createdb vianova » ou « CREATE DATABASE vianova; »).");
  if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) tips.push("Nom d'hôte introuvable : vérifiez DB_HOST / l'adresse dans DATABASE_URL.");
  if (/ECONNREFUSED/i.test(msg)) tips.push("Connexion refusée : PostgreSQL n'est pas démarré, ou le port/hôte est faux (par défaut localhost:5432).");
  if (/ETIMEDOUT|timeout|ECONNRESET/i.test(msg)) tips.push('Connexion expirée : pare-feu, mauvais hôte, ou le serveur n\'accepte pas les connexions distantes (listen_addresses / pg_hba.conf).');
  if (/SSL|certificate|no pg_hba/i.test(msg)) tips.push('Problème SSL : essayez DB_SSL=true (serveur distant) ou retirez-le (serveur local).');
  if (!tips.length) tips.push('Lancez « npm run db:test » dans le dossier backend pour un diagnostic détaillé.');
  return tips;
}
