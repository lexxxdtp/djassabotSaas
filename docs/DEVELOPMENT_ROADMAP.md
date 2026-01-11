# 🎯 ROADMAP DE DÉVELOPPEMENT OPTIMAL - TDJAASA SAAS

## 🏆 MÉTHODE CHOISIE : MVP MULTI-TENANT LEAN

### Pourquoi cette approche ?

| Critère              | MVP Lean      | Refonte Totale | Migration Progressive |
|----------------------|---------------|----------------|-----------------------|
| **Time-to-Market**   | ✅ 3-4 sem    | ❌ 2-3 mois    | ⚠️ 6-8 semaines      |
| **Risque**           | ✅ Faible     | ❌ Élevé       | ⚠️ Moyen             |
| **Revenus Rapides**  | ✅ Mois 2     | ❌ Mois 4+     | ⚠️ Mois 3            |
| **Validation Marché**| ✅ Immédiate  | ❌ Tardive     | ⚠️ Différée          |
| **Flexibilité**      | ✅ Maximale   | ⚠️ Figé        | ✅ Bonne             |
| **Complexité Code**  | ✅ Simple     | ⚠️ Moyenne     | ❌ Élevée            |

**Verdict** : 🚀 **MVP Multi-Tenant Lean = Meilleur ROI**

---

## 📦 DÉFINITION DU MVP (Minimum Viable Product)

### Ce qu'on GARDE du code actuel
*   ✅ Interface Dashboard React (design existant)
*   ✅ Logique IA Gemini (`aiService.ts`)
*   ✅ Structure de données (Order, Product, Settings)
*   ✅ Intégration Baileys (WhatsApp)

### Ce qu'on AJOUTE (Multi-Tenant Core)
*   🆕 **Authentification** (JWT, Signup/Login)
*   🆕 **Isolation par Tenant** (middleware + DB filtering)
*   🆕 **Onboarding Simple** (1 page : Signup → Connexion WA)
*   🆕 **Instance Manager** (1 Baileys par tenant)
*   🆕 **Paiement Manuel** (Validation admin pour le MVP)

### Ce qu'on RETIRE (pour accélérer)
*   ❌ Paiement automatique Wave/OM (Phase 2)
*   ❌ Analytics avancés (Phase 2)
*   ❌ Multi-agents (3 numéros) (Phase 2)
*   ❌ White-label (Phase 2)
*   ❌ API/Webhooks (Phase 2)

---

## 🗓️ PLANNING DE DÉVELOPPEMENT (4 SEMAINES)

### **SEMAINE 1 : Foundation (Backend Multi-Tenant)**

#### **Jour 1-2** : Base de Données Supabase
```sql
-- Créer les tables essentielles
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    business_type TEXT,
    status TEXT DEFAULT 'trial', -- trial, active, suspended
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'owner'
);

-- Modifier les tables existantes
ALTER TABLE products ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE orders ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE settings ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Activer Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON products
    USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

**Livrables** :
- [ ] Tables créées sur Supabase
- [ ] RLS configuré
- [ ] Seed script pour créer 2 tenants de test

---

#### **Jour 3-4** : Authentification Backend
**Fichier** : `backend/src/middleware/auth.ts` (nouveau)
```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const authenticateTenant = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Non autorisé' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.tenantId = decoded.tenantId;
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token invalide' });
    }
};
```

**Fichier** : `backend/src/routes/authRoutes.ts` (nouveau)
```typescript
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../services/dbService';

const router = express.Router();

