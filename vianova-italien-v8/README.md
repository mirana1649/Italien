# Vianova Academy – Application web de cours d'italien (v6)

Stack : **React (Vite)** · **Node.js / Express** · **PostgreSQL**

## Structure
```
database/schema.sql   → toutes les tables du cahier des charges
backend/              → API REST (JWT, rôles étudiant / professeur / admin)
frontend/             → application React responsive
```

## Installation
### 1. Base de données : PostgreSQL
1. Installez PostgreSQL (https://www.postgresql.org/download/) ou lancez-le avec Docker :
   `docker run -d --name vianova-db -e POSTGRES_PASSWORD=motdepasse -e POSTGRES_DB=vianova -p 5432:5432 postgres:16`
2. Créez la base (inutile avec la commande Docker ci-dessus) : `createdb vianova`
3. Dans `backend/.env`, renseignez `DATABASE_URL=postgresql://utilisateur:motdepasse@localhost:5432/vianova`
   (ou `DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME` si le mot de passe contient des caractères spéciaux). `DB_SSL=true` uniquement pour un serveur distant qui l'exige.

En cas d'échec, lancez **`npm run db:test`** dans `backend/` : il affiche la configuration lue, teste le port, puis la connexion. Test rapide une fois l'API lancée : `http://localhost:4000/api/health/db`.

Les tables sont créées par `npm run db:init` (relançable sans risque) ou avec `psql -d vianova -f database/schema.sql`.

### 2. Backend
```bash
cd backend
cp .env.example .env      # renseigner DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm run db:test           # diagnostic de la connexion PostgreSQL (à lancer en premier)
npm run db:init           # crée les tables dans PostgreSQL
npm run seed              # crée le compte admin + un cours A1 d'exemple
npm run dev               # API sur http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

## Nouveautés v2
- **Design** aux couleurs du drapeau italien (vert #008C45, blanc #F4F5F0, rouge #CD212A), boutons « 3D », mode clair/sombre, animations (respectent « réduire les animations » du système).
- **Exercices question par question** avec barre de progression, anneau de score animé, confettis dès 70 %.
- **Gamification** : XP (premier essai d'un exercice + fin de séance), **série de jours** 🔥 (fuseau Madagascar), niveaux (Turista → Leggenda), **7 badges**, classement du groupe (prénoms seulement).
- **Vocabulaire** : cartes mémoire à retourner, prononciation italienne 🔊 (synthèse vocale du navigateur), suivi « je sais / à revoir ». L'admin ajoute les mots en vrac (`ciao = salut | Ciao Marco !`).
- **Mot du jour**, compte à rebours avant l'examen, enregistreur oral avec chronomètre et onde animée.
- **Admin** : chiffres clés (étudiants actifs, séances validées, oraux à corriger).

## Premiers pas
1. Connectez-vous avec le compte admin (celui du `.env`).
2. **Utilisateurs** → créez les professeurs (mot de passe temporaire affiché une fois).
3. Les étudiants créent eux-mêmes leur compte sur `/inscription` en **choisissant leur niveau (A1–C2)**.
4. L'admin les **inscrit à un cours** et leur attribue un professeur.
5. **Cours et leçons** → ajoutez leçons, ressources (liens vidéo/audio, textes) et exercices, puis publiez.

## Règles métier implémentées
- Seul l'admin crée des comptes professeur/admin ; l'inscription publique ne crée que des étudiants.
- Séance validée seulement si écoute + exercice + oral faits ET case « J'ai vu mon résultat » cochée ; le compteur baisse de 1, une seule fois (transaction + verrou).
- Correction automatique immédiate (QCM, texte à trous, remise en ordre) avec explication.
- Oral : enregistrement navigateur → professeur note /22 + commentaire ; « En attente de correction » tant que non noté.
- Un étudiant ne voit que ses données ; un professeur ne voit que ses étudiants.
- Alertes admin : inactif > 7 jours ou moyenne inférieure à 50 % du barème. Export CSV (ouvre dans Excel).

## À prévoir pour la mise en production
- Envoi d'emails pour la réinitialisation du mot de passe (le lien s'affiche pour l'instant dans la console du serveur).
- Fichiers envoyés (audios d'oral, PDF de leçons, audios d'examen) : stockés dans `backend/uploads/` (à sauvegarder et à conserver sur un disque persistant en production).
- Vidéos : hébergées à l'extérieur (YouTube, Vimeo…) ; coller simplement le lien dans la leçon.
- Export PDF : non inclus (CSV/Excel uniquement).
- Sauvegardes régulières de la base avec `pg_dump` (et du dossier `backend/uploads/`).


## Nouveautés v3
- **Nouveau design** inspiré de l'affiche Vianova Academy : marine, or, rouge et vert, skyline italienne animée, bandeau défilant, pastilles « Bourses / Visa / Diplôme UE ».
- **Annonce d'examen** en grand sur l'accueil de l'étudiant, avec compte à rebours en direct (jours, heures, minutes, secondes) puis affichage de la note.
- **Leçon** : vidéo à gauche, texte de la leçon à droite, puis parcours guidé (leçon → vocabulaire → écoute → exercice écrit → oral → résultat) avec boutons « Étape suivante ».
- **Présence** : bouton « Je suis présent(e) aujourd'hui » sur l'accueil de l'étudiant ; calendrier des 14 derniers jours, total visible côté admin.
- **Espace Agence** (`/agence`) : l'étudiant clique « Entrer dans l'agence », puis coche chaque démarche (inscription université, bourse, visa, logement, accompagnement). Bannière animée sur l'accueil. Seul l'admin crée/modifie les démarches (`/admin/agence`) et voit l'avancement de chaque étudiant.
- **Admin > Étudiants** (`/admin/etudiants`) : tableau complet (nom, niveau, cours, écolage payé / partiel / non payé, ville, téléphone, présences, avancement agence), recherche et filtres, modification directe.
- **Admin > Cours et leçons** : onglets par niveau A1–C2 ; une leçon se crée avec son lien vidéo et son texte en une seule fois.
- L'inscription demande maintenant la **ville / quartier** et le **téléphone**.

### Mise à jour depuis la v2
```bash
cd backend
npm run db:init   # ajoute les nouvelles colonnes et tables (sans risque, données conservées)
npm run seed      # ajoute les démarches d'agence par défaut (une seule fois)
npm run dev
```

## Nouveautés v4
- **Design sobre** : uniquement le vert, le blanc et le rouge du drapeau italien (plus de doré ni de bleu marine), presque plus d'animations, icônes réduites à celles qui servent (calendrier, micro, haut-parleur, thème).
- **Accueil étudiant** : un bandeau en 3 diapositives qui défilent toutes les 5 s en boucle (pause au survol) : 1) Bonjour, 2) Examen + annonce importante (compte à rebours), 3) Agence sur fond photo. La photo se dépose dans `frontend/public/photos/agence.jpg` ; en dessous, l'espace de cours.
- **Agence (étudiant)** : une catégorie à la fois (onglets), étapes numérotées dans l'ordre.
- **Bandeau défilant supprimé** (admin et autres espaces). **Pied de page** refait en 3 colonnes.
- **Langue d'étude** : l'étudiant choisit Français / Italiano / English (menu en haut et à l'inscription), enregistrée sur son compte. Pour l'anglais, ajouter la traduction en 3e position dans le vocabulaire : `ciao = salut = hello | Ciao Marco !`.
- **Base de données** : relancer `npm run db:init` (ajoute `users.lang` et `vocab_items.en`, sans risque).

## Nouveautés v5
- **Page d'accueil publique** (`/`) : services, fonctionnement, niveaux, et formulaire de connexion directement dessus. Une fois connecté, l'étudiant arrive dans son espace (`/espace`) ; revenir sur `/` ou `/login` le renvoie dans son espace.
- **Logo Vianova Academy** dans tous les en-têtes, pieds de page, pages de connexion/inscription et en favicon (fichiers dans `frontend/public/` et `backend/assets/logo.png` pour les e-mails).
- **Leçon en PDF** : l'admin envoie un PDF (15 Mo max) à la création d'une leçon ou via « Modifier » ; l'étudiant le lit dans sa séance.
- **E-mail d'admission** : à chaque inscription d'un étudiant à un cours, il reçoit le nom du cours, le professeur, la date de début, l'heure (heure de Madagascar) et le rythme. L'admin renseigne ce planning dans **Cours et leçons** ; le tableau des inscriptions indique si l'e-mail est parti et permet de le renvoyer.

### Mise à jour depuis la v4
```bash
cd backend
npm install               # ajoute nodemailer
cp .env.example .env      # ou reprenez votre ancien .env et ajoutez les lignes SMTP_*
npm run db:init           # ajoute planning des cours, PDF, suivi des e-mails (sans risque)
npm run dev
```
**E-mails** : renseigner `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` dans `backend/.env`. Avec Gmail : `smtp.gmail.com`, port 465, et un « mot de passe d'application » (Compte Google → Sécurité → Validation en 2 étapes). Sans SMTP, l'inscription fonctionne mais l'e-mail s'affiche seulement dans la console du serveur.
**PDF** : stockés dans `backend/uploads/`, comme les autres fichiers envoyés.


## Nouveautés v6
- **Vocabulaire** : « élèves » est remplacé par **étudiants** partout (menus, tableaux, e-mails, accueil). L'adresse admin devient `/admin/etudiants`.
- **Nouveau barème : note sur 72** = **exercice /25 + écoute /25 + oral /22**. Le professeur note l'oral sur 22 ; l'exercice et l'écoute sont corrigés automatiquement sur 25. Le total /72 s'affiche sur l'accueil et dans la séance de l'étudiant, et dans le Suivi admin (colonne « Total /72 » + export CSV).
- **Page d'examen** (3 parties : **Lettura**, **Ascolto**, **Struttura**) :
  - **Admin > Examens** : créer l'examen (cours, date, durée), insérer les sujets de chaque partie (texte à lire pour Lettura, fichier audio ou lien pour Ascolto, questions QCM / texte à trous / remise en ordre), régler le barème de chaque partie (25 + 25 + 22 par défaut), puis **Ouvrir l'examen**.
  - **Étudiant > Examen** : une seule tentative, chronomètre (basé sur l'horloge du serveur), réponses sauvegardées sur l'appareil si l'application est fermée, envoi automatique à la fin du temps, confirmation avant l'envoi. La note reste cachée tant que l'admin n'a pas annoncé les résultats.
  - **Annonce des résultats** : dans **Admin > Examens > Résultats**, le bouton « Annoncer les résultats » publie les notes (par partie et total /72) : une annonce est créée, une bannière apparaît sur l'accueil de chaque étudiant, avec fenêtre de félicitations (une seule fois) et la correction détaillée question par question. « Retirer l'annonce » les masque de nouveau ; « Repasser » autorise un étudiant à refaire l'examen (coupure de connexion par exemple).
- **Animations** : cartes qui se soulèvent, bouton « Passer l'examen » qui pulse, chronomètre qui clignote sous 5 minutes, coche qui se dessine à l'envoi, notes qui montent en compteur, barres avec reflet, bandeau de résultat brillant, lueur douce sur le bandeau d'accueil. Toutes respectent « réduire les animations » du système.

### Mise à jour depuis la v5
```bash
cd backend
npm run db:init           # ajoute les tables d'examen (sans risque, données conservées)
npm run dev
```
Si vous aviez **déjà des notes** enregistrées sur l'ancien barème (/20), exécutez **une seule fois** `database/migrate-notes-72.sql` avec `psql -d vianova -f database/migrate-notes-72.sql` pour les convertir (exercice et écoute → /25, oral → /22). Sans notes existantes, ignorez ce fichier. Les examens créés avant la v6 restent visibles comme « à venir » et passent au nouveau système dès que vous leur ajoutez des sujets.

## Nouveautés v8
- **Accueil › Nos services** : « Apprendre l'italien » s'affiche en premier ; toutes les 6 s il part vers la gauche, « Partir en Italie » monte et ses titres apparaissent un par un, puis retour au premier (boucle). Pause au survol, onglets cliquables. Composant : `frontend/src/components/ServicesSlider.jsx`.
- **Partir en Italie** : les 9 services de l'affiche (orientation → visa long séjour étudiant) + WhatsApp / Facebook. Textes : `landingCopy.js` (FR / IT / EN).
- **Examen (étudiant)** : colonne de droite « Mes résultats » avec la note de chaque partie (Lettura 25, Ascolto 25, Struttura 22) et le total /72, une fois les résultats annoncés par l'admin. L'accueil étudiant affiche aussi les notes par partie.
