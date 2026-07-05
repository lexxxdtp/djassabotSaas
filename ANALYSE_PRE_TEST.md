# 🔍 DjassaBot — Analyse pré-test (audit complet)

> Audit d'architecture réalisé le **5 juillet 2026** pour répondre à une seule question :
> **« Qu'est-ce qui manque VRAIMENT avant de mettre l'app entre les mains de testeurs mercredi ? »**
>
> Dossier audité : `/Users/alexvianneykoffi/djassabotSaas` (le projet actif — pas `djassabotSaas-1`).
> Ce document est un **plan d'action** à donner tel quel à une session de code.

---

## 0. Verdict en une phrase

**Le cœur du produit (bot IA, moteur de vente, WhatsApp, dashboard) est solide et déjà durci.**
Ce qui manque n'est PAS du code produit — ce sont **3 branchements d'infrastructure** (emails, paiement, SMS)
et **1 trou stratégique** (rien ne bloque un abonnement expiré). Aucun de ces 4 points n'exige de
réécrire l'app. Ce sont des connexions à finaliser.

**Peut-on faire tester mercredi ?** → OUI, à condition de régler les 2 bloquants d'inscription
(emails + le mur de vérification). Le paiement peut attendre le lancement réel (les testeurs ne paient pas).

---

## 1. ✅ Ce qui est SOLIDE — NE PAS y toucher avant le test

Ne perds pas de temps là-dessus, c'est fait et testé :

| Domaine | État |
|---|---|
| Moteur de vente (IA propose / serveur dispose, plancher prix, stock, livraison) | ✅ 30 tests unitaires, durci le 1er juillet |
| Connexion WhatsApp (Baileys) + reconnexion + watchdog + backup nocturne | ✅ |
| Sécurité auth (JWT, bcrypt, rate-limiting 20/15min + OTP 5/10min) | ✅ |
| Vérification serveur des OTP téléphone (Firebase Admin) | ✅ code correct |
| Anti-fraude reçus Wave/OM (anti-réutilisation transaction) | ✅ |
| Bot en pause par défaut (`bot_active`) + interrupteur | ✅ |
| Webhook Paystack (signature HMAC constante-time) | ✅ code correct |
| Pages légales (`/conditions`, `/confidentialite`) + FAQ in-app | ✅ |
| Refonte UI mobile-first PWA (design system noir/vert cohérent) | ✅ |
| Multi-tenant (filtrage `tenantId` partout) | ✅ |

---

## 2. 🔴 BLOQUANTS — à régler AVANT de laisser un testeur s'inscrire

### B1. Les emails ne partent que vers TON adresse (bloquant n°1)
- **Preuve :** `backend/src/services/resendService.ts` — l'expéditeur est **codé en dur** à
  `onboarding@resend.dev` dans **les 4 fonctions** (`sendOtpEmail`, `sendVerificationEmail`,
  `sendPasswordResetEmail`, `sendBotDownAlert`).
- `onboarding@resend.dev` est l'adresse bac-à-sable de Resend : elle **ne délivre qu'à ton propre
  compte** (anadorbreak@gmail.com). Tout autre testeur ne reçoit **jamais** son code.
- **⚠️ Ce n'est PAS qu'un problème de DNS.** Même après avoir vérifié ton domaine dans Resend,
  il faut **changer le code** aux 4 endroits pour mettre `DjassaBot <no-reply@ton-domaine.com>`.
- **À faire :**
  1. Acheter le domaine + le vérifier dans Resend (ajouter les 3 enregistrements DNS : MX/TXT/DKIM).
  2. Remplacer les 4 `from: 'DjassaBot <onboarding@resend.dev>'` par ton adresse de domaine.
     → Idéalement, sortir l'adresse dans une variable d'env `RESEND_FROM` pour ne plus jamais y retoucher.
  3. Ajouter `RESEND_API_KEY` (la vraie clé) dans le `.env` du VPS s'il n'y est pas.

