-- VIANONA ACADEMY – Schéma PostgreSQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('student','teacher','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cefr_level AS ENUM ('A1','A2','B1','B2','C1','C2'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  level cefr_level,                       -- niveau déclaré à l'inscription
  active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  level cefr_level NOT NULL,
  total_sessions INT NOT NULL DEFAULT 20,
  exam_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  teacher_id INT REFERENCES users(id) ON DELETE SET NULL,
  sessions_remaining INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  publish_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS lesson_resources (
  id SERIAL PRIMARY KEY,
  lesson_id INT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('video','written','audio','reading')),
  url TEXT,        -- lien vidéo / audio / image du manuscrit
  content TEXT     -- texte de la leçon écrite ou du texte à lire
);

CREATE TABLE IF NOT EXISTS exercises (
  id SERIAL PRIMARY KEY,
  lesson_id INT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'exercise' CHECK (kind IN ('exercise','listening','reading')),
  available_from TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  exercise_id INT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('qcm','gap','order')),
  prompt TEXT NOT NULL,
  options JSONB,            -- QCM : ["a","b","c"]
  answer JSONB NOT NULL,    -- QCM : index ; gap : "texte|variante" ; order : "phrase correcte"
  explanation TEXT,
  position INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  enrollment_id INT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lesson_id INT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  lesson_viewed BOOLEAN NOT NULL DEFAULT FALSE,
  listening_done BOOLEAN NOT NULL DEFAULT FALSE,
  exercise_done BOOLEAN NOT NULL DEFAULT FALSE,
  oral_done BOOLEAN NOT NULL DEFAULT FALSE,
  result_seen BOOLEAN NOT NULL DEFAULT FALSE,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id INT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  score NUMERIC(4,1) NOT NULL,         -- sur 25 (exercice ou écoute)
  answers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oral_submissions (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  score NUMERIC(4,1),                  -- sur 22 ; NULL = en attente de correction
  comment TEXT,
  graded_by INT REFERENCES users(id),
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  exam_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_results (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score NUMERIC(4,1) NOT NULL,
  UNIQUE (exam_id, user_id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  enrollment_id INT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  attended_on DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  course_id INT REFERENCES courses(id) ON DELETE CASCADE,  -- NULL = tous les étudiants
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_enrollment ON sessions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_session ON submissions(session_id);

-- ---------- v2 : gamification & vocabulaire ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity DATE;

CREATE TABLE IF NOT EXISTS user_badges (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code)
);

CREATE TABLE IF NOT EXISTS vocab_items (
  id SERIAL PRIMARY KEY,
  lesson_id INT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  it TEXT NOT NULL,          -- mot / expression en italien
  fr TEXT NOT NULL,          -- traduction
  example TEXT,              -- phrase d'exemple (facultatif)
  position INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vocab_progress (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vocab_id INT NOT NULL REFERENCES vocab_items(id) ON DELETE CASCADE,
  known BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, vocab_id)
);
CREATE INDEX IF NOT EXISTS idx_vocab_lesson ON vocab_items(lesson_id);

-- ---------- v3 : étudiants, présence, agence ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fee_status TEXT NOT NULL DEFAULT 'unpaid';
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_fee_status_chk CHECK (fee_status IN ('unpaid','partial','paid'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_joined BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_joined_at TIMESTAMPTZ;

-- Pointage de présence quotidien (l'étudiant clique « Je suis présent(e) »)
CREATE TABLE IF NOT EXISTS checkins (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

-- Espace Agence : démarches (bourse, visa, logement, inscription…) gérées par l'admin
CREATE TABLE IF NOT EXISTS agency_steps (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  link_url TEXT,
  position INT NOT NULL DEFAULT 1,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agency_progress (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step_id INT NOT NULL REFERENCES agency_steps(id) ON DELETE CASCADE,
  done BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, step_id)
);
CREATE INDEX IF NOT EXISTS idx_agency_steps_cat ON agency_steps(category, position);

-- ---------- v4 : langue d'étude choisie par l'étudiant (fr / it / en) ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'fr';
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_lang_chk CHECK (lang IN ('fr','it','en'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE vocab_items ADD COLUMN IF NOT EXISTS en TEXT;   -- traduction anglaise (facultatif)

-- ---------- v5 : planning des cours, leçon PDF, e-mail d'admission ----------
ALTER TABLE courses ADD COLUMN IF NOT EXISTS start_date DATE;      -- date du premier cours
ALTER TABLE courses ADD COLUMN IF NOT EXISTS start_time TIME;      -- heure des cours (heure de Madagascar)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS schedule TEXT;        -- rythme libre, ex. « Lundi et jeudi »

ALTER TABLE lesson_resources ADD COLUMN IF NOT EXISTS file_name TEXT;   -- nom d'origine du PDF
ALTER TABLE lesson_resources DROP CONSTRAINT IF EXISTS lesson_resources_type_check;
ALTER TABLE lesson_resources ADD CONSTRAINT lesson_resources_type_check CHECK (type IN ('video','written','audio','reading','pdf'));

ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS admission_email_at TIMESTAMPTZ;  -- date d'envoi de l'e-mail de confirmation

-- ---------- v6 : notes sur 72 (exercice /25 + écoute /25 + oral /22) et examens en ligne ----------
-- Un examen a 3 parties : Lettura (lecture), Ascolto (écoute), Struttura (grammaire).
-- L'admin insère les sujets ; les étudiants passent l'examen ; l'admin publie ensuite les résultats.
ALTER TABLE exams ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';        -- draft | open | closed
ALTER TABLE exams ADD COLUMN IF NOT EXISTS duration_min INT NOT NULL DEFAULT 60;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS results_published_at TIMESTAMPTZ;             -- NULL = résultats pas encore annoncés
DO $$ BEGIN
  ALTER TABLE exams ADD CONSTRAINT exams_status_chk CHECK (status IN ('draft','open','closed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS exam_sections (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('lettura','ascolto','struttura')),
  max_points NUMERIC(4,1) NOT NULL DEFAULT 25,   -- barème de la partie (25 + 25 + 22 = 72)
  instructions TEXT,
  passage TEXT,                                   -- texte à lire (Lettura)
  audio_url TEXT,                                 -- fichier audio (Ascolto)
  UNIQUE (exam_id, kind)
);
CREATE TABLE IF NOT EXISTS exam_questions (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('lettura','ascolto','struttura')),
  type TEXT NOT NULL CHECK (type IN ('qcm','gap','order')),
  prompt TEXT NOT NULL,
  options JSONB,
  answer JSONB NOT NULL,
  explanation TEXT,
  position INT NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS exam_attempts (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  late BOOLEAN NOT NULL DEFAULT FALSE,            -- rendu après la fin du temps
  answers JSONB,
  scores JSONB,                                   -- {lettura:{score,max}, ascolto:{…}, struttura:{…}}
  total NUMERIC(4,1),
  max_total NUMERIC(4,1),
  UNIQUE (exam_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id, section, position);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON exam_attempts(exam_id);
