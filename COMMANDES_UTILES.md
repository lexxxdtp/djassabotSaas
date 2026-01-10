# 🛠️ Commandes Utiles - DjassaBot SaaS

## 🔍 Vérification & Maintenance

### Vérification Complète Automatique
```bash
# Exécuter le script de vérification complet
./scripts/check-project.sh
```

### Vérifications Manuelles

#### Backend
```bash
cd backend

# Installation
npm install

# Build
npm run build

# Vérification TypeScript (sans build)
npm run lint

# Audit de sécurité
npm audit

# Corriger les vulnérabilités
npm audit fix

# Démarrer en développement
npm run dev

# Démarrer en production
npm start
```

#### Frontend
```bash
cd frontend

# Installation
npm install

# Build
npm run build

# Audit de sécurité
npm audit

# Corriger les vulnérabilités
npm audit fix

# Démarrer en développement
npm run dev

# Preview du build production
npm run preview
```

---

## 🐛 Debugging

### Vérifier les Erreurs TypeScript
```bash
# Backend
cd backend && npx tsc --noEmit

# Frontend
cd frontend && npx tsc -b
```

### Rechercher des TODOs
```bash
# Tous les TODOs
grep -r "TODO" backend/src frontend/src

# TODOs critiques uniquement
grep -r "TODO.*CRITICAL" backend/src frontend/src
```

### Rechercher des console.log
```bash
# Backend (devrait utiliser logger)
grep -r "console\.log" backend/src

# Frontend
grep -r "console\.log" frontend/src
```

---

## 🧪 Tests & Qualité

### Vérifier le Build Production
```bash
# Backend
cd backend
rm -rf dist
npm run build
ls -lh dist/

# Frontend
cd frontend
rm -rf dist
npm run build
ls -lh dist/
```

### Analyser la Taille du Bundle
```bash
cd frontend
npm run build
# Regarder la sortie pour voir les fichiers et leurs tailles
```

---

## 🔐 Sécurité

### Audit Complet
```bash
# Backend
cd backend && npm audit

# Frontend
cd frontend && npm audit
```

### Corriger Automatiquement
```bash
# Backend
cd backend && npm audit fix

# Frontend
cd frontend && npm audit fix

# Force (pour les breaking changes)
npm audit fix --force  # ⚠️ Attention aux breaking changes
```

### Vérifier les Dépendances Obsolètes
```bash
# Installer npm-check-updates globalement
npm install -g npm-check-updates

# Vérifier les mises à jour disponibles
cd backend && ncu
cd frontend && ncu

# Mettre à jour (avec confirmation)
ncu -u
npm install
```

---

## 📦 Déploiement

### Build Production Complet
```bash
# Depuis la racine du projet
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..
```

### Nettoyage Pre-Deploy
```bash
# Nettoyer tous les builds
rm -rf backend/dist frontend/dist

# Réinstaller toutes les dépendances
cd backend && rm -rf node_modules && npm install && cd ..
cd frontend && rm -rf node_modules && npm install && cd ..
```

### Vérifier les Variables d'Environnement
```bash
# Afficher les variables (masquer les secrets)
cd backend
cat .env | grep -v "API_KEY\|SECRET"
```

---

## 🗄️ Base de Données (Supabase)

### Vérifier la Connexion
```bash
# Via le backend
cd backend
node -e "require('dotenv').config(); console.log('URL:', process.env.SUPABASE_URL);"
```

### Seed Database (Dev)
```bash
# Créer des données de test
curl -X POST http://localhost:3000/api/debug/seed \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 🚀 Développement Local

### Démarrer Backend + Frontend
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Accès Local
- **Backend:** http://localhost:3000
- **Frontend:** http://localhost:5173

---

## 📊 Monitoring & Logs

### Voir les Logs en Temps Réel
```bash
# Backend (si démarré avec npm run dev)
cd backend
tail -f $(find . -name "*.log" 2>/dev/null | head -1)
```

### Vérifier les Erreurs
```bash
# Rechercher les erreurs dans le code
grep -r "console\.error" backend/src frontend/src
```

---

## 🔄 Git & Version Control

### Vérifier le Statut
```bash
git status
git log --oneline -n 10
```

### Nettoyer avant Commit
```bash
# Vérifier les fichiers modifiés
git status

# Vérifier le .gitignore
cat .gitignore

# S'assurer que .env n'est PAS commité
git ls-files | grep ".env$"  # Devrait être vide
```

---

## 📝 Documentation

### Générer la Documentation
```bash
# Liste tous les endpoints
grep -r "app\.(get|post|put|delete)" backend/src/index.ts backend/src/routes/

# Liste tous les types
cat backend/src/types/index.ts
```

### Mettre à Jour PROJECT_STATE.md
```bash
# Après des changements importants
nano PROJECT_STATE.md
# Mettre à jour la date et les features
```

---

## 💡 Conseils de Maintenance

### Checklist Hebdomadaire
- [ ] `npm audit` sur backend + frontend
- [ ] Vérifier les TODOs critiques
- [ ] Vérifier les logs d'erreur en production
- [ ] Mettre à jour la documentation si nécessaire
- [ ] Backup de la base de données Supabase

### Checklist Avant Release
- [ ] `./scripts/check-project.sh` → Aucune erreur
- [ ] Tests manuels sur l'AI Playground
- [ ] Vérifier la connexion WhatsApp (QR Code)
- [ ] Tester la création de produit + commande
- [ ] Vérifier les variables d'environnement en prod
- [ ] Backup DB avant déploiement
- [ ] Déployer backend (Railway)
- [ ] Déployer frontend (Vercel)
- [ ] Tests post-déploiement

---

**Dernière mise à jour:** 2026-01-10  
**Maintenu par:** L'équipe DjassaBot