### B2. La page « Vérifiez votre compte » est un mur SANS issue de secours
- **Preuve :** `frontend/src/pages/VerifyAccount.tsx`. Après inscription, l'utilisateur atterrit ici
  et **ne peut avancer que s'il valide un code email OU téléphone**. La seule autre option affichée
  est **« Se déconnecter »**. Pas de bouton « passer / plus tard ».
- Conséquence : tant que B1 (email) et B3 (SMS) ne marchent pas, **aucun testeur ne peut entrer**,
  même si le backend lui a déjà donné un token valide (voir note ci-dessous).
- **Note importante :** côté backend, `signup` (`authController.ts:78-91`) crée déjà le compte, le trial
  30 jours, et **renvoie un token utilisable**. La vérification email/téléphone n'est **pas** exigée par
  le serveur pour utiliser l'app. Le blocage est **100% frontend** (cette page).
- **2 options :**
  - **(Recommandé, propre)** régler B1 → l'onglet **E-mail** de cette page marchera pour tout le monde.
  - **(Filet de sécurité)** ajouter un bouton temporaire « Vérifier plus tard » qui `navigate('/onboarding')`,
    à retirer après la phase de test. Utile si le domaine n'est pas prêt mercredi matin.

### B3. Inscription par SMS cassée (Firebase `auth/error-code:-39`)
- Le code frontend + backend est correct ; le blocage est **dans la config du projet Firebase**
  `gen-lang-client-0191931206` (projet auto-généré par Google AI Studio, trop bridé pour l'Auth SMS).
- **Décision à prendre :** ne bloque PAS le test là-dessus. Si l'email (B1) marche, **le SMS n'est pas
  indispensable pour mercredi** — l'onglet E-mail suffit. Traite le SMS après.
- **Quand tu t'y attaques**, la piste la plus fiable = **créer un projet Firebase propre**
  (`djassabot-prod`) depuis la console Firebase (PAS depuis AI Studio), puis refaire : service account
  côté VPS + 7 variables `VITE_FIREBASE_*` sur Vercel + domaine dans « Authorized domains ».
  Le `projectId` doit être **identique** des deux côtés.

---

## 3. 🟠 IMPORTANT — trou stratégique à corriger vite (avant d'encaisser)

### S1. RIEN ne bloque un abonnement expiré → le produit est gratuit à vie
C'est le point le plus important **après** les bloquants d'inscription. Aujourd'hui :
- Le middleware `backend/src/middleware/auth.ts` ne vérifie **que la validité du JWT** — jamais le
  statut du tenant ni l'expiration de l'abonnement.
- Le bot (`messageHandler.ts:66`) ne regarde **que** `botActive` — jamais l'abonnement.
- Le webhook Paystack `subscription.disable` ne fait **qu'un `console.log`** (`paystackService.ts`) :
  aucune désactivation réelle.
- **Aucun cron** ne passe les tenants en `expired` quand `expiresAt` est dépassé.

→ Résultat : un vendeur peut s'inscrire (trial 30 j) et **utiliser le bot indéfiniment sans jamais payer**.
   Pour une phase de test gratuite c'est OK ; **avant le lancement payant, c'est à coder.**
- **À faire (après le test) :**
  1. Un cron quotidien qui lit `subscriptions.expiresAt` et passe le tenant en `expired` + coupe le bot.
  2. Un middleware (ou check dans le flux bot) qui refuse de répondre si `status = expired`.
  3. Câbler `subscription.disable` / échec de renouvellement Paystack pour marquer `expired`.
  4. Email de relance J-3 / J-0 (utilise déjà Resend).

### S2. Paystack en clés TEST + plans inexistants
- `.env` : `PAYSTACK_SECRET_KEY=sk_test_xxxxx` et `PAYSTACK_PLAN_*=PLN_..._code` (placeholders).
- `initializeSubscription` **lève une erreur** si le plan code est vide → l'abonnement ne peut pas
  s'initialiser, même en test.
- **Non bloquant pour mercredi** (les testeurs ne paient pas). Mais pour encaisser :
  1. Passer en clés **live**.
  2. Créer les 3 plans (5 000 / 10 000 / 15 000 FCFA) dans le dashboard Paystack et coller leurs
     `PLN_...` dans le `.env` du VPS.
  3. Enregistrer l'URL du webhook `https://<ton-domaine>/api/paystack/webhook` côté Paystack.
  4. Faire **un vrai paiement de test** à petit montant.
  - ⚠️ Vérifie aussi que **Paystack supporte bien les comptes marchands en Côte d'Ivoire** pour ton cas
    (encaissement mobile money Wave/OM). Si non → prévoir un plan B paiement (lien Wave manuel) pour le lancement.

---

## 4. 🟡 À VÉRIFIER sur le VPS ce soir (config, pas du code)

Ces points ne se voient pas dans le code local — ils dépendent du `.env` et de l'état du serveur :

- [ ] **`GEMINI_API_KEY`** : le `.env` local a un placeholder. **Confirme que le VPS a la vraie clé**
      (sinon le bot ne répond jamais — `aiService.ts` log « No valid GEMINI_API_KEY »). Modèle utilisé :
      `gemini-2.5-flash`.
- [ ] **`JWT_SECRET`** : doit être le secret fort (pas le défaut `tdjaasa-super-secret...`).
- [ ] **`SUPABASE_KEY`** : doit être la clé **service_role** (le local en a une valide — vérifie le VPS,
      surtout AVANT d'appliquer la migration RLS, sinon le dashboard casse).
- [ ] **`RESEND_API_KEY`** + **`FIREBASE_SERVICE_ACCOUNT_PATH`** présents sur le VPS.
- [ ] **`NODE_ENV=production`** (désactive `/api/debug/seed`).
- [ ] **`pm2 startup` + `pm2 save`** actifs (survie au reboot) — normalement fait le 11/06, à re-confirmer.
- [ ] **Bucket Supabase Storage `product-images`** existe et est **public** (sinon upload photo KO).

### Migrations SQL
- `database/migrations/add_adjust_stock_rpc.sql` — **stock atomique**. D'après la dernière session
  vérifiée (2 juillet), cette fonction est **déjà appliquée et prouvée correcte en prod Supabase**.
  → **À confirmer seulement** (SQL Editor : la fonction `adjust_stock` existe-t-elle bien ?). Le CLAUDE.md
  qui dit « à appliquer » est périmé sur ce point.
- `database/migrations/enable_rls_defense_in_depth.sql` — **RLS**, toujours **non appliquée**.
  ⚠️ N'applique QUE si le `.env` VPS
  utilise bien la clé service_role, et **teste le dashboard juste après**. Non urgent pour 10 testeurs
  (le backend filtre déjà par `tenantId`), mais à faire avant d'ouvrir en grand.

---

## 5. 🟢 Dette technique connue — NE PAS toucher avant le test

À laisser tranquille pour l'instant (aucun impact sur un test à 10 vendeurs) :
- Bundle frontend un peu lourd (client Supabase de 169 KB pour les uploads — migrable vers le backend plus tard).
- Table `customers` créée mais inutilisée (CRM léger futur, ou à drop).
- `console.log` à nettoyer (ProductDetail, Settings, Inbox).
- Marketing UI mockée (mais le backend paniers abandonnés tourne réellement en cron 30 min).
- Codes promo non implémentés (retirés de l'UI, OK).
- Notifications push (nice-to-have post-test).
- Icônes PWA branded (192/512) toujours par défaut — cosmétique.
- Monitoring serveur : mettre un **UptimeRobot** (gratuit, 10 min) sur `https://187-77-171-44.nip.io/`
  pour être alerté si le VPS tombe. Recommandé mais pas bloquant.

---

## 6. 📋 Plan concret — dans l'ordre

### ⚠️ D'ABORD : déployer les dernières corrections (elles ne sont PAS en ligne)
- Le commit `ecc715b` (2ᵉ passe de vérif : 2 trous du moteur de vente + fix z-index formulaire produit)
  est **committé mais PAS pushé**. Donc ni Vercel (front) ni le VPS (back) n'ont ces correctifs.
- **À faire :** `git push origin main` (→ Vercel redéploie le front), puis sur le VPS :
  `git pull origin main && cd backend && npm install && npm run build && pm2 restart djassabot-backend`.
- Sans ça, tu testerais une version **antérieure aux derniers fixes**.

### 🌙 Ce soir (déblocage inscription)
1. **Payer le VPS** (reconduction) — sinon tout tombe. (Rappel : renouvellement Hostinger jugé cher —
   si tu migres vers Hetzner/Contabo, **sauvegarde d'abord** `auth_info_baileys/` + `.env` + `firebase-admin-key.json`.)
2. **Acheter le domaine.**
3. **Vérifier le domaine dans Resend** (3 enregistrements DNS).
4. **Modifier `resendService.ts`** : les 4 `from` → ton adresse de domaine (idéalement via `RESEND_FROM`).
5. Mettre à jour le `.env` VPS (`RESEND_API_KEY`, domaine), rebuild + `pm2 restart`.
6. **Filet de sécurité** (si le DNS n'est pas propagé à temps) : bouton temporaire « Vérifier plus tard »
   sur `VerifyAccount.tsx`.
7. Créer l'adresse **support@ton-domaine** (affichée dans la FAQ/CGU).

### 🔍 Mardi (validation avant les testeurs)
8. Test d'inscription **end-to-end avec un email qui n'est PAS le tien** → confirmer réception du code.
9. Vérifier les points VPS du §4 (Gemini, JWT, service_role, NODE_ENV, pm2).
10. Appliquer `add_adjust_stock_rpc.sql` dans Supabase.
11. **Parcours de vente complet** avec ta 2ᵉ puce : client écrit → bot répond → photo → négo →
    commande → reçu Wave → statut → livraison. C'est LE test qui valide le cœur du produit.
12. (Optionnel) UptimeRobot sur l'API.

### 🚀 Mercredi — test avec de vrais vendeurs
- L'objectif du test : un vendeur lambda arrive à **bot actif en < 10 min sans ton aide**.

### ⏭️ Après le test (avant d'encaisser)
- S1 (enforcement abonnement expiré) + S2 (Paystack live + plans + webhook + vrai paiement).
- B3 (SMS Firebase — projet propre) si tu veux l'inscription par téléphone.
- RLS Supabase.

---

## 7. ❌ Ce qu'il ne faut PAS faire

- ❌ Ne bloque pas mercredi sur le **SMS Firebase** — l'email suffit pour tester.
- ❌ Ne passe pas Paystack en live **dans la précipitation** — les testeurs ne paient pas ; fais-le proprement après.
- ❌ N'applique pas la **migration RLS** sans avoir confirmé la clé service_role sur le VPS (ça peut casser le dashboard).
- ❌ Ne touche pas au **moteur de vente / UI** avant le test : c'est stable, chaque modif = risque de régression.
- ❌ Ne mets pas les variables Firebase Vercel en « Sensitive » (elles redeviennent illisibles).

---

*Résumé : le produit est bien plus prêt que « il manque plein de choses ». Il manque surtout
**le domaine + 4 lignes dans resendService.ts + une porte de sortie sur VerifyAccount**. Fais ça ce soir,
teste l'inscription avec un email tiers demain, et tu peux lancer mercredi. Le paiement et l'enforcement
d'abonnement se règlent tranquillement après, pendant que les testeurs utilisent le produit gratuitement.*
