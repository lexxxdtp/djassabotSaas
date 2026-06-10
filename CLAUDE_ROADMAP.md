# 🤖 CLAUDE ROADMAP — DjassaBot SaaS
> Fichier de contexte et journal de bord pour Claude.
> **Mis à jour le : 17 mai 2026**

---

## 🧠 CONNAISSANCE COMPLÈTE DU PROJET

### C'est quoi ?
**TDJaassa / DjassaBot** — Plateforme SaaS de commerce automatisé sur WhatsApp ciblant les **commerçants ivoiriens (Abidjan)**. Un vendeur connecte son WhatsApp, configure son bot IA, et le bot gère ses clients 24h/24 : présentation des produits, **négociation de prix** (style marché africain), prise de commandes, validation des paiements.

### Ce qui rend le projet unique
- Bot parle **Nouchi + Français Ivoirien** (authentique)
- **Négociation active** avec prix plancher caché (`minPrice`)
- **Screenshot Validator** : l'IA analyse les reçus Wave/OM envoyés par le client
- Fonctionne sur WhatsApp directement via Baileys (sans frais API Meta)

---

## 🏗️ STACK TECHNIQUE

| Composant | Technologie | URL Production |
|-----------|-------------|----------------|
| Frontend | React 19 + Vite + Tailwind | https://djassabot-saas.vercel.app |
| Backend | Node.js + Express + TypeScript | https://djassabot-saas-production.up.railway.app |
| Base de données | Supabase (PostgreSQL) | https://dnglgyviycbpoerywanc.supabase.co |
| IA | Google Gemini 2.5 Flash | — |
| WhatsApp | Baileys (QR Code) | — |
| Auth | JWT (7 jours) | — |
| Paiement SaaS | Paystack | — |
| Hébergement Backend | Railway | — |
| Hébergement Frontend | Vercel | — |

---

## 📁 STRUCTURE DU PROJET

