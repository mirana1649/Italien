import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

// Langue d'étude de l'étudiant : français, italien ou anglais (interface + traduction du vocabulaire)
export const LANGS = { fr: 'Français', it: 'Italiano', en: 'English' };

const D = {
  fr: {
    nav_home: 'Accueil', nav_vocab: 'Vocabulaire', nav_agency: 'Agence', quit: 'Quitter', theme: 'Mode clair / sombre', lang: 'Langue',
    loading: 'Chargement…', back_home: '← Retour à l’accueil',
    morning: 'Buongiorno', afternoon: 'Buon pomeriggio', evening: 'Buonasera',
    streak_msg: (n) => `Série de ${n} jours : continue comme ça.`, streak_none: 'Une petite séance aujourd’hui ?',
    streak: 'Série', days: (n) => `${n} jour${n > 1 ? 's' : ''}`, level: 'Niveau',
    xp_next: (n) => `${n} XP avant le niveau suivant`,
    start: 'Commencer la séance', resume: 'Continuer la séance',
    no_enroll: 'L’administration doit encore t’inscrire à un cours et t’attribuer un professeur. Reviens bientôt.',
    declared: 'Ton niveau déclaré',
    exam_soon: 'Bientôt', exam_tag: 'Examen', exam_over: 'Examen passé', exam_result: 'Résultat d’examen', out_of: 'sur 72',
    d: 'jours', h: 'heures', m: 'min', s: 'sec', revise: 'Révise bien tes leçons.',
    news: 'Annonces', news_important: 'Annonce importante', no_news: 'Aucune annonce pour le moment.',
    agency_tag: 'Agence', agency_mine: 'Ma démarche vers l’Italie', agency_new: 'Ton projet d’études en Italie',
    agency_text_joined: (a, b) => `${a} étape${a > 1 ? 's' : ''} sur ${b} terminée${a > 1 ? 's' : ''}. Continue : bourse, visa, logement, inscription.`,
    agency_text_new: 'Bourse, visa, logement, inscription à l’université : suis chaque démarche avec l’agence.',
    agency_go: 'Entrer dans l’agence', agency_go2: 'Continuer ma démarche',
    space: 'Mon espace de cours', current: 'Séance en cours', open_lesson: 'Ouvrir la leçon', no_session: 'Aucune séance disponible pour le moment.',
    st_lesson: 'Leçon', st_listen: 'Écoute', st_exo: 'Exercice', st_oral: 'Oral',
    notes: 'Mes notes', exo: 'Exercice /25', listen: 'Écoute /25', oral: 'Oral /22', comment_of: (n) => `Commentaire de ${n}`,
    presence: 'Ma présence', present_today: 'Présent(e) aujourd’hui', mark_present: 'Je suis présent(e) aujourd’hui', presence_ok: 'Présence enregistrée.',
    presence_n: (n) => `${n} présence${n > 1 ? 's' : ''} au total · 14 derniers jours`,
    my_course: 'Mon cours', course: 'Cours', teacher: 'Professeur', to_assign: 'À attribuer',
    sessions_done: (a, b) => `${a} séance${a > 1 ? 's' : ''} terminée${a > 1 ? 's' : ''} · ${b} restantes`,
    word: 'Mot du jour', review_cards: 'Réviser mes cartes', ranking: 'Classement', me: 'moi', badges: 'Mes badges',
    vocab_title: 'Mon vocabulaire', vocab_help: 'Retournez les cartes, écoutez la prononciation et marquez les mots connus. Astuce : barre d’espace pour retourner, flèches pour naviguer.',
    fc_learned: (a, b) => `${a} / ${b} mots appris`, fc_only: 'Seulement ceux à revoir', fc_tap: 'Touchez pour voir la traduction', fc_none: 'Aucun mot de vocabulaire pour le moment.',
    fc_done: 'Bravo, plus aucun mot à revoir.', fc_again: 'À revoir', fc_know: 'Je sais', fc_all: 'Tous les mots sont appris !',
    ag_title: 'Agence Madagascar → Italia', ag_sub: 'Bourses, visa accompagné, logement étudiant, inscription dans une université publique italienne : chaque démarche est ici, étape par étape.',
    ag_progress: (a, b, p) => `${a} / ${b} démarches terminées · ${p}%`, ag_wa: 'Contacter l’agence sur WhatsApp',
    ag_join_t: 'Tu veux suivre la démarche avec l’agence ?', ag_join_p: 'Ton suivi s’active et tu peux cocher chaque étape terminée. L’agence voit ton avancement et t’accompagne.', ag_join: 'Oui, je veux suivre la démarche',
    ag_empty: 'L’agence n’a pas encore publié de démarches.', ag_link: 'Ouvrir le lien →', ag_welcome: 'Bienvenue dans l’agence.', ag_done: (c) => `${c} : terminé !`,
    cat_inscription: 'Inscription université', cat_bourse: 'Bourse d’études', cat_visa: 'Visa étudiant', cat_logement: 'Logement', cat_accompagnement: 'Accompagnement & départ',
    foot_tag: 'Ton avenir ne s’arrête pas au bac. Il commence maintenant.', foot_nav: 'Navigation', foot_contact: 'Contact', foot_rights: 'Tous droits réservés.',
    tab_lesson: 'Leçon', tab_vocab: 'Vocabulaire', tab_listening: 'Écoute', tab_exercise: 'Exercice écrit', tab_oral: 'Oral', tab_result: 'Résultat',
    prev: '← Précédent', next: 'Étape suivante →', lesson_done: 'J’ai terminé la leçon → exercices', lesson_h: 'La leçon', session_back: '← Retour à l’accueil', lesson_pdf: 'Leçon en PDF', pdf_open: 'Ouvrir le PDF', pdf_fallback: 'Si le PDF ne s’affiche pas ici, ouvre-le avec le bouton.',
    end_session: 'Terminer la séance', session_done: 'Séance terminée', back_btn: 'Super, retour à l’accueil', new_badge: 'Nouveau badge',
    study_lang: 'Langue d’étude',
    nav_exam: 'Examen', total_note: 'Total /72',
    ex_title: 'Mes examens', ex_none: 'Aucun examen pour le moment.', ex_open: 'Ouvert', ex_upcoming: 'À venir', ex_wait: 'Résultats bientôt annoncés', ex_missed: 'Non passé', ex_done: 'Résultats publiés', ex_side: 'Mes résultats', ex_side_total: 'Total', ex_side_none: 'Tes notes par partie et ton total sur 72 apparaîtront ici dès que les résultats seront annoncés.', ex_side_more: 'Autres examens',
    ex_start: 'Passer l’examen', ex_resume: 'Reprendre l’examen', ex_see: 'Voir mes résultats', ex_minutes: (n) => `${n} min`, ex_questions: (n) => `${n} question${n > 1 ? 's' : ''}`,
    ex_intro: 'Tu as une seule tentative. Le chronomètre démarre dès que tu commences et ne s’arrête plus. À la fin du temps, l’examen est envoyé automatiquement.',
    ex_begin: 'Commencer maintenant', ex_left: 'Temps restant', ex_part_lettura: 'Lettura', ex_part_ascolto: 'Ascolto', ex_part_struttura: 'Struttura',
    ex_sub_lettura: 'Lecture', ex_sub_ascolto: 'Écoute', ex_sub_struttura: 'Grammaire', ex_listen_hint: 'Écoute l’audio puis réponds aux questions.', ex_read_hint: 'Lis le texte puis réponds aux questions.',
    ex_answered: (a, b) => `${a} / ${b} réponses`, ex_send: 'Envoyer mon examen', ex_confirm_t: 'Envoyer l’examen ?', ex_confirm_p: (n) => (n ? `Il te reste ${n} question${n > 1 ? 's' : ''} sans réponse. Après l’envoi, tu ne pourras plus modifier.` : 'Toutes les questions ont une réponse. Après l’envoi, tu ne pourras plus modifier.'),
    ex_cancel: 'Continuer l’examen', ex_sent: 'Examen envoyé !', ex_sent_p: 'Bravo. Ta note sera annoncée ici dès que l’administration publiera les résultats.', ex_back: 'Retour aux examens',
    ex_result_t: 'Résultats de l’examen', ex_new_result: 'Résultats disponibles', ex_new_result_p: (t) => `Les résultats de « ${t} » viennent d’être annoncés.`, ex_review: 'Correction détaillée', ex_your_answer: 'Ta réponse', ex_expected: 'Réponse attendue', ex_no_answer: 'Pas de réponse', ex_late: 'Rendu après la fin du temps.',
    ex_write: 'Écris ta réponse', ex_order_hint: 'Touche les mots dans l’ordre',
  },
  it: {
    nav_home: 'Home', nav_vocab: 'Vocabolario', nav_agency: 'Agenzia', quit: 'Esci', theme: 'Tema chiaro / scuro', lang: 'Lingua',
    loading: 'Caricamento…', back_home: '← Torna alla home',
    morning: 'Buongiorno', afternoon: 'Buon pomeriggio', evening: 'Buonasera',
    streak_msg: (n) => `Serie di ${n} giorni: continua così.`, streak_none: 'Una piccola lezione oggi?',
    streak: 'Serie', days: (n) => `${n} giorn${n > 1 ? 'i' : 'o'}`, level: 'Livello',
    xp_next: (n) => `${n} XP al livello successivo`,
    start: 'Inizia la lezione', resume: 'Continua la lezione',
    no_enroll: 'L’amministrazione deve ancora iscriverti a un corso e assegnarti un insegnante. Torna presto.',
    declared: 'Il tuo livello dichiarato',
    exam_soon: 'Presto', exam_tag: 'Esame', exam_over: 'Esame concluso', exam_result: 'Risultato dell’esame', out_of: 'su 72',
    d: 'giorni', h: 'ore', m: 'min', s: 'sec', revise: 'Ripassa bene le lezioni.',
    news: 'Annunci', news_important: 'Annuncio importante', no_news: 'Nessun annuncio al momento.',
    agency_tag: 'Agenzia', agency_mine: 'Il mio percorso verso l’Italia', agency_new: 'Il tuo progetto di studi in Italia',
    agency_text_joined: (a, b) => `${a} ${a > 1 ? 'passaggi completati' : 'passaggio completato'} su ${b}. Continua: borsa, visto, alloggio, iscrizione.`,
    agency_text_new: 'Borsa di studio, visto, alloggio, iscrizione all’università: segui ogni pratica con l’agenzia.',
    agency_go: 'Entra nell’agenzia', agency_go2: 'Continua il mio percorso',
    space: 'Il mio spazio corsi', current: 'Lezione in corso', open_lesson: 'Apri la lezione', no_session: 'Nessuna lezione disponibile al momento.',
    st_lesson: 'Lezione', st_listen: 'Ascolto', st_exo: 'Esercizio', st_oral: 'Orale',
    notes: 'I miei voti', exo: 'Esercizio /25', listen: 'Ascolto /25', oral: 'Orale /22', comment_of: (n) => `Commento di ${n}`,
    presence: 'La mia presenza', present_today: 'Presente oggi', mark_present: 'Sono presente oggi', presence_ok: 'Presenza registrata.',
    presence_n: (n) => `${n} presenz${n > 1 ? 'e' : 'a'} in totale · ultimi 14 giorni`,
    my_course: 'Il mio corso', course: 'Corso', teacher: 'Insegnante', to_assign: 'Da assegnare',
    sessions_done: (a, b) => `${a} ${a > 1 ? 'lezioni completate' : 'lezione completata'} · ${b} rimaste`,
    word: 'Parola del giorno', review_cards: 'Ripassa le mie carte', ranking: 'Classifica', me: 'io', badges: 'I miei badge',
    vocab_title: 'Il mio vocabolario', vocab_help: 'Gira le carte, ascolta la pronuncia e segna le parole che conosci. Suggerimento: barra spaziatrice per girare, frecce per scorrere.',
    fc_learned: (a, b) => `${a} / ${b} parole imparate`, fc_only: 'Solo quelle da ripassare', fc_tap: 'Tocca per vedere la traduzione', fc_none: 'Nessuna parola di vocabolario per ora.',
    fc_done: 'Bravo, nessuna parola da ripassare.', fc_again: 'Da ripassare', fc_know: 'Lo so', fc_all: 'Tutte le parole sono imparate!',
    ag_title: 'Agenzia Madagascar → Italia', ag_sub: 'Borse di studio, visto accompagnato, alloggio studentesco, iscrizione a un’università pubblica italiana: ogni pratica è qui, passo dopo passo.',
    ag_progress: (a, b, p) => `${a} / ${b} pratiche completate · ${p}%`, ag_wa: 'Contatta l’agenzia su WhatsApp',
    ag_join_t: 'Vuoi seguire il percorso con l’agenzia?', ag_join_p: 'Il tuo monitoraggio si attiva e puoi spuntare ogni passaggio completato. L’agenzia vede i tuoi progressi e ti accompagna.', ag_join: 'Sì, voglio seguire il percorso',
    ag_empty: 'L’agenzia non ha ancora pubblicato pratiche.', ag_link: 'Apri il link →', ag_welcome: 'Benvenuto nell’agenzia.', ag_done: (c) => `${c}: completato!`,
    cat_inscription: 'Iscrizione all’università', cat_bourse: 'Borsa di studio', cat_visa: 'Visto studentesco', cat_logement: 'Alloggio', cat_accompagnement: 'Accompagnamento e partenza',
    foot_tag: 'Il tuo futuro non finisce con il diploma. Inizia adesso.', foot_nav: 'Navigazione', foot_contact: 'Contatti', foot_rights: 'Tutti i diritti riservati.',
    tab_lesson: 'Lezione', tab_vocab: 'Vocabolario', tab_listening: 'Ascolto', tab_exercise: 'Esercizio scritto', tab_oral: 'Orale', tab_result: 'Risultato',
    prev: '← Indietro', next: 'Passo successivo →', lesson_done: 'Ho finito la lezione → esercizi', lesson_h: 'La lezione', session_back: '← Torna alla home', lesson_pdf: 'Lezione in PDF', pdf_open: 'Apri il PDF', pdf_fallback: 'Se il PDF non si vede qui, aprilo con il pulsante.',
    end_session: 'Termina la lezione', session_done: 'Lezione terminata', back_btn: 'Ottimo, torna alla home', new_badge: 'Nuovo badge',
    study_lang: 'Lingua di studio',
    nav_exam: 'Esame', total_note: 'Totale /72',
    ex_title: 'I miei esami', ex_none: 'Nessun esame per ora.', ex_open: 'Aperto', ex_upcoming: 'In arrivo', ex_wait: 'Risultati a breve', ex_missed: 'Non svolto', ex_done: 'Risultati pubblicati', ex_side: 'I miei risultati', ex_side_total: 'Totale', ex_side_none: 'I tuoi voti per parte e il totale su 72 compariranno qui appena i risultati saranno annunciati.', ex_side_more: 'Altri esami',
    ex_start: 'Svolgi l’esame', ex_resume: 'Riprendi l’esame', ex_see: 'Vedi i miei risultati', ex_minutes: (n) => `${n} min`, ex_questions: (n) => `${n} domand${n > 1 ? 'e' : 'a'}`,
    ex_intro: 'Hai un solo tentativo. Il timer parte appena inizi e non si ferma. Allo scadere del tempo l’esame viene inviato automaticamente.',
    ex_begin: 'Inizia adesso', ex_left: 'Tempo rimasto', ex_part_lettura: 'Lettura', ex_part_ascolto: 'Ascolto', ex_part_struttura: 'Struttura',
    ex_sub_lettura: 'Lettura', ex_sub_ascolto: 'Ascolto', ex_sub_struttura: 'Grammatica', ex_listen_hint: 'Ascolta l’audio e rispondi alle domande.', ex_read_hint: 'Leggi il testo e rispondi alle domande.',
    ex_answered: (a, b) => `${a} / ${b} risposte`, ex_send: 'Invia il mio esame', ex_confirm_t: 'Inviare l’esame?', ex_confirm_p: (n) => (n ? `Ti ${n > 1 ? 'restano' : 'resta'} ${n} domand${n > 1 ? 'e' : 'a'} senza risposta. Dopo l’invio non potrai più modificare.` : 'Tutte le domande hanno una risposta. Dopo l’invio non potrai più modificare.'),
    ex_cancel: 'Continua l’esame', ex_sent: 'Esame inviato!', ex_sent_p: 'Bravo. Il tuo voto sarà annunciato qui appena l’amministrazione pubblicherà i risultati.', ex_back: 'Torna agli esami',
    ex_result_t: 'Risultati dell’esame', ex_new_result: 'Risultati disponibili', ex_new_result_p: (t) => `I risultati di «${t}» sono appena stati annunciati.`, ex_review: 'Correzione dettagliata', ex_your_answer: 'La tua risposta', ex_expected: 'Risposta attesa', ex_no_answer: 'Nessuna risposta', ex_late: 'Consegnato dopo la fine del tempo.',
    ex_write: 'Scrivi la tua risposta', ex_order_hint: 'Tocca le parole nell’ordine giusto',
  },
  en: {
    nav_home: 'Home', nav_vocab: 'Vocabulary', nav_agency: 'Agency', quit: 'Log out', theme: 'Light / dark mode', lang: 'Language',
    loading: 'Loading…', back_home: '← Back to home',
    morning: 'Buongiorno', afternoon: 'Buon pomeriggio', evening: 'Buonasera',
    streak_msg: (n) => `${n}-day streak: keep it up.`, streak_none: 'A short lesson today?',
    streak: 'Streak', days: (n) => `${n} day${n > 1 ? 's' : ''}`, level: 'Level',
    xp_next: (n) => `${n} XP to the next level`,
    start: 'Start the lesson', resume: 'Continue the lesson',
    no_enroll: 'The administration still has to enrol you in a course and assign a teacher. Come back soon.',
    declared: 'Your declared level',
    exam_soon: 'Soon', exam_tag: 'Exam', exam_over: 'Exam over', exam_result: 'Exam result', out_of: 'out of 72',
    d: 'days', h: 'hours', m: 'min', s: 'sec', revise: 'Review your lessons well.',
    news: 'Announcements', news_important: 'Important announcement', no_news: 'No announcements right now.',
    agency_tag: 'Agency', agency_mine: 'My path to Italy', agency_new: 'Your study project in Italy',
    agency_text_joined: (a, b) => `${a} of ${b} step${b > 1 ? 's' : ''} completed. Keep going: scholarship, visa, housing, enrolment.`,
    agency_text_new: 'Scholarship, visa, housing, university enrolment: follow each step with the agency.',
    agency_go: 'Enter the agency', agency_go2: 'Continue my journey',
    space: 'My course area', current: 'Current lesson', open_lesson: 'Open the lesson', no_session: 'No lesson available right now.',
    st_lesson: 'Lesson', st_listen: 'Listening', st_exo: 'Exercise', st_oral: 'Speaking',
    notes: 'My grades', exo: 'Exercise /25', listen: 'Listening /25', oral: 'Speaking /22', comment_of: (n) => `Comment from ${n}`,
    presence: 'My attendance', present_today: 'Present today', mark_present: 'I am present today', presence_ok: 'Attendance recorded.',
    presence_n: (n) => `${n} attendance${n > 1 ? 's' : ''} in total · last 14 days`,
    my_course: 'My course', course: 'Course', teacher: 'Teacher', to_assign: 'To be assigned',
    sessions_done: (a, b) => `${a} lesson${a > 1 ? 's' : ''} completed · ${b} remaining`,
    word: 'Word of the day', review_cards: 'Review my cards', ranking: 'Leaderboard', me: 'me', badges: 'My badges',
    vocab_title: 'My vocabulary', vocab_help: 'Flip the cards, listen to the pronunciation and mark the words you know. Tip: space bar to flip, arrow keys to browse.',
    fc_learned: (a, b) => `${a} / ${b} words learned`, fc_only: 'Only the ones to review', fc_tap: 'Tap to see the translation', fc_none: 'No vocabulary words yet.',
    fc_done: 'Well done, nothing left to review.', fc_again: 'Review again', fc_know: 'I know it', fc_all: 'All words learned!',
    ag_title: 'Madagascar → Italia Agency', ag_sub: 'Scholarships, guided visa process, student housing, enrolment in an Italian public university: every step is here.',
    ag_progress: (a, b, p) => `${a} / ${b} steps completed · ${p}%`, ag_wa: 'Contact the agency on WhatsApp',
    ag_join_t: 'Do you want to follow the process with the agency?', ag_join_p: 'Your tracking is activated and you can tick off each completed step. The agency sees your progress and supports you.', ag_join: 'Yes, I want to follow the process',
    ag_empty: 'The agency has not published any steps yet.', ag_link: 'Open the link →', ag_welcome: 'Welcome to the agency.', ag_done: (c) => `${c}: done!`,
    cat_inscription: 'University enrolment', cat_bourse: 'Scholarship', cat_visa: 'Student visa', cat_logement: 'Housing', cat_accompagnement: 'Support & departure',
    foot_tag: 'Your future does not end with high school. It starts now.', foot_nav: 'Navigation', foot_contact: 'Contact', foot_rights: 'All rights reserved.',
    tab_lesson: 'Lesson', tab_vocab: 'Vocabulary', tab_listening: 'Listening', tab_exercise: 'Written exercise', tab_oral: 'Speaking', tab_result: 'Result',
    prev: '← Back', next: 'Next step →', lesson_done: 'I finished the lesson → exercises', lesson_h: 'The lesson', session_back: '← Back to home', lesson_pdf: 'PDF lesson', pdf_open: 'Open the PDF', pdf_fallback: 'If the PDF does not show here, open it with the button.',
    end_session: 'Finish the lesson', session_done: 'Lesson completed', back_btn: 'Great, back to home', new_badge: 'New badge',
    study_lang: 'Study language',
    nav_exam: 'Exam', total_note: 'Total /72',
    ex_title: 'My exams', ex_none: 'No exams right now.', ex_open: 'Open', ex_upcoming: 'Upcoming', ex_wait: 'Results coming soon', ex_missed: 'Not taken', ex_done: 'Results published', ex_side: 'My results', ex_side_total: 'Total', ex_side_none: 'Your score for each part and your total out of 72 will appear here once the results are announced.', ex_side_more: 'Other exams',
    ex_start: 'Take the exam', ex_resume: 'Resume the exam', ex_see: 'See my results', ex_minutes: (n) => `${n} min`, ex_questions: (n) => `${n} question${n > 1 ? 's' : ''}`,
    ex_intro: 'You have one attempt only. The timer starts as soon as you begin and never stops. When time is up, the exam is sent automatically.',
    ex_begin: 'Start now', ex_left: 'Time left', ex_part_lettura: 'Lettura', ex_part_ascolto: 'Ascolto', ex_part_struttura: 'Struttura',
    ex_sub_lettura: 'Reading', ex_sub_ascolto: 'Listening', ex_sub_struttura: 'Grammar', ex_listen_hint: 'Listen to the audio, then answer the questions.', ex_read_hint: 'Read the text, then answer the questions.',
    ex_answered: (a, b) => `${a} / ${b} answers`, ex_send: 'Submit my exam', ex_confirm_t: 'Submit the exam?', ex_confirm_p: (n) => (n ? `${n} question${n > 1 ? 's are' : ' is'} still unanswered. After submitting you cannot change anything.` : 'Every question has an answer. After submitting you cannot change anything.'),
    ex_cancel: 'Keep going', ex_sent: 'Exam submitted!', ex_sent_p: 'Well done. Your grade will appear here as soon as the administration publishes the results.', ex_back: 'Back to exams',
    ex_result_t: 'Exam results', ex_new_result: 'Results available', ex_new_result_p: (t) => `The results of “${t}” have just been announced.`, ex_review: 'Detailed correction', ex_your_answer: 'Your answer', ex_expected: 'Expected answer', ex_no_answer: 'No answer', ex_late: 'Submitted after time was up.',
    ex_write: 'Write your answer', ex_order_hint: 'Tap the words in the right order',
  },
};

