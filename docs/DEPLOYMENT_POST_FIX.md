# 🚀 GUIDE DE DÉPLOIEMENT - CORRECTIONS APPLIQUÉES

**Date :** 2026-01-09  
**Changements :** Corrections critiques de l'IA Gemini

---

## ⚡ **CE QUI A ÉTÉ CORRIGÉ**

### **1. Bug de Validation de Clé API**
L'IA refusait toutes les clés valides. ✅ **CORRIGÉ**

### **2. Modèle Gemini Obsolète**
Mise à jour de `gemini-pro` vers `gemini-2.0-flash`. ✅ **CORRIGÉ**

### **3. Quota API Dépassé**
La clé actuelle a atteint sa limite. ⚠️ **ACTION REQUISE**

---

## 📋 **ÉTAPES DE DÉPLOIEMENT**

### **Étape 1 : Créer une Nouvelle Clé API Gemini** ⚠️ CRITIQUE

1. **Allez sur Google AI Studio :**
   ```
   https://aistudio.google.com/app/apikey
   ```

2. **Créez une nouvelle clé API :**
   - Cliquez sur "Create API Key"
   - Sélectionnez votre projet Google Cloud (ou créez-en un)
   - Copiez la clé (format : `AIzaSy...`)

3. **Testez la clé localement :**
   ```bash
   # Dans backend/.env, remplacez :
   GEMINI_API_KEY=VOTRE_NOUVELLE_CLÉ
   
   # Relancez le backend :
   cd backend
   npm run dev
   
   # Testez avec curl (voir ci-dessous)
   ```

4. **Test rapide :**
   ```bash
   # Connectez-vous d'abord
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"identifier": "anadorbreak@gmail.com", "password": "celiblexus"}'
   
   # Copiez le token retourné, puis :
   curl -X POST http://localhost:3000/api/ai/simulate \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer VOTRE_TOKEN" \
     -d '{"message": "Bonjour, avez-vous des produits ?"}'
   
   # ✅ Si la réponse n'est PAS "[SIMULATED AI]", c'est bon !
   ```

---

### **Étape 2 : Commiter et Pusher les Corrections**

```bash
# 1. Ajoutez tous les fichiers
git add .

# 2. Commitez avec un message clair
git commit -m "🐛 Fix: Gemini API key validation + update to gemini-2.0-flash model"

# 3. Pushez vers GitHub
git push origin main
```

**Note :** Railway va automatiquement redéployer dès que vous pushez !

---

### **Étape 3 : Mettre à Jour les Variables d'Environnement sur Railway**

1. **Allez sur Railway :**
   ```
   https://railway.app
   ```

2. **Ouvrez votre projet backend**

3. **Variables → Modifier :**
   ```env
   GEMINI_API_KEY=VOTRE_NOUVELLE_CLÉ_COPIÉE_ÉTAPE_1
   ```

4. **Sauvegardez**
   - Railway va redémarrer automatiquement le service
   - Attendez 1-2 minutes que le déploiement se termine

---

### **Étape 4 : Vérifier le Déploiement**

#### **A. Vérifier les Logs Railway**

1. Railway → Votre Projet → Onglet "Deployments"
2. Cliquez sur le dernier déploiement
3. Onglet "View Logs"

**Cherchez ces logs :**
```
✅ [Config] ✅ Supabase Client Initialized
✅ [server]: Server is running at http://localhost:3000
✅ [Startup] Vérification des tenants WhatsApp...
```

**Erreurs à surveiller :**
```
❌ [429 Too Many Requests] → La clé API n'est pas encore mise à jour
❌ [404 Not Found] models/... → Le modèle n'est pas supporté (ne devrait plus arriver)
```

#### **B. Tester l'API en Production**

```bash
# Remplacez YOUR_RAILWAY_URL par votre URL Railway
API_URL="https://votre-backend.up.railway.app"

# Test 1 : Login
curl -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "anadorbreak@gmail.com", "password": "celiblexus"}'

# → Copiez le token

# Test 2 : Test IA
curl -X POST $API_URL/api/ai/simulate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_TOKEN" \
  -d '{"message": "Bonjour !"}'

# ✅ Résultat attendu : Une vraie réponse Gemini (pas mock)
```

---

### **Étape 5 : Vérifier le Frontend (Vercel)**

#### **A. Variables d'Environnement Vercel**

1. Vercel Dashboard → Votre Projet Frontend
2. Settings → Environment Variables
3. Vérifiez :
   ```
   VITE_API_URL=https://votre-backend.up.railway.app/api
   ```
   **Attention :** PAS de slash `/` à la fin !

#### **B. Tester le Site**

