# 🚂 Configuration Railway — Variables d'environnement

> **À faire UNE FOIS** pour que le backend en production utilise Supabase au lieu du mode JSON local.

---

## Étape 1 : Accéder aux variables

1. Va sur **[railway.app](https://railway.app)** → connecte-toi
2. Sélectionne ton projet **djassabot-saas-production**
3. Clique sur le service backend
4. Onglet **Variables**

---

## Étape 2 : Ajouter / Mettre à jour ces variables

Copie-colle exactement (clique "New Variable" pour chaque) :

### 🔐 Sécurité (critique)

```
JWT_SECRET=358d8cd418572f464ba92469a0171e6d3a80020f73ea3b7706563b6f6d31f074d556b2de251940087e7b94d1d59c9d3f5d3850bc0c6adecf57202608e79a036d
```

### 🗄️ Base de données Supabase

```
SUPABASE_URL=https://dnglgyviycbpoerywanc.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZ2xneXZpeWNicG9lcnl3YW5jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcyMTQzNCwiZXhwIjoyMDgzMjk3NDM0fQ.fd8-sIFYCTvydGJRK8l0mBHkZEfE6-ijq16gddNRQNs
```

### 🤖 IA & Services

```
GEMINI_API_KEY=<ta_cle_gemini>
RESEND_API_KEY=<ta_cle_resend_si_emails_OTP>
```

### 💳 Paiements Paystack

```
PAYSTACK_SECRET_KEY=<sk_test_ou_sk_live>
PAYSTACK_PUBLIC_KEY=<pk_test_ou_pk_live>
PAYSTACK_PLAN_STARTER=<code_plan_starter>
PAYSTACK_PLAN_PRO=<code_plan_pro>
PAYSTACK_PLAN_BUSINESS=<code_plan_business>
```

### 🌐 CORS & URLs

```
ALLOWED_ORIGINS=https://djassabot-saas.vercel.app,http://localhost:5173
FRONTEND_URL=https://djassabot-saas.vercel.app
API_URL=https://djassabot-saas-production.up.railway.app
NODE_ENV=production
LOG_LEVEL=info
```

---

## Étape 3 : Redéploie

Une fois toutes les vars ajoutées, Railway redéploie automatiquement. Sinon clique **Deploy** manuellement.

---

## Étape 4 : Vérifie

Une fois redéployé, va dans **Deploy Logs** et cherche :

✅ **Bon signe :**
```
[Config] ⏳ Attempting connection to Supabase at https://dnglgyviycbpoerywanc.supabase.co...
[Config] ✅ Supabase Client Initialized successfully.
[server]: Server is running at http://localhost:3000
```

❌ **Mauvais signe :**
```
[Config] ⚠️ WARNING: Running in Local Fallback Mode (RAM ONLY)
```

Si tu vois le mauvais signe, c'est qu'une variable manque.

---

## ⚠️ Sécurité — IMPORTANT

- **Ne JAMAIS commiter ces secrets dans git**
- Le `.env` local est déjà dans `.gitignore` ✅
- Si tu penses qu'un secret a fui : régénère-le immédiatement (Supabase Dashboard, Paystack Dashboard, etc.)
- Le `JWT_SECRET` au-dessus a été généré pour TOI uniquement — ne le partage avec personne

---

## 🎯 Côté Vercel (frontend)

Pareil sur Vercel ([vercel.com](https://vercel.com) → projet → Settings → Environment Variables) :

```
VITE_API_URL=https://djassabot-saas-production.up.railway.app
VITE_SUPABASE_URL=https://dnglgyviycbpoerywanc.supabase.co
VITE_SUPABASE_KEY=<anon_public_key_PAS_le_service_role>
```

⚠️ **Pour le frontend, utilise la clé `anon public` de Supabase, JAMAIS le `service_role`**
(Le `service_role` ne doit JAMAIS être exposé côté navigateur.)

Tu trouves la clé `anon` dans : Supabase Dashboard → Settings → API → `anon public`
