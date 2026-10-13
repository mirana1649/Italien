import { q } from './db.js';
import { norm } from './utils.js';

// Les 3 parties de l'examen et leur barème par défaut : 25 + 25 + 22 = 72
export const SECTIONS = ['lettura', 'ascolto', 'struttura'];
export const DEFAULT_MAX = { lettura: 25, ascolto: 25, struttura: 22 };
export const TODAY_MG = `(now() AT TIME ZONE 'Indian/Antananarivo')::date`;

const round1 = (n) => Math.round(n * 10) / 10;

/** Corrige une réponse (QCM, texte à trous, remise en ordre). */
export function isCorrect(question, given) {
  if (given === undefined || given === null) return false;
  if (question.type === 'qcm') return Number(given) === Number(question.answer);
  if (question.type === 'gap') return String(question.answer).split('|').some((v) => norm(v) === norm(given));
  if (question.type === 'order') return norm(Array.isArray(given) ? given.join(' ') : given) === norm(question.answer);
  return false;
}

/**
 * Note chaque partie : (bonnes réponses / nombre de questions) x barème de la partie.
 * Renvoie { scores: {lettura:{score,max,correct,count}, …}, total, max_total, results: [...] }
 */
export function gradeExam(questions, sections, answers = {}) {
  const maxOf = Object.fromEntries(sections.map((s) => [s.kind, Number(s.max_points)]));
  const scores = {}; const results = [];
  for (const kind of SECTIONS) {
    const qs = questions.filter((x) => x.section === kind);
    const rs = qs.map((x) => {
      const ok = isCorrect(x, answers[x.id]);
      const shown = x.type === 'qcm' ? x.options?.[Number(x.answer)] : x.answer;
      return { id: x.id, section: kind, correct: ok, correctAnswer: shown, explanation: x.explanation };
    });
    const good = rs.filter((r) => r.correct).length;
    const max = maxOf[kind] ?? DEFAULT_MAX[kind];
    scores[kind] = { score: qs.length ? round1((good / qs.length) * max) : 0, max, correct: good, count: qs.length };
    results.push(...rs);
  }
  const total = round1(SECTIONS.reduce((a, k) => a + scores[k].score, 0));
  const max_total = round1(SECTIONS.reduce((a, k) => a + scores[k].max, 0));
  return { scores, total, max_total, results };
}

/** Dernier résultat d'examen publié pour cet étudiant (null si rien n'est publié). */
export async function latestExamResult(userId, courseId) {
  const row = (await q(
    `SELECT x.id, x.title, x.results_published_at, a.scores, a.total, a.max_total
     FROM exams x JOIN exam_attempts a ON a.exam_id=x.id AND a.user_id=$2 AND a.submitted_at IS NOT NULL
     WHERE x.course_id=$1 AND x.results_published_at IS NOT NULL
     ORDER BY x.results_published_at DESC LIMIT 1`, [courseId, userId])).rows[0];
  return row ? { id: row.id, title: row.title, published_at: row.results_published_at, scores: row.scores, total: Number(row.total), max_total: Number(row.max_total) } : null;
}
