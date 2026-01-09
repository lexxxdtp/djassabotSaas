# 🚀 INSTALLATION & DÉMARRAGE - TDJAASA BOT

## 📋 Prérequis

*   **Node.js** >= 18.x
*   **npm** >= 9.x
*   **Compte Supabase** (gratuit) → [supabase.com](https://supabase.com)
*   **Clé API Google Gemini** (gratuite) → [ai.google.dev](https://ai.google.dev/)

---

## ⚙️ INSTALLATION

### 1. **Cloner / Télécharger le projet**
```bash
cd /Users/alexvianneykoffi/Downloads/foldertdjaasa
```

### 2. **Configurer Supabase**

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Allez dans **SQL Editor**
3. Copiez tout le contenu de `database/schema.sql`
4. Exécutez le SQL dans l'éditeur
5. Récupérez vos credentials :
   - `SUPABASE_URL` : Dans Project Settings → API → Project URL
   - `SUPABASE_KEY` : Dans Project Settings → API → `anon` `public` key

### 3. **Configurer les Variables d'Environnement**

**Backend** :
```bash
cd backend
cp .env.example .env
nano .env  # Ou ouvrez avec VS Code
```

Remplir :
```env
JWT_SECRET=votre-secret-tres-long-et-aleatoire-ici
GEMINI_API_KEY=votre_cle_gemini_ici
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGc...
```

**Frontend** (si besoin de Supabase côté client) :
```bash
cd ../frontend
cp .env.example .env
nano .env
```

Remplir :
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_KEY=eyJhbGc...
```

### 4. **Installer les Dépendances**

**Backend** :
```bash
cd backend
npm install
```

**Frontend** :
```bash
cd ../frontend
npm install
```

---

## 🚀 DÉMARRAGE

### **Mode Développement**

**Terminal 1 - Backend** :
```bash
cd backend
npm run dev
```
✅ Le serveur démarre sur `http://localhost:3000`

**Terminal 2 - Frontend** :
```bash
cd frontend
npm run dev
```
✅ Le dashboard s'ouvre sur `http://localhost:5173`

### **Premier Compte (Signup)**

1. Ouvrez `http://localhost:5173`
2. Vous serez redirigé vers `/signup`
3. Créez votre compte :
   -   **Nom du Business** : Ex. "Friperie Abobo"
   -   **Email** : votre@email.com
   -   **Mot de passe** : Min. 8 caractères
4. Cliquez sur "Créer mon compte"
5. Vous êtes connecté automatiquement ! 🎉

---

## 🧪 TESTER L'AUTHENTIFICATION

### **Avec curl** :

**Signup** :
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Boutique",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Login** :
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Copiez le `token` retourné.

**Tester une route protégée** :
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

---

## 📊 VÉRIFIER LA BASE DE DONNÉES

1. Allez sur [supabase.com](https://supabase.com)
2. Ouvrez votre projet
3. Allez dans **Table Editor**
4. Vérifiez que les tables suivantes existent :
   - `tenants`
   - `users`
   - `subscriptions`
   - `products`
   - `orders`
   - `settings`

5. Vous devriez voir votre tenant de test créé !

---

## 🐛 TROUBLESHOOTING

### **Erreur : "Cannot find module 'xxx'"**
```bash
cd backend
npm install
```

### **Erreur : "SUPABASE_URL is not defined"**
→ Vérifiez que `/backend/.env` existe et contient les bonnes valeurs

### **Erreur : "Connection refused"**
→ Vérifiez que le backend tourne bien sur le port 3000

### **Frontend ne se connecte pas au backend**
→ Vite proxy est configuré ? Vérifiez `frontend/vite.config.ts` :
```ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
});
```

---

## ✅ PROCHAINES ÉTAPES

Maintenant que l'auth fonctionne :
1.  **Semaine 2** : Créer `baileysManager.ts` pour multi-instance WhatsApp
2.  **Semaine 3** : Modifier le Dashboard pour utiliser les tokens
3.  **Semaine 4** : Tests multi-tenant + Déploiement

Consultez `DEVELOPMENT_ROADMAP.md` pour le planning complet !

---

**Besoin d'aide ?** 💬 Ouvrez un issue ou contactez l'équipe.
