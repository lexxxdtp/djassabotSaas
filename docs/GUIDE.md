# 🧠 DJASSABOT SaaS — Guide Projet Unifié

> **Source unique de vérité** pour le projet DjassaBot.
> Dernière mise à jour : Mars 2026

---

## 1. Mission

Transformer WhatsApp en **machine de vente automatique** pour les commerçants ivoiriens.

**Cible :** Vendeurs de bazin, mèches, sneakers, restaurants, friperies à Abidjan.
**Promesse :** « Encaisse pendant que tu dors. »

**Comment ça marche :**
1. Le vendeur s'inscrit, connecte son numéro WhatsApp (QR Code)
2. Il ajoute ses produits et configure son bot IA (personnalité, prix, livraison)
3. Ses clients envoient un message WhatsApp → le bot vend, négocie, et prend les commandes 24/7

---

## 2. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + Vite)                       │
│  Landing → Signup/Login → Dashboard (Overview, Products, Orders,   │
│  Settings, WhatsApp Connect, AI Playground, Subscription, Inbox)  │
│  Déployé sur : Vercel (djassabot-saas.vercel.app)                 │
└───────────────────────────┬────────────────────────────────────────┘
                            │ REST API + JWT
┌───────────────────────────▼────────────────────────────────────────┐
│                      BACKEND (Node.js + Express)                   │
│                                                                    │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────┐  ┌──────────┐│
│  │ Auth JWT │  │ Baileys Mgr   │  │ AI Service   │  │ Cron Jobs││
│  │(signup,  │  │(1 WhatsApp    │  │(Gemini 2.5   │  │(paniers  ││
│  │ login)   │  │ par tenant)   │  │ Flash)       │  │ abandon) ││
│  └──────────┘  └───────────────┘  └──────────────┘  └──────────┘│
│                                                                    │
│  Déployé sur : Railway (djassabot-saas-production.up.railway.app) │
└───────────────────────────┬────────────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────────────┐
│               DATABASE (Supabase — PostgreSQL)                     │
│  12 tables : tenants, users, products, orders, settings,           │
│  subscriptions, activity_logs, variation_templates, customers,     │
│  sessions, carts + RLS activé                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Stack Technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Frontend | React + Vite + TypeScript | React 19, Vite 7 |
| Styling | TailwindCSS | v4 |
| Routing | React Router | v7 |
| Backend | Node.js + Express + TypeScript | Express 5 |
| Base de données | Supabase (PostgreSQL) | — |
| IA | Google Gemini | `gemini-2.5-flash` |
| WhatsApp | Baileys (Web Multi-Device) | v7 rc9 |
| Auth | JWT (jsonwebtoken) | 30 jours |
| Email | Resend | v6 |
| Paiements | Paystack | (partiellement intégré) |
| Auth mobile | Firebase Phone Auth | — |
| Cron | node-cron | v3 |

---

## 4. Fonctionnalités — État actuel

### ✅ Implémenté

| Feature | Backend | Frontend |
|---------|---------|----------|
| Auth multi-tenant (email + phone + OTP) | `authRoutes.ts`, `auth.ts` | `Login`, `Signup`, `AuthContext` |
| CRUD Produits + variations + stock strict/flexible | `dbService.ts` | `Products`, `ProductFormModal`, `ProductCard` |
| Gestion commandes (statuts, détails) | `dbService.ts` | `Orders` |
| Bot IA Gemini (réponses contextuelles) | `aiService.ts` (559 lignes) | `AIPlayground` |
| Négociation IA (prix plancher caché) | `aiService.ts` | Config dans `Settings` |
| Personnalité IA configurable (politesse, emojis, nouchi, humour) | `dbService.ts` settings | 6 sous-composants Settings |
| Connexion WhatsApp QR Code multi-tenant | `baileysManager.ts` | `WhatsAppConnect` |
| Transcription vocale WhatsApp | `aiService.ts` → `transcribeAudio()` | — (traitement backend) |
| Analyse d'images (produits, reçus paiement) | `aiService.ts` → `analyzeImage()` | — (traitement backend) |
| Dashboard live (revenus, commandes, pulse) | Routes `/dashboard/*` | `Overview` (recharts) |
| Paniers abandonnés (relance auto 30min) | `abandonedCartService.ts` + cron | — (auto via WhatsApp) |
| Templates de variations réutilisables | `dbService.ts` | `ProductVariations` |
| Email OTP (vérification inscription) | `resendService.ts` | `Signup` |
| Profil utilisateur (nom, date naissance) | `authRoutes.ts` PUT /me | `Settings` onglet Profil |
| Configuration logistique (zones, seuil gratuit, paiements) | `dbService.ts` | `SettingsLogistics` |

