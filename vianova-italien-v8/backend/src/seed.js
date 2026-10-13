import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, q, explainDbError } from './db.js';

const J = (v) => JSON.stringify(v);

async function addLesson(courseId, position, title, { written, reading, vocab = [], exercises = [] }) {
  const l = (await q(`INSERT INTO lessons (course_id,title,position,status) VALUES ($1,$2,$3,'published') RETURNING id`, [courseId, title, position])).rows[0];
  await q(`INSERT INTO lesson_resources (lesson_id,type,content) VALUES ($1,'written',$2),($1,'reading',$3)`, [l.id, written, reading]);
  let p = 1;
  for (const [it, fr, example] of vocab) await q('INSERT INTO vocab_items (lesson_id,it,fr,example,position) VALUES ($1,$2,$3,$4,$5)', [l.id, it, fr, example || null, p++]);
  for (const ex of exercises) {
    const e = (await q('INSERT INTO exercises (lesson_id,title,kind) VALUES ($1,$2,$3) RETURNING id', [l.id, ex.title, ex.kind])).rows[0];
    let n = 1;
    for (const x of ex.questions) await q(
      'INSERT INTO questions (exercise_id,type,prompt,options,answer,explanation,position) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [e.id, x.type, x.prompt, x.options ? J(x.options) : null, J(x.answer), x.explanation, n++]);
  }
}

try {
  const email = (process.env.ADMIN_EMAIL || 'admin@vianona.mg').toLowerCase();
  const pwd = process.env.ADMIN_PASSWORD || 'ChangezMoi123';
  await q(`INSERT INTO users (name,email,password_hash,role) VALUES ('Administrateur',$1,$2,'admin') ON CONFLICT (email) DO NOTHING`, [email, await bcrypt.hash(pwd, 10)]);

  const c = await q(`INSERT INTO courses (title,level) SELECT 'Italien A1 – Les bases','A1' WHERE NOT EXISTS (SELECT 1 FROM courses) RETURNING id`);
  if (c.rows[0]) {
    const id = c.rows[0].id;
    await addLesson(id, 1, 'Salutations et présentations', {
      written: "Ciao ! = Salut. Buongiorno = Bonjour. Buonasera = Bonsoir.\nMi chiamo Marco = Je m'appelle Marco.\nSono di Roma = Je suis de Rome.\nPiacere ! = Enchanté(e) !",
      reading: "Buongiorno, mi chiamo Marco. Sono di Roma e studio l'italiano.",
      vocab: [['Ciao', 'Salut / Au revoir', 'Ciao, come stai ?'], ['Buongiorno', 'Bonjour', 'Buongiorno, signora !'], ['Buonasera', 'Bonsoir', 'Buonasera a tutti.'],
              ['Mi chiamo…', "Je m'appelle…", 'Mi chiamo Sara.'], ['Piacere', 'Enchanté(e)', 'Piacere di conoscerti !'], ['Arrivederci', 'Au revoir', 'Arrivederci, a domani !']],
      exercises: [
        { title: 'Exercices : salutations', kind: 'exercise', questions: [
          { type: 'qcm', prompt: 'Comment dit-on « Bonjour » ?', options: ['Buongiorno', 'Arrivederci', 'Grazie'], answer: 0, explanation: '« Buongiorno » = bonjour ; « Arrivederci » = au revoir.' },
          { type: 'gap', prompt: "Mi ___ Marco. (je m'appelle)", answer: 'chiamo', explanation: 'Verbe chiamarsi : io mi chiamo.' },
          { type: 'order', prompt: 'Remettez en ordre : « Je suis de Rome »', answer: 'Sono di Roma', explanation: 'Sono = je suis, di = de.' },
          { type: 'qcm', prompt: 'Que dit-on en rencontrant quelqu\u2019un ?', options: ['Prego', 'Piacere', 'Scusi'], answer: 1, explanation: '« Piacere » = enchanté(e).' }] },
        { title: 'Compréhension orale', kind: 'listening', questions: [
          { type: 'qcm', prompt: 'Quelle est la ville de Marco ?', options: ['Milano', 'Roma', 'Napoli'], answer: 1, explanation: 'Marco dit « Sono di Roma ».' }] },
      ],
    });
    await addLesson(id, 2, 'Les nombres de 1 à 10', {
      written: 'uno 1 · due 2 · tre 3 · quattro 4 · cinque 5\nsei 6 · sette 7 · otto 8 · nove 9 · dieci 10',
      reading: 'Ho due fratelli e tre sorelle. Ho dieci euro.',
      vocab: [['uno', 'un', null], ['due', 'deux', null], ['tre', 'trois', null], ['quattro', 'quatre', null], ['cinque', 'cinq', null], ['dieci', 'dix', 'Ho dieci euro.']],
      exercises: [
        { title: 'Exercices : les nombres', kind: 'exercise', questions: [
          { type: 'qcm', prompt: 'Que veut dire « sette » ?', options: ['6', '7', '8'], answer: 1, explanation: 'sei = 6, sette = 7, otto = 8.' },
          { type: 'gap', prompt: 'Écrivez 3 en italien : ___', answer: 'tre', explanation: 'uno, due, tre…' }] },
        { title: 'Écoute : les nombres', kind: 'listening', questions: [
          { type: 'qcm', prompt: 'Combien d\u2019euros a la personne du texte ?', options: ['due', 'tre', 'dieci'], answer: 2, explanation: '« Ho dieci euro » = j\u2019ai dix euros.' }] },
      ],
    });
  }
  const hasSteps = +(await q('SELECT count(*) n FROM agency_steps')).rows[0].n;
  if (!hasSteps) {
    const steps = [
      ['inscription', 'Choisir la filière et l\u2019université', 'Avec l\u2019agence, sélectionnez 2 à 3 universités publiques italiennes correspondant à votre projet.'],
      ['inscription', 'Préinscription sur Universitaly', 'Création du compte et dépôt de la demande de préinscription.'],
      ['inscription', 'Traduction et légalisation des diplômes', 'Baccalauréat et relevés de notes : traduction officielle et légalisation.'],
      ['bourse', 'Constituer le dossier de bourse (DSU)', 'Rassemblez les justificatifs de ressources et les documents demandés.'],
      ['bourse', 'Déposer la demande de bourse', 'L\u2019agence vérifie le dossier avant le dépôt avant la date limite.'],
      ['visa', 'Rendez-vous à l\u2019ambassade / centre de visa', 'Prise de rendez-vous et préparation des documents du visa étudiant.'],
      ['visa', 'Déposer le dossier de visa', 'Passeport, lettre d\u2019admission, assurance, justificatifs financiers.'],
      ['logement', 'Demande de logement étudiant', 'Résidence universitaire ou colocation : l\u2019agence vous oriente.'],
      ['logement', 'Réserver la première nuit d\u2019arrivée', 'Hébergement temporaire en attendant l\u2019attribution du logement.'],
      ['accompagnement', 'Billet d\u2019avion et assurance voyage', 'Réservation une fois le visa obtenu.'],
      ['accompagnement', 'Accueil à l\u2019arrivée en Italie', 'Permis de séjour (permesso di soggiorno), codice fiscale, ouverture de compte.'],
    ];
    let pos = {};
    for (const [category, title, description] of steps) {
      pos[category] = (pos[category] || 0) + 1;
      await q('INSERT INTO agency_steps (category,title,description,position) VALUES ($1,$2,$3,$4)', [category, title, description, pos[category]]);
    }
  }
  console.log(`Admin prêt : ${email}`);
} catch (e) {
  console.error('Échec :', e.message); explainDbError(e).forEach((t) => console.error(' →', t)); process.exitCode = 1;
} finally { await pool.end(); }
