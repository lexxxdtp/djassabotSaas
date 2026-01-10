# 📋 État du Projet - DjassaBot SaaS

> **Dernière mise à jour:** 2026-01-10  
> **Version:** 1.0.0  
> **Statut:** ✅ Production

---

## 🎯 Vue d'ensemble

**DjassaBot** est une plateforme SaaS permettant de créer des bots de vente intelligents sur WhatsApp, optimisés pour le marché ivoirien. L'application combine une interface web moderne avec un backend intelligent utilisant Gemini AI.

---

## 🏗️ Architecture Technique

### Stack Frontend
- **Framework:** React + Vite + TypeScript
- **Styling:** Tailwind CSS
- **Routing:** React Router v6
- **Icons:** Lucide React
- **Déploiement:** Vercel
- **URL Production:** https://djassabot-saas.vercel.app

### Stack Backend
- **Runtime:** Node.js + Express + TypeScript
- **Base de données:** Supabase (PostgreSQL)
- **IA:** Google Gemini AI (modèle: `gemini-2.5-flash`)
- **WhatsApp:** Baileys (WhatsApp Web Multi-Device)
- **Authentification:** JWT
- **Tâches planifiées:** node-cron
- **Déploiement:** Railway
- **URL API:** https://djassabot-saas-production.up.railway.app

---

## 🔑 Configuration Actuelle

### Variables d'environnement (Backend)
```bash
PORT=3000
SUPABASE_URL=https://dnglgyviycbpoerywanc.supabase.co
SUPABASE_KEY=eyJhbGci... (clé anon publique)
GEMINI_API_KEY=AIzaSy*******************************
JWT_SECRET=tdjaasa-super-secret-change-in-production (par défaut si non défini)
MERCHANT_PHONE=2250700000000
```

### Modèle IA Actuel
- **Nom:** `gemini-2.5-flash`
- **Fournisseur:** Google Generative AI
- **Version SDK:** `@google/generative-ai@0.24.1`
- **Utilisation:** Génération de réponses, négociation, transcription audio, analyse d'images

---

## 📊 Fonctionnalités Implémentées

### ✅ Core Features (100%)
- [x] Authentification multi-tenant (email + JWT)
- [x] Dashboard avec métriques en temps réel
- [x] Gestion de produits (CRUD avec variations)
- [x] Gestion des commandes
- [x] Configuration de l'IA (personnalité, politesse, emojis, etc.)
- [x] Connexion WhatsApp via QR code
- [x] Simulateur de conversation (AI Playground)
- [x] Persistance des données (Supabase)

### ✅ Fonctionnalités Avancées (100%)
- [x] **Voice AI:** Transcription des messages vocaux WhatsApp
- [x] **Négociation Intelligente:** Prix min/max avec flexibilité configurable
- [x] **Abandoned Cart Reminders:** Relance automatique après 30min d'inactivité
- [x] **Few-Shot Learning:** Entraînement par exemples (Questions/Réponses)
- [x] **Adaptive AI:** Personnalité, politesse, emojis, longueur adaptative
- [x] **Image Analysis:** Reconnaissance de produits via image
- [x] **Session Management:** Historique des conversations persistantes
- [x] **Multi-Tenant:** Isolation complète des données par tenant

### ✅ UI/UX (100%)
- [x] Design moderne dark mode (noir/orange)
- [x] Animations fluides (fade-in, slide-in, skeleton loaders)
- [x] Responsive (mobile + desktop)
- [x] Feedback visuel temps réel
- [x] Modals de confirmation
- [x] Messages d'erreur détaillés

---

## 🗄️ Schéma Base de Données (Supabase)

### Tables Principales
1. **tenants** - Comptes business principaux
2. **users** - Utilisateurs (liés aux tenants)
3. **subscriptions** - Plans d'abonnement
4. **settings** - Configuration IA et business par tenant
5. **products** - Catalogue produits (avec variations JSONB)
6. **orders** - Commandes clients
7. **sessions** - Historique conversations WhatsApp
8. **customers** - Base clients (par tenant)
9. **activity_logs** - Logs d'activité (ventes, actions)
10. **variation_templates** - Templates de variations réutilisables

### Colonnes Critiques Settings
```sql
-- Identité IA
bot_name, persona, politeness, emoji_level, response_length
greeting, system_instructions, training_examples (JSONB)
negotiation_enabled, negotiation_flexibility

-- Business
store_name, business_type, address, phone
location_url, gps_coordinates, social_media (JSONB)
hours, return_policy, policy_description

-- Livraison & Paiement
delivery_abidjan_price, delivery_interior_price, free_delivery_threshold
accepted_payments (text[])
```

---

## 🚀 Workflow de Déploiement

### Frontend (Vercel)
1. Push sur GitHub (branche `main`)
2. Auto-déploiement Vercel
3. Build: `npm run build` (dans `/frontend`)
4. Variables d'environnement:
   ```
   VITE_API_URL=https://djassabot-saas-production.up.railway.app
   ```

