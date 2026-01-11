# 🧠 TDJaasa - WhatsApp AI Commerce Bot (SaaS)

> Une plateforme SaaS complète permettant aux commerçants africains de créer leur propre assistant de vente IA sur WhatsApp.

## 🎯 Vue d'ensemble

TDJaasa est une solution clé en main qui transforme WhatsApp en canal de vente automatisé grâce à l'intelligence artificielle. Les vendeurs peuvent gérer leurs produits, suivre les commandes et laisser l'IA négocier et conclure les ventes 24h/24.

## 🏗️ Architecture

```
foldertdjaasa/
├── backend/           # API Node.js/Express (TypeScript)
│   ├── src/
│   │   ├── services/  # Services métier (AI, WhatsApp, DB)
│   │   ├── routes/    # Endpoints API
│   │   ├── middleware/# Auth JWT, validation
│   │   └── types/     # TypeScript interfaces
│   └── supabase_full_schema.sql  # Schéma DB complet
│
├── frontend/          # React/Vite Dashboard
│   ├── src/
│   │   ├── pages/     # Pages principales
│   │   ├── components/# Composants réutilisables
│   │   └── context/   # État global Auth
│   └── vite.config.ts
│
├── database/          # Scripts SQL legacy
│   └── schema.sql
│
├── docs/              # Documentation détaillée
│   ├── INSTALLATION.md
│   ├── ARCHITECTURE_SAAS.md
│   └── ...
│
└── scripts/           # Scripts utilitaires
```

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 18+
- npm ou yarn
- Compte Supabase (gratuit)
- Clé API Google Gemini (gratuit)

### Installation

```bash
# 1. Cloner le repo
git clone <repo-url>
cd foldertdjaasa

# 2. Backend
cd backend
cp .env.example .env
# Remplir les variables dans .env
npm install
npm run dev

# 3. Frontend (nouveau terminal)
cd ../frontend
npm install
npm run dev
```

### Variables d'environnement

**Backend (.env):**
```
JWT_SECRET=votre-secret-jwt
GEMINI_API_KEY=votre-cle-gemini
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=votre-cle-anon
```

**Frontend (.env):**
```
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_KEY=votre-cle-anon
```

## ✨ Fonctionnalités

### Multi-Tenant SaaS
- ✅ Isolation complète des données par tenant
- ✅ Authentification JWT sécurisée
- ✅ Système d'abonnement (Starter/Pro/Business)

### Intelligence Artificielle
- ✅ Réponses contextuelles via Gemini
- ✅ Négociation automatique avec prix plancher
- ✅ Analyse d'images produits
- ✅ Transcription vocale

### Gestion Commerce
- ✅ Catalogue produits avec variations
- ✅ Suivi des commandes
- ✅ Gestion de stock (Strict/Flexible)
- ✅ Rappels paniers abandonnés

### Intégration WhatsApp
- ✅ Connexion via QR Code (Baileys)
- ✅ Messages texte, images, audio
- ✅ Historique de conversation persistant

## 📊 Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Backend | Node.js, Express, TypeScript |
| Frontend | React 19, Vite, TailwindCSS |
| Base de données | Supabase (PostgreSQL) |
| IA | Google Gemini 2.0 |
| WhatsApp | Baileys (Web Client) |
| Auth | JWT |

## 📄 Documentation

Voir le dossier `docs/` pour la documentation complète :
- [Installation détaillée](docs/INSTALLATION.md)
- [Architecture technique](docs/ARCHITECTURE_SAAS.md)
- [Guide de déploiement](docs/DEPLOYMENT_INSTRUCTIONS.md)
- [Roadmap de développement](docs/DEVELOPMENT_ROADMAP.md)

## 🧪 Tests

```bash
# Backend TypeScript check
cd backend && npm run lint

# Frontend lint
cd frontend && npm run lint

# Build production
npm run build
```

## 📝 License

Projet propriétaire - Tous droits réservés

---

**Développé avec ❤️ pour le commerce africain**