### ⚠️ Partiellement implémenté

| Feature | Problème |
|---------|----------|
| Abonnements SaaS | Table existe, page `Subscription.tsx` existe, mais le flow de paiement réel n'est pas câblé. Sidebar Settings affiche "Plan Pro" en dur. |
| Paystack (sous-comptes vendeurs) | Routes backend existent, mais le flow d'abonnement SaaS n'est pas complet. |
| PWA | Dépendance `vite-plugin-pwa` installée mais pas configurée dans `vite.config.ts`. |
| Landing Page | Page existe mais basique. |

### ❌ Non implémenté (prévu)

| Feature | Priorité |
|---------|----------|
| Paiement mobile Wave/OM automatique | 🔴 Haute |
| Screenshot Validator (vérification reçus IA) | 🔴 Haute |
| Dashboard Admin (vue tous tenants) | 🟠 Moyenne |
| Rate Limiting API | 🟠 Moyenne |
| Refresh Tokens JWT | 🟡 Basse |
| Redis caching | 🟡 Basse |
| API publique | 🟡 Basse |
| Exports CSV analytics | 🟡 Basse |
| Programme d'affiliation | 🟡 Basse |

---

## 5. Structure du Code

```
foldertdjaasa/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Point d'entrée + routes inline
│   │   ├── config/
│   │   │   └── supabase.ts       # Client Supabase (mode cloud/local)
│   │   ├── middleware/
│   │   │   └── auth.ts           # JWT middleware (authenticateTenant)
│   │   ├── routes/
│   │   │   ├── authRoutes.ts     # Signup, Login, OTP, /me
│   │   │   ├── aiRoutes.ts       # Simulation IA, résumé
│   │   │   ├── chatRoutes.ts     # Gestion conversations
│   │   │   ├── whatsappRoutes.ts # Connexion/déconnexion WA
│   │   │   ├── paystackRoutes.ts # Paiements
│   │   │   ├── variationTemplateRoutes.ts
│   │   │   └── webhookRoutes.ts
│   │   ├── services/
│   │   │   ├── dbService.ts      # 🔑 Couche DB principale (738 lignes)
│   │   │   ├── tenantService.ts  # CRUD tenants/users/subscriptions
│   │   │   ├── aiService.ts      # 🔑 Moteur IA Gemini (559 lignes)
│   │   │   ├── baileysManager.ts # Multi-instance WhatsApp
│   │   │   ├── sessionService.ts # État conversations en mémoire
│   │   │   ├── abandonedCartService.ts
│   │   │   ├── paymentService.ts
│   │   │   ├── paystackService.ts
│   │   │   ├── resendService.ts  # Envoi emails (OTP)
│   │   │   ├── notificationService.ts
│   │   │   └── whatsapp/
│   │   │       ├── messageHandler.ts  # Traitement messages entrants
│   │   │       ├── flowHandler.ts     # Flow de commande
│   │   │       ├── sessionManager.ts
│   │   │       └── notificationService.ts
│   │   ├── types/
│   │   │   └── index.ts          # Interfaces TypeScript
│   │   └── jobs/
│   │       └── abandonedCart.ts   # Cron job
│   ├── supabase_full_schema.sql  # ✅ Schéma DB à jour (12 tables)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Router principal
│   │   ├── main.tsx
│   │   ├── types.ts              # Types frontend
│   │   ├── firebase.ts           # Auth téléphone Firebase
│   │   ├── supabaseClient.ts     # (non utilisé — code mort)
│   │   ├── context/
│   │   │   └── AuthContext.tsx    # État auth global
│   │   ├── utils/
│   │   │   └── apiConfig.ts      # URL API dynamique
│   │   ├── layouts/
│   │   │   └── DashboardLayout.tsx
│   │   ├── components/
│   │   │   ├── AIPlayground.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── UserProfileModal.tsx
│   │   │   ├── products/         # ProductCard, ProductFormModal, ProductVariations
│   │   │   └── settings/         # SettingsIdentity, Personality, Toggles, Advanced, Business, Logistics
│   │   └── pages/
│   │       ├── LandingPage.tsx
│   │       ├── Login.tsx
│   │       ├── Signup.tsx
│   │       ├── Overview.tsx      # Dashboard principal
│   │       ├── Products.tsx
│   │       ├── ProductDetail.tsx
│   │       ├── Orders.tsx
│   │       ├── Inbox.tsx
│   │       ├── Marketing.tsx
│   │       ├── Settings.tsx
│   │       ├── WhatsAppConnect.tsx
│   │       └── Subscription.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── database/
│   ├── schema.sql                # ⚠️ OBSOLÈTE — utiliser supabase_full_schema.sql
│   └── migrations/               # 6 scripts de migration
│
└── docs/                         # 31 fichiers (voir section Documentation)
```