### Backend (Railway)
1. Push sur GitHub (branche `main`)
2. Auto-déploiement Railway
3. Build: `npm run build` (dans `/backend`)
4. Start: `npm start` (lance `dist/index.js`)
5. Variables d'environnement: définies dans Railway Dashboard

---

## 🐛 Problèmes Résolus Récemment

### 2026-01-10 - Erreur "Génération de résumé"
- **Cause:** Clé API Gemini signalée comme leaked (403 Forbidden)
- **Solution:** Nouvelle clé API générée et mise à jour
- **Nouvelle clé:** `AIzaSy*******************************`
- **Modèle restauré:** `gemini-2.5-flash` (confirmé fonctionnel)

### 2026-01-10 - Persistance des Settings
- **Cause:** Colonnes manquantes dans la table `settings` (`address`, `phone`, `social_media`)
- **Solution:** Script SQL d'ajout de colonnes exécuté sur Supabase
- **Statut:** ✅ Résolu - Les settings sont maintenant sauvegardés correctement

### 2026-01-09 - Écran Blanc Frontend
- **Cause:** API URL incorrecte (localhost au lieu de Railway)
- **Solution:** Configuration de `VITE_API_URL` dans Vercel
- **Fichier:** `frontend/src/utils/apiConfig.ts`

---

## 📝 Conventions de Code

### Nommage
- **Fichiers:** camelCase (ex: `aiService.ts`, `dbService.ts`)
- **Composants React:** PascalCase (ex: `Settings.tsx`, `AIPlayground.tsx`)
- **Fonctions:** camelCase (ex: `generateAIResponse`, `authenticateTenant`)
- **Types/Interfaces:** PascalCase (ex: `Settings`, `Product`, `JWTPayload`)

### Structure Backend
```
backend/src/
├── config/         # Configuration (supabase, etc.)
├── controllers/    # Logique métier
├── middleware/     # Auth, validation
├── routes/         # Endpoints Express
├── services/       # Services métier (AI, DB, WhatsApp, etc.)
├── types/          # Types TypeScript partagés
├── jobs/           # Tâches cron
└── index.ts        # Point d'entrée
```

### Structure Frontend
```
frontend/src/
├── components/     # Composants réutilisables
├── pages/          # Pages principales (Dashboard, Products, Settings, etc.)
├── layouts/        # Layouts (DashboardLayout)
├── utils/          # Utilitaires (apiConfig, etc.)
└── App.tsx         # Routing principal
```

---

## 🔐 Sécurité

### Bonnes Pratiques Implémentées
- ✅ Variables sensibles dans `.env` (gitignored)
- ✅ JWT avec expiration (30 jours)
- ✅ Validation tenantId sur toutes les requêtes
- ✅ CORS configuré (Railway + Vercel uniquement)
- ✅ Isolation multi-tenant (RLS Postgres via tenantId)

### À Améliorer
- ⚠️ Changer le `JWT_SECRET` par défaut en production
- ⚠️ Ajouter rate limiting sur les endpoints sensibles
- ⚠️ Implémenter refresh tokens pour JWT

---

## 📚 Documentation Associée

- `ARCHITECTURE_SAAS.md` - Architecture détaillée
- `DEPLOYMENT_INSTRUCTIONS.md` - Instructions de déploiement
- `NEXT_STEPS.md` - Roadmap et prochaines étapes
- `INSTALLATION.md` - Setup développement local
- `database/schema.sql` - Schéma SQL complet

---

## 🧪 Testing

### Backend Local
```bash
cd backend
npm install
npm run dev
# Serveur démarre sur http://localhost:3000
```

### Frontend Local
```bash
cd frontend
npm install
npm run dev
# App démarre sur http://localhost:5173
```

### Test de l'API
```bash
# Authentification
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"anadorbreak@gmail.com","password":"celiblexus"}'

# Test AI Summary
curl -X POST http://localhost:3000/api/ai/summarize-identity \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"botName":"Awa","storeName":"Ma Boutique",...}'
```

---

## 👥 Comptes de Test

### Production
- **Email:** anadorbreak@gmail.com
- **Mot de passe:** celiblexus
- **Tenant ID:** 4add0477-920a-4d49-aede-58e9e2c18280

---

## 🎨 Design System

### Couleurs Principales
- **Background:** `#000000` (noir pur)
- **Cards:** `#18181B` (zinc-900)
- **Primary:** `#F97316` (orange-500)
- **Text:** `#FFFFFF` (white)
- **Muted:** `#71717A` (zinc-500)
- **Border:** `#27272A` (zinc-800)

### Typography
- **Font:** System fonts (sans-serif)
- **Tailles:** text-xs (10px), text-sm (14px), text-base (16px)
- **Bold:** font-bold (700), font-semibold (600)

---

## 📞 Support & Contact

Pour toute question technique ou problème, référez-vous à ce document en premier lieu.

**Dernière révision:** 2026-01-10 04:00 UTC