```
djassabotSaas/
├── backend/
│   ├── src/
│   │   ├── config/supabase.ts          # Config Supabase (mode cloud vs JSON local)
│   │   ├── controllers/
│   │   │   ├── authController.ts       # Signup, login, OTP, reset password
│   │   │   └── webhookController.ts    # Webhook WhatsApp Cloud API (⚠️ voir bugs)
│   │   ├── middleware/auth.ts          # JWT verify + generateToken
│   │   ├── routes/
│   │   │   ├── authRoutes.ts
│   │   │   ├── whatsappRoutes.ts       # QR code, connect, disconnect, status
│   │   │   ├── aiRoutes.ts             # AI playground simulation
│   │   │   ├── paystackRoutes.ts       # Plans, subscribe, vendor setup, webhook
│   │   │   ├── chatRoutes.ts           # Inbox chat management
│   │   │   ├── webhookRoutes.ts        # WhatsApp Cloud API webhook
│   │   │   └── variationTemplateRoutes.ts
│   │   ├── services/
│   │   │   ├── aiService.ts            # Gemini AI (génération, image, audio, intent)
│   │   │   ├── baileysManager.ts       # Gestionnaire instances WhatsApp multi-tenant
│   │   │   ├── dbService.ts            # Couche DB (Supabase + fallback JSON local)
│   │   │   ├── sessionService.ts       # Sessions WhatsApp (Supabase + fallback RAM)
│   │   │   ├── tenantService.ts        # CRUD tenants/users/subscriptions
│   │   │   ├── paystackService.ts      # API Paystack (subscribe, subaccount, webhook)
│   │   │   ├── paymentService.ts       # Wave payment link generator
│   │   │   ├── resendService.ts        # Emails (OTP, reset password)
│   │   │   ├── notificationService.ts  # Notif marchand (nouvelle commande)
│   │   │   ├── abandonedCartService.ts # Relance panier abandonné
│   │   │   └── whatsapp/
│   │   │       ├── messageHandler.ts   # Handler messages entrants (Baileys)
│   │   │       ├── flowHandler.ts      # Flow de conversation (état machine)
│   │   │       ├── sessionManager.ts   # Session par utilisateur WhatsApp
│   │   │       └── notificationService.ts
│   │   ├── jobs/abandonedCart.ts       # Cron job panier abandonné (node-cron)
│   │   ├── types/index.ts              # Types TypeScript
│   │   ├── utils/logger.ts             # Logger pino (✅ ajouté par Claude)
│   │   └── index.ts                    # Entry point Express
│   ├── database/store.json             # Fallback JSON local (NE PAS utiliser en prod)
│   └── .env                            # Variables d'environnement (ne pas commiter!)
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx         # Page d'accueil publique
│   │   │   ├── Login.tsx / Signup.tsx  # Auth
│   │   │   ├── Overview.tsx            # Dashboard principal (métriques)
│   │   │   ├── Products.tsx            # Catalogue produits
│   │   │   ├── ProductDetail.tsx       # Détail produit + variations
│   │   │   ├── Orders.tsx              # Gestion commandes
│   │   │   ├── Inbox.tsx               # Inbox conversations WhatsApp
│   │   │   ├── Settings.tsx            # Config bot + boutique
│   │   │   ├── WhatsAppConnect.tsx     # Connexion WhatsApp QR
│   │   │   ├── Subscription.tsx        # Plans tarifaires + paiement
│   │   │   ├── Marketing.tsx           # Outils marketing
│   │   │   └── ForgotPassword / ResetPassword
│   │   ├── components/
│   │   │   ├── AIPlayground.tsx        # Simulateur de conversation IA
│   │   │   ├── ProtectedRoute.tsx      # Guard routes authentifiées
│   │   │   ├── UserProfileModal.tsx
│   │   │   ├── products/               # ProductCard, ProductFormModal, ProductVariations
│   │   │   └── settings/               # 6 sous-composants settings (Identity, Business, etc.)
│   │   ├── context/AuthContext.tsx     # Context auth global (token, user, tenant)
│   │   ├── utils/
│   │   │   ├── apiClient.ts            # Fetch wrapper (auth header + 401 handler)
│   │   │   └── apiConfig.ts            # Résolution URL API (VITE_API_URL)
│   │   ├── firebase.ts                 # Firebase Auth (configuré mais ⚠️ peu utilisé)
│   │   └── supabaseClient.ts           # Client Supabase frontend (VITE_SUPABASE_KEY)
│   └── vercel.json                     # SPA rewrite rule
├── database/
│   ├── schema.sql                      # Schéma SQL legacy
│   ├── store.json                      # JSON local fallback
│   └── migrations/
│       └── create_missing_tables.sql   # ✅ Tables activity_logs + variation_templates
├── docs/                               # Documentation extensive
└── CLAUDE_ROADMAP.md                   # CE FICHIER
```

---

## 🗄️ BASE DE DONNÉES SUPABASE

**Projet:** `dnglgyviycbpoerywanc`
**URL:** `https://dnglgyviycbpoerywanc.supabase.co`

### Tables (10/10 ✅)
| Table | Statut | Description |
|-------|--------|-------------|
| tenants | ✅ | Comptes business |
| users | ✅ | Utilisateurs (liés aux tenants) |
| subscriptions | ✅ | Plans d'abonnement |
| settings | ✅ | Config IA + boutique par tenant |
| products | ✅ | Catalogue produits (avec variations JSONB) |
| orders | ✅ | Commandes clients |
| sessions | ✅ | Historique conversations WhatsApp |
| auth_tokens | ✅ | OTP + reset password tokens |
| activity_logs | ✅ | Journal d'activité (créé le 17/05/2026) |
| variation_templates | ✅ | Templates variations réutilisables (créé le 17/05/2026) |

