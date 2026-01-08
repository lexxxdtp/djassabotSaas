# 🚀 GUIDE DE DÉPLOIEMENT (Mise en ligne)

Ce guide vous explique comment mettre votre projet en ligne sur **Railway (Backend)** et **Vercel (Frontend)**.

---

## Etape 1 : Préparer le code sur GitHub

1.  Assurez-vous d'avoir créé un compte GitHub et d'être connecté.
2.  Allez sur [https://github.com/new](https://github.com/new) et créez un nouveau repository (ex: `tdjaasa-saas`).
    *   Laissez-le en **Public** ou **Private** (votre choix).
3.  Dans votre terminal, tapez ces commandes :
    ```bash
    git init
    git add .
    git commit -m "Initial launch"
    git branch -M main
    git remote add origin https://github.com/VOTRE_USER/tdjaasa-saas.git
    git push -u origin main
    ```
    *(Remplacez `VOTRE_USER` par votre pseudo GitHub)*

---

## Etape 2 : Déployer le Backend sur Railway

1.  Allez sur [https://railway.app](https://railway.app) et connectez-vous avec GitHub.
2.  Cliquez sur **"New Project"** -> **"Deploy from GitHub repo"**.
3.  Sélectionnez votre repo `tdjaasa-saas`.
4.  Railway va détecter deux dossiers (`backend` et `frontend`). Il faut lui dire de ne déployer que le **backend** ici.
    *   Cliquez sur **"Variable Settings"** (ou Settings) -> **"Root Directory"**.
    *   Mettez : `/backend`.
5.  **Variables d'Environnement** :
    *   Allez dans l'onglet **"Variables"**.
    *   Ajoutez toutes les clés de votre fichier `backend/.env` :
        *   `PORT` = `3000` (ou laissez vide, Railway gère le port souvent, mais mettez 3000 par sécurité)
        *   `JWT_SECRET` = `(inventez un truc compliqué)`
        *   `GEMINI_API_KEY` = `(votre clé Google AI de aistudio.google.com)`
        *   `SUPABASE_URL` = `(votre url supabase)`
        *   `SUPABASE_KEY` = `(votre clé anon)`
6.  Cliquez sur **Deploy**.
    *   Attendez que ça passe au vert ("Active").
    *   Railway va vous donner une URL publique (ex: `https://backend-production.up.railway.app`). Copiez-la.

---

## Etape 3 : Déployer le Frontend sur Vercel

1.  Allez sur [https://vercel.com](https://vercel.com) et connectez-vous avec GitHub.
2.  Cliquez sur **"Add New..."** -> **"Project"**.
3.  Importez votre repo `tdjaasa-saas`.
4.  **Important** : Configurez le dossier racine (Root Directory).
    *   Cliquez sur "Edit" à côté de **Root Directory**.
    *   Choisissez le dossier `frontend`.
5.  **Variables d'Environnement** :
    *   Dépliez la section **"Environment Variables"**.
    *   Ajoutez :
        *   `VITE_API_URL` = `(collez l'URL Railway de l'étape 2 sans le slash à la fin)`
        *   Ex: `https://backend-production.up.railway.app`
6.  Cliquez sur **"Deploy"**.
    *   Vercel va construire le site.
    *   En 1 minute, vous aurez une URL (ex: `https://tdjaasa-saas.vercel.app`).

---

## Etape 4 : Vérification Finale

1.  Ouvrez votre lien Vercel sur votre téléphone.
2.  Créez un compte test.
3.  Allez dans "WhatsApp Connect" et scannez le QR code avec votre vrai WhatsApp.
4.  Envoyez une note vocale "Test test" à votre numéro.
5.  Si le bot répond : **CHAMPAGNE ! 🍾**

---

## Besoin d'aide pour une variable ?
Si vous avez perdu vos clés Supabase ou Gemini, demandez-moi, je peux peut-être les retrouver dans l'historique de notre conversation.