1. Ouvrez votre URL Vercel (ex: `https://tdjaasa-saas.vercel.app`)
2. Connectez-vous avec : `anadorbreak@gmail.com` / `celiblexus`
3. Allez dans **Settings → AI Playground**
4. Envoyez un message test
5. ✅ **Succès si :** La réponse est personnalisée et cohérente (pas "[SIMULATED AI]")

---

## 🧪 **TESTS DE VALIDATION**

### **Test 1 : IA Standard**
```
Message User: "Bonjour, qu'est-ce que vous vendez ?"
Réponse Attendue: Une vraie salutation avec liste de produits
```

### **Test 2 : Négociation**
```
Message User: "Combien pour le Bazin ?"
Réponse Attendue: Prix + possibilité de négociation
```

### **Test 3 : Note Vocale**
```
Action: Envoyer une note vocale sur WhatsApp
Réponse Attendue: Transcription + réponse adaptée
```

### **Test 4 : Image**
```
Action: Envoyer une photo de produit
Réponse Attendue: Analyse de l'image + correspondance avec l'inventaire
```

---

## 🔍 **TROUBLESHOOTING**

### **Problème : "Pas de clé API" en production**

**Causes possibles :**
1. ⚠️ La variable `GEMINI_API_KEY` n'est pas définie sur Railway
2. ⚠️ Railway n'a pas redémarré après la mise à jour
3. ⚠️ Vous avez oublié de pusher le code corrigé

**Solution :**
```bash
# Vérifier que le code est bien poussé
git log --oneline -1

# Forcer un redéploiement sur Railway
# Railway Dashboard → Deployments → "Redeploy"
```

---

### **Problème : Quota API dépassé**

**Message d'erreur :**
```
[429 Too Many Requests] You exceeded your current quota
```

**Solution :**
- ✅ Avez-vous créé UNE NOUVELLE clé API ?
- ✅ Avez-vous mis à jour la variable sur Railway ?
- ✅ Avez-vous redémarré le service ?

**Si vous avez tout fait :**
- Attendez 5-10 minutes que les changements se propagent
- Ou activez la facturation sur Google Cloud pour augmenter les quotas

---

### **Problème : Frontend ne se connecte pas au Backend**

**Symptôme :** Erreurs CORS ou Network Error

**Solution :**
1. Vérifiez `VITE_API_URL` dans Vercel :
   ```
   ✅ CORRECT: https://backend.railway.app/api
   ❌ INCORRECT: https://backend.railway.app/api/  (slash à la fin)
   ❌ INCORRECT: http://localhost:3000/api  (pas en local !)
   ```

2. Vérifiez que le backend autorise CORS :
   - Dans `backend/src/index.ts`, ligne ~27 : `app.use(cors());`
   - C'est déjà présent ✅

---

## 📊 **CHECKLIST FINALE**

Avant de tester avec de vrais utilisateurs :

- [ ] ✅ Nouvelle clé API Gemini créée
- [ ] ✅ Clé API mise à jour dans `backend/.env` (local)
- [ ] ✅ Clé API mise à jour dans Railway (production)
- [ ] ✅ Code poussé sur GitHub (`git push`)
- [ ] ✅ Railway a redéployé automatiquement
- [ ] ✅ Logs Railway montrent "Server is running"
- [ ] ✅ Test API `/api/auth/login` fonctionne
- [ ] ✅ Test API `/api/ai/simulate` retourne une vraie réponse
- [ ] ✅ Frontend Vercel affiche le site correctement
- [ ] ✅ Login sur le site fonctionne
- [ ] ✅ AI Playground retourne des réponses Gemini
- [ ] ✅ Connexion WhatsApp fonctionne (QR Code scan)
- [ ] ✅ Bot répond sur WhatsApp avec Gemini

---

## 🎯 **PROCHAINES ÉTAPES APRÈS DÉPLOIEMENT**

### **Immédiat (< 1h)**
1. Tester toutes les fonctionnalités IA
2. Vérifier que le flux de commande complet fonctionne
3. Créer 2-3 produits de test avec images

### **Court Terme (1-3 jours)**
1. Inviter 3-5 testeurs à créer un compte
2. Observer les logs Railway pour détecter les bugs
3. Collecter les retours utilisateurs

### **Moyen Terme (1-2 semaines)**
1. Optimiser les prompts IA selon les retours
2. Ajouter des règles de négociation spécifiques
3. Améliorer le dashboard avec plus de stats

---

## 📞 **SUPPORT**

En cas de problème lors du déploiement :

1. **Vérifiez les logs Railway** (90% des problèmes s'y trouvent)
2. **Consultez `GEMINI_API_FIX.md`** pour les détails techniques
3. **Lisez `PROJECT_REVIEW.md`** pour l'architecture complète

---

**Créé le :** 2026-01-09  
**Dernière mise à jour :** 2026-01-09  
**Version :** 1.0 (Post-fix Gemini API)
