-- À exécuter UNE SEULE FOIS, et seulement si vous aviez déjà des notes enregistrées avec l'ancien barème (/20).
-- Convertit les notes existantes : exercice et écoute /20 -> /25, oral /20 -> /22.
-- Ne la relancez pas : chaque exécution convertirait encore une fois les notes.
BEGIN;
UPDATE submissions SET score = ROUND(score * 25 / 20, 1);
UPDATE oral_submissions SET score = ROUND(score * 22 / 20, 1) WHERE score IS NOT NULL;
COMMIT;