// Signup
router.post('/signup', async (req, res) => {
    const { businessName, email, password } = req.body;
    
    // 1. Créer le tenant
    const tenant = await db.createTenant({ name: businessName });
    
    // 2. Hasher le password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // 3. Créer l'utilisateur
    const user = await db.createUser({
        tenantId: tenant.id,
        email,
        passwordHash
    });
    
    // 4. Générer le JWT
    const token = jwt.sign(
        { tenantId: tenant.id, userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
    
    res.json({ token, tenantId: tenant.id });
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    const user = await db.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Email invalide' });
    
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe invalide' });
    
    const token = jwt.sign(
        { tenantId: user.tenantId, userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
    
    res.json({ token, tenantId: user.tenantId });
});

export default router;
```

**Livrables** :
- [ ] Middleware `auth.ts` créé
- [ ] Routes `/api/auth/signup` et `/api/auth/login` fonctionnelles
- [ ] Test avec Postman/Insomnia

---

#### **Jour 5-7** : Adapter dbService pour Multi-Tenant
**Fichier** : `backend/src/services/dbService.ts` (modifier)

```typescript
// AVANT (single-tenant)
getProducts: async () => {
    const { data } = await supabase.from('products').select('*');
    return data;
}

// APRÈS (multi-tenant)
getProducts: async (tenantId: string) => {
    const { data } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId);
    return data;
}
```

**Appliquer à TOUTES les fonctions** :
- `getProducts(tenantId)`
- `getOrders(tenantId)`
- `getSettings(tenantId)`
- `createOrder(tenantId, ...)`
- etc.

**Livrables** :
- [ ] Toutes les fonctions DB acceptent `tenantId`
- [ ] Tests unitaires passent avec 2 tenants différents

---

### **SEMAINE 2 : Multi-Instance WhatsApp**

#### **Jour 8-10** : Baileys Instance Manager
**Fichier** : `backend/src/services/baileysManager.ts` (nouveau)

```typescript
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { db } from './dbService';
import { generateAIResponse } from './aiService';

// Map pour stocker les instances actives
const activeInstances = new Map<string, any>();

export const initTenantWhatsApp = async (tenantId: string) => {
    // Éviter les doublons
    if (activeInstances.has(tenantId)) {
        console.log(`Instance déjà active pour tenant ${tenantId}`);
        return activeInstances.get(tenantId);
    }
    
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${tenantId}`);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });
    
    // Gestion de la connexion
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            // Sauvegarder le QR Code dans la DB pour l'afficher au tenant
            await db.updateTenantQRCode(tenantId, qr);
        }
        
        if (connection === 'close') {
            const shouldReconnect = 
                (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
            
            if (shouldReconnect) {
                initTenantWhatsApp(tenantId); // Reconnexion auto
            } else {
                activeInstances.delete(tenantId);
            }
        } else if (connection === 'open') {
            console.log(`✅ Tenant ${tenantId} connecté à WhatsApp`);
            await db.updateTenantStatus(tenantId, 'connected');
        }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    // Handler des messages (ISOLÉ par tenant)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (msg.key.fromMe || !msg.message) continue;
            
            const userMessage = msg.message.conversation || 
                                msg.message.extendedTextMessage?.text || '';
            
            // 1. Récupérer le contexte du TENANT spécifique
            const settings = await db.getSettings(tenantId);
            const products = await db.getProducts(tenantId);
            
            // 2. Générer la réponse IA avec le contexte tenant
            const aiResponse = await generateAIResponse(userMessage, {
                tenantId,
                settings,
                products
            });
            
            // 3. Envoyer la réponse
            await sock.sendMessage(msg.key.remoteJid!, { text: aiResponse });
        }
    });
    
    activeInstances.set(tenantId, sock);
    return sock;
};

// Démarrer toutes les instances au boot du serveur
export const startAllTenantInstances = async () => {
    const tenants = await db.getActiveTenants();
    
    for (const tenant of tenants) {
        console.log(`Démarrage instance pour tenant ${tenant.id}...`);
        await initTenantWhatsApp(tenant.id);
    }
};

// Arrêter une instance (logout)
export const stopTenantWhatsApp = async (tenantId: string) => {
    const sock = activeInstances.get(tenantId);
    if (sock) {
        await sock.logout();
        activeInstances.delete(tenantId);
    }
};
```

**Modifier** : `backend/src/index.ts`
```typescript
import { startAllTenantInstances } from './services/baileysManager';

// Au démarrage du serveur
app.listen(3000, async () => {
    console.log('Server running on port 3000');
    
    // Démarrer toutes les instances WhatsApp
    await startAllTenantInstances();
});
```

**Livrables** :
- [ ] `baileysManager.ts` créé
- [ ] Test avec 2 tenants simultanés (2 QR Codes différents)
- [ ] Isolation confirmée (Tenant A ne reçoit pas les messages de Tenant B)

---

#### **Jour 11-14** : Routes API Tenant-Aware
**Fichier** : `backend/src/index.ts` (modifier)

```typescript
import authRoutes from './routes/authRoutes';
import { authenticateTenant } from './middleware/auth';
import { initTenantWhatsApp, stopTenantWhatsApp } from './services/baileysManager';

// Routes publiques (pas d'auth)
app.use('/api/auth', authRoutes);

// Routes protégées (nécessitent JWT)
app.use('/api/*', authenticateTenant); // Appliquer le middleware partout

// Settings (tenant-aware)
app.get('/api/settings', async (req, res) => {
    const settings = await db.getSettings(req.tenantId); // req.tenantId injecté par le middleware
    res.json(settings);
});

app.put('/api/settings', async (req, res) => {
    await db.updateSettings(req.tenantId, req.body);
    res.json({ success: true });
});

// Products
app.get('/api/products', async (req, res) => {
    const products = await db.getProducts(req.tenantId);
    res.json(products);
});

// Orders
app.get('/api/orders', async (req, res) => {
    const orders = await db.getOrders(req.tenantId);
    res.json(orders);
});

// WhatsApp Connection
app.post('/api/whatsapp/connect', async (req, res) => {
    await initTenantWhatsApp(req.tenantId);
    res.json({ success: true });
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
    await stopTenantWhatsApp(req.tenantId);
    res.json({ success: true });
});

app.get('/api/whatsapp/status', async (req, res) => {
    const status = await db.getTenantWhatsAppStatus(req.tenantId);
    res.json(status);
});
```

**Livrables** :
- [ ] Toutes les routes utilisent `req.tenantId`
- [ ] Test : Connexion avec Token Tenant A → Voir uniquement les produits de A

---

### **SEMAINE 3 : Frontend Onboarding + Dashboard**

#### **Jour 15-17** : Page Signup/Login
**Fichier** : `frontend/src/pages/Signup.tsx` (nouveau)

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Signup() {
    const [formData, setFormData] = useState({
        businessName: '',
        email: '',
        password: ''
    });
    const navigate = useNavigate();
    
    const handleSignup = async (e) => {
        e.preventDefault();
        
        const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const data = await res.json();
        
        if (res.ok) {
            // Sauvegarder le token
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('tenantId', data.tenantId);
            
            // Rediriger vers le dashboard
            navigate('/dashboard');
        } else {
            alert('Erreur: ' + data.error);
        }
    };
    
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full">
                <h1 className="text-3xl font-bold text-white mb-6">
                    Créez votre Bot WhatsApp 🇨🇮
                </h1>
                
                <form onSubmit={handleSignup} className="space-y-4">
                    <div>
                        <label className="block text-slate-400 text-sm mb-2">Nom du Business</label>
                        <input
                            type="text"
                            value={formData.businessName}
                            onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                            placeholder="Ex: Friperie Abobo"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-slate-400 text-sm mb-2">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                            placeholder="votre@email.com"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-slate-400 text-sm mb-2">Mot de passe</label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                            placeholder="Min. 8 caractères"
                            required
                        />
                    </div>
                    
                    <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition-colors"
                    >
                        Créer mon compte
                    </button>
                </form>
                
                <p className="text-slate-500 text-sm mt-4 text-center">
                    Déjà inscrit ? <a href="/login" className="text-indigo-400 hover:underline">Se connecter</a>
                </p>
            </div>
        </div>
    );
}
```

**Livrables** :
- [ ] Page Signup fonctionnelle
- [ ] Page Login (similaire)
- [ ] Token sauvegardé dans localStorage

---

#### **Jour 18-21** : Adapter le Dashboard existant
**Fichier** : `frontend/src/App.tsx` (modifier)

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('authToken');
    return token ? children : <Navigate to="/login" />;
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/signup" element={<Signup />} />
                <Route path="/login" element={<Login />} />
                
                <Route
                    path="/dashboard/*"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                
                <Route path="/" element={<Navigate to="/login" />} />
            </Routes>
        </BrowserRouter>
    );
}
```

**Modifier toutes les requêtes API** pour inclure le token :
```tsx
// Exemple dans Overview.tsx
useEffect(() => {
    const fetchData = async () => {
        const token = localStorage.getItem('authToken');
        
        const res = await fetch('/api/orders', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const orders = await res.json();
        // ...
    };
    fetchData();
}, []);
```

**Livrables** :
- [ ] Dashboard protégé par JWT
- [ ] Toutes les pages (Overview, Orders, Products, Settings) utilisent le token
- [ ] Logout fonctionnel (supprime le token + redirige vers login)

---

### **SEMAINE 4 : Tests + Déploiement MVP**

#### **Jour 22-24** : Tests Multi-Tenant
**Scénario de test** :
1. Créer 2 comptes : `tenant_friperie@test.com` et `tenant_resto@test.com`
2. Se connecter avec Friperie :
   - Ajouter 5 produits (habits)
   - Connecter WhatsApp
   - Envoyer un message "Bonjour" depuis un téléphone externe
   - Vérifier que le bot répond avec le contexte Friperie
3. Se connecter avec Resto :
   - Ajouter 3 produits (plats)
   - Connecter WhatsApp (numéro différent)
   - Envoyer un message "Bonjour"
   - Vérifier que le bot répond avec le contexte Resto
4. **Test d'isolation** : Vérifier que Resto ne voit AUCUNE donnée de Friperie

**Livrables** :
- [ ] 2 tenants fonctionnent en parallèle
- [ ] Pas de fuite de données entre tenants
- [ ] Chaque bot répond uniquement selon son inventaire

---

#### **Jour 25-28** : Déploiement Production
**Hébergement** :
1. **Backend** : Railway.app (Hobby $5/mois)
   - Variables d'env : `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY`
   - Activer les persistent volumes pour `/sessions`
2. **Frontend** : Vercel (Gratuit)
   - Build command : `npm run build`
   - Env : `VITE_API_URL=https://your-railway-url.railway.app`
3. **Database** : Supabase (déjà configuré)

**Livrables** :
- [ ] MVP déployé sur `tdjaasa-mvp.vercel.app`
- [ ] Backend accessible via Railway
- [ ] 100% fonctionnel en production

---

## 🎯 MÉTRIQUES DE SUCCÈS MVP

### **Critères de Validation (Go/No-Go)**
*   ✅ **5 clients payants** activés dans les 2 semaines post-lancement
*   ✅ **Taux de satisfaction** > 80% (sondage après 1 semaine d'usage)
*   ✅ **Uptime** > 95% (pas de crash critique)
*   ✅ **Réponse IA** < 3 secondes en moyenne

Si **3/4 critères atteints** → 🚀 **GO pour Phase 2**

---

## 🔄 PHASE 2 : Features Pro (Semaines 5-8)

### Ajouter si le MVP réussit :
1.  **Paiement Wave/Orange Money** (Webhooks automatiques)
2.  **Analytics avancés** (Graphiques détaillés, Export CSV)
3.  **Notifications Email** (Nouvelle commande → Email au vendeur)
4.  **API Publique** (pour intégrations externes)
5.  **Programme d'Affiliation** (Parrainage = Réduction)

---

## 📋 CHECKLIST DE DÉVELOPPEMENT

### Semaine 1
- [ ] Tables Supabase créées
- [ ] RLS activé
- [ ] Auth backend (signup/login)
- [ ] dbService multi-tenant

### Semaine 2
- [ ] baileysManager fonctionnel
- [ ] 2 instances simultanées testées
- [ ] Routes API tenant-aware

### Semaine 3
- [ ] Pages Signup/Login frontend
- [ ] Dashboard protégé JWT
- [ ] Toutes les pages utilisent le token

### Semaine 4
- [ ] Tests multi-tenant réussis
- [ ] Déploiement production
- [ ] MVP LIVE avec 5 early adopters

---

## 🚨 POINTS D'ATTENTION

### Pièges à éviter
1.  **Ne PAS tout coder d'un coup** : Suivre le planning semaine par semaine
2.  **Ne PAS ajouter de features hors MVP** : Résister à la tentation
3.  **Tester l'isolation CONSTAMMENT** : Bug critique si les données fuitent entre tenants

### Debug Tips
*   **Logs Tenant-Aware** : Préfixer chaque log avec `[Tenant ${tenantId}]`
*   **Supabase Dashboard** : Vérifier manuellement les données dans les tables
*   **Postman Collection** : Créer une collection pour tester les routes avec différents tokens

---

## 💡 APRÈS LE MVP : Stratégie de Scaling

Une fois le MVP validé :
1.  **Automatiser l'onboarding** (paiement Wave intégré)
2.  **Marketing local** (Groupes WhatsApp, Facebook)
3.  **Optimiser les coûts IA** (Context Caching Gemini = -90%)
4.  **Recruter un Support** (Répondre aux questions clients)
5.  **Lever des fonds** (si objectif > 500 clients)

---

**TL;DR : 4 semaines pour un MVP rentable. Validation marché rapide. Scale ensuite.**