---

## 6. Schéma Base de Données (12 tables)

> **Source de vérité :** `backend/supabase_full_schema.sql`
>
> **⚠️ ATTENTION :** `database/schema.sql` est obsolète et ne contient pas toutes les colonnes.

### Tables principales

| Table | Colonnes clés | Rôle |
|-------|---------------|------|
| `tenants` | id, name, business_type, status, subscription_tier, whatsapp_connected, whatsapp_status | Comptes business |
| `users` | id, tenant_id, email, phone, full_name, password_hash, role, email_verified, phone_verified | Utilisateurs (liés aux tenants) |
| `products` | id, tenant_id, name, price, stock, images[], min_price, variations (JSONB), ai_instructions, manage_stock | Catalogue produits |
| `orders` | id (TEXT custom), tenant_id, user_id, items (JSONB), total, status, address | Commandes clients |
| `settings` | tenant_id (unique), bot_name, persona, politeness, emoji_level, humor_level, slang_level, store_name, opening_hours, delivery_zones, negotiation_margin + 20 autres | Config AI + business |
| `subscriptions` | id, tenant_id, plan, status, expires_at, auto_renew | Abonnements |
| `activity_logs` | tenant_id, type, message, metadata | Logs d'activité (Le Pulse) |
| `variation_templates` | tenant_id, name, default_options (JSONB), usage_count | Templates de variations réutilisables |
| `customers` | tenant_id, phone, name, total_orders, total_spent | CRM clients |
| `sessions` | tenant_id, user_phone, state, history (JSONB), reminder_sent | État conversations WhatsApp |
| `carts` | tenant_id, user_id, items (JSONB) | Paniers en cours |

### Statuts de commande

```
PENDING → CONFIRMED → SHIPPING → DELIVERED
                    ↘ PAID
         ↘ CANCELLED
```

### Plans d'abonnement

| Plan | Prix | Public |
|------|------|--------|
| Starter | 5 000 FCFA/mois | Petits vendeurs |
| Pro | 15 000 FCFA/mois | Vendeurs établis |
| Business | Sur devis | Grandes enseignes |

---

## 7. Setup Développement

### Prérequis
- Node.js 18+
- npm
- Compte Supabase (avec le schéma appliqué)
- Clé API Google Gemini

### Backend

```bash
cd backend
cp .env.example .env
# ➜ Remplir : SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY, JWT_SECRET
npm install
npm run dev        # → http://localhost:3000
```

### Frontend

```bash
cd frontend
# Créer .env avec :
#   VITE_API_URL=http://localhost:3000/api
#   VITE_SUPABASE_URL=https://xxx.supabase.co
#   VITE_SUPABASE_KEY=xxx
npm install
npm run dev        # → http://localhost:5173
```

### Variables d'environnement

**Backend `.env` :**
```
PORT=3000
JWT_SECRET=un-vrai-secret-fort-ici
GEMINI_API_KEY=AIzaSy...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJhbG...
RESEND_API_KEY=re_xxx
PAYSTACK_SECRET_KEY=sk_test_xxx (optionnel)
```

**Frontend `.env` :**
```
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_KEY=eyJhbG...
```

---

## 8. Déploiement Production

| Service | Plateforme | URL |
|---------|-----------|-----|
| Frontend | Vercel | `djassabot-saas.vercel.app` |
| Backend | Railway | `djassabot-saas-production.up.railway.app` |
| Base de données | Supabase | `dnglgyviycbpoerywanc.supabase.co` |

### Déployer le frontend
1. Push sur GitHub (branche `main`)
2. Vercel auto-deploy
3. Variable : `VITE_API_URL=https://djassabot-saas-production.up.railway.app`

### Déployer le backend
1. Push sur GitHub (branche `main`)
2. Railway auto-deploy
3. Build : `npm run build` → Start : `npm start`
4. Volume persistant pour `/sessions` (auth Baileys)

---

## 9. Routes API