const Ctx = createContext(null);
export const useLang = () => useContext(Ctx);

export function LangProvider({ children }) {
  const { user } = useAuth();
  const [lang, setL] = useState(() => localStorage.getItem('lang') || 'fr');
  useEffect(() => { if (user?.lang && D[user.lang]) { setL(user.lang); localStorage.setItem('lang', user.lang); } }, [user?.lang]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l) => {
    setL(l); localStorage.setItem('lang', l);
    if (localStorage.getItem('token')) api('/auth/lang', { method: 'PATCH', body: { lang: l } }).catch(() => {});
  }, []);
  const t = useCallback((k, ...a) => { const v = D[lang][k] ?? D.fr[k] ?? k; return typeof v === 'function' ? v(...a) : v; }, [lang]);
  // Traduction d'un mot de vocabulaire selon la langue d'étude (l'anglais retombe sur le français s'il manque)
  const meaning = useCallback((v) => (lang === 'en' ? v.en || v.fr : v.fr), [lang]);
  return <Ctx.Provider value={{ lang, setLang, t, meaning }}>{children}</Ctx.Provider>;
}

export function LangSwitch({ className = '' }) {
  const { lang, setLang, t } = useLang();
  return (
    <select className={`lang-sw ${className}`} value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('lang')} title={t('lang')}>
      {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}
