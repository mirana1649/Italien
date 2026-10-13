// XP, série de jours (streak), badges et mot du jour
const TODAY = `(now() AT TIME ZONE 'Indian/Antananarivo')::date`;

export async function touchStreak(c, uid) {
  const { rows } = await c.query(
    `UPDATE users SET
       streak = CASE WHEN last_activity = ${TODAY} THEN streak
                     WHEN last_activity = ${TODAY} - 1 THEN streak + 1 ELSE 1 END,
       last_activity = ${TODAY}
     WHERE id=$1 RETURNING streak`, [uid]);
  return rows[0]?.streak ?? 0;
}

export async function addXp(c, uid, n) {
  if (!n) return;
  await c.query('UPDATE users SET xp = xp + $2 WHERE id=$1', [uid, Math.round(n)]);
}

// Renvoie le code si le badge vient d'être gagné, sinon null
export async function award(c, uid, code) {
  const { rows } = await c.query('INSERT INTO user_badges (user_id, code) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING code', [uid, code]);
  return rows[0]?.code ?? null;
}

export async function checkSessionBadges(c, uid, streak) {
  const n = +(await c.query(
    `SELECT count(*) n FROM sessions s JOIN enrollments e ON e.id=s.enrollment_id WHERE e.user_id=$1 AND s.validated_at IS NOT NULL`, [uid])).rows[0].n;
  const earned = [];
  const tests = [['first_session', n >= 1], ['five_sessions', n >= 5], ['ten_sessions', n >= 10], ['streak_3', streak >= 3], ['streak_7', streak >= 7]];
  for (const [code, cond] of tests) if (cond && (await award(c, uid, code))) earned.push(code);
  return earned;
}

const WORDS = [
  ['Ciao', 'Salut / Au revoir', 'Ciao, come stai ?'], ['Grazie', 'Merci', 'Grazie mille !'], ['Per favore', "S'il vous plaît", 'Un caffè, per favore.'],
  ['Buongiorno', 'Bonjour', 'Buongiorno, signora !'], ['Buonanotte', 'Bonne nuit', 'Buonanotte, a domani.'], ['Amico', 'Ami', 'Marco è il mio amico.'],
  ['Casa', 'Maison', 'La mia casa è piccola.'], ['Acqua', 'Eau', "Vorrei un bicchiere d'acqua."], ['Pane', 'Pain', 'Il pane è fresco.'],
  ['Caffè', 'Café', 'Prendo un caffè.'], ['Bello', 'Beau', 'Che bello !'], ['Mangiare', 'Manger', 'Voglio mangiare la pizza.'],
  ['Bere', 'Boire', 'Cosa vuoi bere ?'], ['Parlare', 'Parler', 'Parlo un po\u2019 di italiano.'], ['Sole', 'Soleil', 'Oggi c\u2019è il sole.'],
  ['Mare', 'Mer', 'Andiamo al mare !'], ['Libro', 'Livre', 'Leggo un libro.'], ['Scuola', 'École', 'Vado a scuola.'],
  ['Famiglia', 'Famille', 'Ho una grande famiglia.'], ['Felice', 'Heureux', 'Sono molto felice.'], ['Andiamo', 'Allons-y', 'Andiamo !'],
  ['Benvenuto', 'Bienvenue', 'Benvenuto in Italia !'], ['A presto', 'À bientôt', 'Ciao, a presto !'], ['Scusi', 'Excusez-moi', 'Scusi, dov\u2019è la stazione ?'],
  ['Domani', 'Demain', 'Ci vediamo domani.'], ['Sempre', 'Toujours', 'Ti penso sempre.'], ['Dolce', 'Doux / sucré', 'Il gelato è dolce.'],
];
export function wordOfTheDay() {
  const day = Math.floor((Date.now() + 3 * 3600e3) / 864e5);
  const [it, fr, example] = WORDS[day % WORDS.length];
  return { it, fr, example };
}