### Données actuelles (compte Alex)
```
Tenant ID  : 5989aeca-c803-4262-9d9b-9ee69f1f046d
Nom        : djaasa chic
Statut     : active
Abonnement : starter | active | expire le 16 juin 2026

User       : Alex Vianney
Téléphone  : +2250777225277 (vérifié ✅)
Email      : non renseigné ⚠️
Rôle       : owner

Produits   : Bazin Riche (15 000F, stock:10, minPrice:13 000F)
             Mèche Humaine (45 000F, stock:5)

WhatsApp   : ❌ non connecté
```

---

## ✅ CE QUI A ÉTÉ FAIT (session 17/05/2026)

### Sécurité (backend)
- [x] **CORS** : Wildcard remplacé par `ALLOWED_ORIGINS` env var
- [x] **Rate limiting** : `express-rate-limit` — 20 req/15min (auth), 5 req/10min (OTP)
- [x] **JWT** : Expiry réduit de 30j → 7j
- [x] **Paystack webhook** : Bug critique corrigé (`JSON.stringify(Buffer)` → `.update(req.body)`)
- [x] **Fuites d'erreurs** : `error.message` supprimé des réponses 500
- [x] **minPrice** : Strippé du GET `/api/products` (uniquement côté serveur pour l'IA)
- [x] **Phone reset** : Token plus jamais retourné dans la réponse HTTP
- [x] **Énumération utilisateurs** : `verifyPhoneReset` renvoie la même réponse que l'user existe ou non
- [x] **Validation `updateMe`** : Email, téléphone, nom, date maintenant validés
- [x] **Prompt injection AI** : Sanitisation améliorée des instructions marchands
- [x] **Historique AI** : Limité aux 20 derniers tours (coût Gemini + perf)
- [x] **`dotenv.config()` double** : Supprimé de `aiService.ts`
- [x] **Validation produits** : Prix et stock négatifs rejetés
- [x] **Email Paystack** : Plus de fallback `customer@example.com`

### Optimisations (backend)
- [x] **Logger pino** : `backend/src/utils/logger.ts` créé, 191 console.log remplacés
- [x] **`express-rate-limit`** : Ajouté aux dépendances

### Base de données
- [x] **Supabase connecté** localement (`.env` créé)
- [x] **Abonnement réactivé** : starter → active jusqu'au 16/06/2026
- [x] **Produits migrés** : 2 produits du JSON local → Supabase
- [x] **Settings migrés** : bot + boutique sauvegardés dans Supabase
- [x] **Tables manquantes créées** : `activity_logs` + `variation_templates`

---

## 🔴 BUGS CRITIQUES CONNUS (à corriger)

### 1. DEFAULT_TENANT_ID dans webhookController (CRITIQUE)
**Fichier :** `backend/src/controllers/webhookController.ts` ligne ~15
```typescript
const DEFAULT_TENANT_ID = 'default-tenant-id'; // ← HARDCODÉ !
```
**Problème :** Tous les messages WhatsApp entrants via le Cloud API sont routés vers ce tenant fictif. Le bot ne répondra JAMAIS correctement via ce webhook. Baileys (l'autre méthode) est le vrai système en prod.
**Fix :** Implémenter un mapping `numeroWhatsApp → tenantId` en DB, ou supprimer ce webhook si seul Baileys est utilisé.

### 2. Railway env vars non configurées (BLOQUANT)
Le backend en production (Railway) n'a probablement pas :
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `ALLOWED_ORIGINS`
- `JWT_SECRET` (utilise le défaut non sécurisé !)

**Résultat :** Le backend Railway tourne en **mode JSON local**, les données ne sont PAS dans Supabase.

### 3. Firebase importé mais non utilisé
**Fichier :** `frontend/src/firebase.ts`
Firebase Auth est importé mais le système d'auth réel utilise JWT via le backend. À nettoyer ou retirer pour alléger le bundle.

### 4. JWT_SECRET par défaut non sécurisé
`JWT_SECRET=tdjaasa-super-secret-change-in-production` — ce secret par défaut est dans le `.env.example` et potentiellement en production sur Railway.

---

## ⚠️ POINTS D'ATTENTION

### Architecture double (important à comprendre)
Le projet a **DEUX systèmes WhatsApp** en parallèle :
1. **Baileys** (`baileysManager.ts`) — connexion via QR Code, c'est le système PRINCIPAL utilisé par les tenants via le dashboard
2. **WhatsApp Cloud API** (`webhookController.ts`) — webhook officiel Meta, partiellement implémenté, route vers un tenant hardcodé (bug)

### Deux bases de données
- **Mode Supabase** : si `SUPABASE_URL` + `SUPABASE_KEY` présents → données en cloud
- **Mode JSON local** : fallback `database/store.json` → données perdues au redémarrage

Le backend LOCAL a maintenant le `.env` correct et utilise Supabase.
Le backend RAILWAY n'a probablement pas les bonnes variables → tourne en mode JSON local.

### Settings : mapping snake_case ↔ camelCase
La DB Supabase utilise `snake_case` (`bot_name`, `store_name`, `emoji_level`...)
Le code TypeScript utilise `camelCase` (`botName`, `storeName`, `emojiLevel`...)
Le `dbService.ts` gère la conversion — à surveiller si on ajoute de nouveaux champs.

---

## 📋 ROADMAP PROCHAINES ÉTAPES (priorités)

### 🔴 URGENT (bloquant pour la prod)
- [ ] **Configurer les env vars Railway** : `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET` (nouveau secret fort), `GEMINI_API_KEY`, `ALLOWED_ORIGINS`
- [ ] **Changer JWT_SECRET** : Générer un vrai secret aléatoire fort (ex: `openssl rand -hex 64`)
- [ ] **Fix DEFAULT_TENANT_ID** dans `webhookController.ts`

### 🟠 IMPORTANT (fonctionnalités)
- [ ] **Connecter WhatsApp** via le dashboard (QR Code scan)
- [ ] **Ajouter des vrais produits** dans Supabase via le dashboard
- [ ] **Configurer les settings** boutique (heures, livraison, paiements acceptés)
- [ ] **Screenshot Validator** : Validation reçu Wave/OM par Gemini Vision (feature killer)

### 🟡 AMÉLIORATIONS
- [ ] **Retirer Firebase** si non utilisé (allège le bundle frontend ~300kb)
- [ ] **Configurer Vercel env vars** : `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`
- [ ] **Ajouter pagination** sur `/api/orders` et `/api/products`
- [ ] **Plans Paystack** : Configurer les vrais codes plans dans Paystack dashboard
- [ ] **Email pour le compte Alex** : Ajouter un email au compte user pour Paystack

### 🟢 PHASE 2 (croissance)
- [ ] Wave / Orange Money automatique (Paystack Subaccounts)
- [ ] Analytics avancés (graphiques, export CSV)
- [ ] Application mobile (Capacitor)
- [ ] Programme d'affiliation
- [ ] Support multi-numéros WhatsApp par tenant

---

## 🔐 ACCÈS ET CREDENTIALS

| Service | Statut | Accès Claude |
|---------|--------|-------------|
| GitHub | ✅ Configuré | PAT dans git remote URL |
| Supabase | ✅ Connecté | URL + service_role key dans `.env` |
| Railway | ❌ Pas d'accès direct | Env vars à configurer manuellement |
| Vercel | ❌ Pas d'accès direct | Env vars à configurer manuellement |
| Gemini API | ❌ Clé manquante | À fournir dans `.env` |
| Paystack | ❌ Clés test | À configurer |

**Pour que Claude push sur GitHub :**
Le token PAT est configuré dans le remote URL git local. Les commits/push fonctionnent directement.

---

## 📌 COMMANDES UTILES

```bash
# Vérifier l'état Supabase
cd /Users/alexvianneykoffi/djassabotSaas/backend
node -e "require('dotenv').config(); const {createClient}=require('@supabase/supabase-js'); const s=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_KEY); s.from('tenants').select('name,status').then(r=>console.log(r.data))"

# TypeScript check
cd backend && npx tsc --noEmit

# Push sur GitHub
cd /Users/alexvianneykoffi/djassabotSaas
git add -A && git commit -m "message" && git push origin main
```

---

## 📝 JOURNAL DES SESSIONS

### Session 1 — 17 mai 2026 (partie 1)
- Repo cloné + git configuré avec PAT
- Audit sécurité complet → 11 vulnérabilités corrigées
- Supabase connecté + base de données réparée
- Fichier CLAUDE_ROADMAP.md créé

### Session 1 — 17 mai 2026 (partie 2 — Phase 1 fondations)
- **Découverte** : le Pairing Code est DÉJÀ implémenté côté backend (`sessionManager.requestPairingCode`) ET côté frontend (`WhatsAppConnect.tsx` avec sélecteur pays 🇨🇮🇸🇳🇲🇱🇧🇫🇧🇯🇹🇬🇳🇪🇬🇳🇬🇭🇳🇬). Plus rien à coder côté WhatsApp connect.
- **Bug DEFAULT_TENANT_ID** : webhookController désactivé dans `index.ts` (mort code dangereux). Baileys reste le système principal.
- **Guide Railway** : `RAILWAY_SETUP.md` créé avec JWT_SECRET fort généré (`openssl rand -hex 64`).

### Session 1 — 17 mai 2026 (partie 3 — Migration vers VPS Hostinger)
- **Décision** : abandon de Railway (trial expiré, payant pour 1 seule app). Choix d'un VPS Hostinger KVM 2 à 7.99€/mois pour héberger DjassaBot + n8n + futurs projets.
- **VPS configuré** : Ubuntu 24.04 LTS, 2 vCPU, 8GB RAM, 96GB SSD NVMe
- **IP** : `187.77.171.44` (latence ~105ms CI→Allemagne)
- **Sécurité** :
  - User non-root `alex` créé avec sudo + clé SSH
  - SSH password auth désactivée (clé uniquement)
  - UFW firewall (ports 22, 80, 443 uniquement)
  - Fail2ban actif (bannit 1h après 5 tentatives en 10min)
  - Swap 2GB pour stabilité
  - Timezone Africa/Abidjan
- **Stack installée** :
  - Node.js 20 LTS + PM2 (process manager auto-restart au boot)
  - Docker + Docker Compose (pour n8n + futurs containers)
  - Nginx (reverse proxy)
  - Certbot (HTTPS, en attente d'un domaine)
- **Backend déployé** :
  - `/home/alex/djassabotSaas/backend` (clone du repo GitHub)
  - PM2 process `djassabot-backend` → port 3000 (interne)
  - Logs : `pm2 logs djassabot-backend`
  - `.env` configuré avec Supabase + JWT_SECRET fort (autres clés à compléter)
- **n8n déployé** :
  - Docker container `n8n` (image officielle)
  - Port 5678 (interne uniquement, exposé via nginx /n8n/)
  - Auth basique : user `alex` / password dans `/home/alex/n8n/CREDENTIALS.txt`
  - Volume persistant `n8n_n8n_data`
- **Endpoints publics** :
  - Backend API : `http://187.77.171.44/api/*`
  - n8n : `http://187.77.171.44/n8n/`
- **Tests OK** : `/api/auth/login` répond 401 sur mauvais identifiants ✅, n8n accessible ✅
- **Manque** : domaine + HTTPS, clés Gemini/Resend/Paystack dans le `.env`

### Décisions stratégiques (validées par Alex)
- **Validation paiements** : Screenshot Validator IA (Gemini Vision lit les reçus Wave/OM) → Phase 2
- **App mobile** : PWA d'abord (vite-plugin-pwa déjà installé), Capacitor ensuite → Phase 3
- **WhatsApp** : Pairing Code en méthode principale (UX mobile), QR Code en fallback desktop
- **OTP par WhatsApp** : ⏸️ Reporté — Alex achètera une puce dédiée plus tard pour que ce numéro envoie les OTP via Baileys (numéro "système DjassaBot"). En attendant : OTP via Firebase (téléphone) + Resend (email).

### Session 1 — 17 mai 2026 (partie 4 — Refonte UX signup)
- **Bug Firebase résolu** : `auth` est désormais `null` (au lieu d'un Proxy qui throw) quand non configuré → plus de page blanche
- **Wizard signup 3 étapes** :
  - Étape 1 : Identifier (téléphone par DÉFAUT, email en option) avec OTP inline
  - Étape 2 : Nom commerce + sélecteur visuel type d'activité (8 catégories) + nom + année de naissance (dropdown, validation 18+)
  - Étape 3 : Mot de passe + preview "après inscription"
- Progress bar animée, transitions, bouton Retour, validation par étape

### Session 2 — 10 juin 2026 (Cowork)
- **Audit auth** : `updateMe` corrigé — unicité email/téléphone vérifiée + reset des flags `emailVerified`/`phoneVerified` quand l'identifiant change.
- **CORS** : origines Capacitor ajoutées (`capacitor://localhost`, `ionic://localhost`, `http(s)://localhost`) pour l'app mobile.
- **Pagination** : `GET /api/orders` et `GET /api/products` supportent `?page=&limit=` → `{ items, total, page, limit, totalPages }`. Sans params : comportement legacy (tableau complet), rétro-compatible.
- **Diffusion (feature)** : `POST /api/marketing/broadcast` + `GET /api/marketing/audience` (`backend/src/routes/marketingRoutes.ts`). Envoi séquentiel avec délai anti-ban 2-5s, audiences all/vip/recent, log dans activity_logs. Formulaire `Marketing.tsx` branché (compteurs réels, feedback succès/erreur).
- **Firebase frontend** : vérifié — utilisé pour OTP SMS, déjà code-splitté (chunk lazy ~68kb chargé uniquement sur VerifyAccount/ForgotPassword). Ne PAS supprimer.
- **App iOS** : Capacitor 8 ajouté (`frontend/ios/`, `capacitor.config.ts`, scripts `ios:sync`/`ios:open`). `apiConfig.ts` détecte Capacitor → API prod. Guide : `IOS_SETUP.md`.

### Session 3 — 11 juin 2026 (Cowork, 30 min autonomie)
- **Anti-fraude reçus** : `db.isTransactionIdUsed()` — un reçu Wave/OM ne valide qu'UN paiement. Réutilisation → bloquée + warning loggé + client informé.
- **Pause bot étanche** : la validation de reçus ne répond plus quand le bot est en pause. Settings lus 1 fois par message.
- **Découverte** : le Screenshot Validator était DÉJÀ implémenté (paymentValidationService.ts) — le CLAUDE.md §E2 est périmé. Match par montant exact → auto-PAID + notif marchand.
- **Photo d'abord** : POST /api/ai/analyze-product-photo (Gemini Vision) + pré-remplissage auto nom/description dans ProductFormModal. Le vendeur photographie, l'IA rédige, il met le prix.
- **Android** : plateforme Capacitor ajoutée (frontend/android/), scripts android:sync/android:open.
- **UX vérifiée** : onboarding déjà en 3 étapes + skip (welcome→whatsapp→produit→personnalité), login auto-formate les numéros 10 chiffres en +225, presets personnalité déjà en place.
- **Reste connu** : domaine Resend (emails limités à l'email d'Alex), fix SMS Firebase (-39), RLS Supabase, notifications push, brancher la page Marketing sur les stats réelles de campagnes.