### Publiques (pas d'auth)
| Méthode | Route | Rôle |
|---------|-------|------|
| POST | `/api/auth/signup` | Inscription |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/send-email-otp` | Envoyer code OTP |
| POST | `/api/auth/verify-email-otp` | Vérifier code OTP |

### Protégées (JWT requis)
| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/api/auth/me` | Infos user connecté |
| PUT | `/api/auth/me` | Modifier profil |
| GET | `/api/settings` | Lire les settings |
| POST | `/api/settings` | Sauvegarder les settings |
| GET/POST | `/api/products` | Lister / Créer produits |
| PUT/DELETE | `/api/products/:id` | Modifier / Supprimer produit |
| GET | `/api/orders` | Lister commandes |
| PUT | `/api/orders/:id/status` | Changer statut commande |
| GET | `/api/dashboard/pulse` | Logs d'activité |
| GET | `/api/dashboard/recent-orders` | 5 dernières commandes |
| POST | `/api/ai/simulate` | Tester le bot IA |
| POST | `/api/ai/summarize-identity` | Résumé IA de la config |
| * | `/api/whatsapp/*` | Gestion connexion WhatsApp |
| * | `/api/chats/*` | Gestion conversations |
| * | `/api/paystack/*` | Paiements |

---

## 10. Bugs connus / Incohérences à corriger

| # | Problème | Sévérité | Fichiers |
|---|----------|----------|----------|
| 1 | Frontend envoie `PUT /settings`, backend écoute `POST` | 🔴 | `Settings.tsx:219`, `index.ts:57` |
| 2 | `Product.price` = `string\|number` côté frontend, `number` côté backend | 🔴 | `frontend/types.ts:85` |
| 3 | OrderStatus `SHIPPED` (backend) vs `SHIPPING` (frontend) | 🟠 | `types/index.ts:44`, `Orders.tsx:9` |
| 4 | Certaines pages lisent `localStorage` au lieu de `useAuth()` | 🟠 | `Orders.tsx:165`, `Products.tsx:21` |
| 5 | Champ dupliqué `aiInstructions` + `ai_instructions` dans Product frontend | 🟡 | `frontend/types.ts:90-91` |
| 6 | `getSubscriptionByTenantId` retourne du snake_case brut | 🟡 | `tenantService.ts:466` |
| 7 | `getRecentOrders` ne mappe pas `user_id → userId` | 🟡 | `dbService.ts:641` |
| 8 | Firebase API key en dur dans le code | 🟡 | `firebase.ts:10` |
| 9 | JWT secret par défaut hardcodé | 🟡 | `auth.ts:4` |
| 10 | Sidebar Settings affiche "Plan Pro" et quota IA en dur | 🟡 | `Settings.tsx:525-542` |

---

## 11. Conventions de Code

### Nommage
- **Fichiers backend :** camelCase (`aiService.ts`, `dbService.ts`)
- **Composants React :** PascalCase (`Settings.tsx`, `AIPlayground.tsx`)
- **Base de données :** snake_case (`tenant_id`, `bot_name`)
- **Code TypeScript :** camelCase (`tenantId`, `botName`)
- **Mapping DB ↔ Code :** Fait manuellement dans `dbService.ts` et `tenantService.ts`

### Design System
- **Background :** `#05070a` / `#0a0c10`
- **Primary :** Indigo `#6366f1`
- **Cards :** `bg-[#0a0c10] border border-white/5 rounded-2xl`
- **Texte :** `text-white` / `text-zinc-400` / `text-zinc-500`

---

## 12. Documentation Legacy

Les fichiers ci-dessous dans `docs/` sont conservés pour référence historique mais **ce GUIDE.md est la source de vérité** :

| Fichier | Contenu | Statut |
|---------|---------|--------|
| `ARCHITECTURE_SAAS.md` | Vision initiale multi-tenant | 📦 Archive |
| `DEVELOPMENT_ROADMAP.md` | Plan 4 semaines (tout est fait) | 📦 Archive |
| `PROJECT_STATE.md` | État au 10 Jan 2026 | 📦 Archive |
| `STRATEGIC_VISION_2026.md` | Vision business | 📖 Toujours valide |
| `SCENARIOS_DE_TEST.md` | Scénarios de test IA | 📖 Toujours valide |
| `PRICING_STRATEGY.md` | Stratégie de prix | 📖 Toujours valide |
| `PROJECT_BRIEF.md` | Pitch exécutif | 📦 Archive |
| Autres (WEEK*_SUMMARY, SESSION_*, VERIFICATION_*) | Logs de sessions | 📦 Archive |
