# 🏗️ ARCHITECTURE SAAS MULTI-TENANT - TDJAASA BOT

## 🎯 Vision Stratégique

Transformer Tdjaasa Bot d'un **outil individuel** en une **plateforme SaaS** où chaque business (friperie, restaurant, boutique) peut :
1. S'inscrire et payer un abonnement mensuel
2. Connecter son propre numéro WhatsApp via QR Code
3. Configurer l'identité de son bot (produits, services, prix)
4. Laisser le bot gérer les clients automatiquement

---

## 🔑 Principes Clés de l'Architecture Multi-Tenant

### 1. **Isolation des Données (Tenant Isolation)**
Chaque client (tenant) doit avoir ses données **complètement isolées** :
*   ✅ **Base de données par tenant** : Chaque client a sa propre table/collection isolée
*   ✅ **Session WhatsApp par tenant** : Chaque client = 1 instance Baileys unique
*   ✅ **Contexte IA par tenant** : Le bot "oublie" les autres clients et ne répond qu'avec l'inventaire du tenant actif

### 2. **Architecture Proposée**

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React Dashboard)                    │
│  - Signup / Login (authentification tenant)                     │
│  - Onboarding (paiement → connexion WA → configuration)        │
│  - Dashboard Tenant (mes ventes, mes produits, mes paramètres)  │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND (Node.js + Express)                │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ Auth Service     │  │ Tenant Manager   │  │ Billing API   │ │
│  │ (JWT tokens)     │  │ (tenant context) │  │ (Wave/OM)     │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         WhatsApp Instances Manager (Multi-Baileys)       │  │
│  │  - Instance 1 (Tenant A: Friperie Abobo)                 │  │
│  │  - Instance 2 (Tenant B: Restaurant Marcory)             │  │
│  │  - Instance 3 (Tenant C: Boutique Cosmétique)            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            AI Service (Gemini avec contexte tenant)      │  │
│  │  - Prompt = System Instructions Tenant X                 │  │
│  │  - Inventory Access = Products Tenant X uniquement       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DATABASE (Supabase Multi-Tenant)                │
│                                                                  │
│  Table: tenants                                                  │
│  - id, name, subscription_tier, status, created_at              │
│                                                                  │
│  Table: users                                                    │
│  - id, tenant_id (FK), email, password_hash, role               │
│                                                                  │
│  Table: products                                                 │
│  - id, tenant_id (FK), name, price, stock, image_url            │
│                                                                  │
│  Table: orders                                                   │
│  - id, tenant_id (FK), customer_phone, items, total, status     │
│                                                                  │
│  Table: whatsapp_sessions                                        │
│  - id, tenant_id (FK), phone_number, qr_code, status, creds     │
│                                                                  │
│  Table: subscriptions                                            │
│  - id, tenant_id (FK), plan (starter/pro/business), expires_at  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flux Utilisateur (Onboarding)

### **Étape 1 : Inscription**
1. Le business owner visite `tdjaasa.ci/signup`
2. Remplit : Nom du business, Email, Mot de passe
3. Sélectionne un Forfait (Starter / Pro / Business)

### **Étape 2 : Paiement**
1. Redirection vers Wave/Orange Money/Stripe
2. Paiement de 5000F, 10000F ou 15000F
3. Webhook confirme le paiement → Activation du compte

### **Étape 3 : Configuration**
1. **Dashboard s'ouvre** : "Bienvenue sur Tdjaasa !"
2. **Connexion WhatsApp** : Scan du QR Code avec le numéro du business
3. **Configuration Produits** : Importer ou créer les produits (Nom, Prix, Photo)
4. **Identité du Bot** : Définir le ton, les instructions spéciales

### **Étape 4 : Activation**
1. Le bot est LIVE sur WhatsApp
2. Les clients du business peuvent envoyer des messages
3. Le bot répond automatiquement en utilisant l'inventaire du tenant

---

## 🚀 Modifications Techniques Nécessaires

### **1. Authentication & Authorization**
**Fichier** : `backend/src/middleware/auth.ts` (nouveau)
```typescript
// Middleware pour vérifier le JWT et extraire le tenant_id
export const authenticateTenant = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Non autorisé' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.tenantId = decoded.tenantId; // Injecte le tenant_id dans la requête
    next();
};
```

### **2. Database Service Multi-Tenant**
**Fichier** : `backend/src/services/dbService.ts` (modifier)
```typescript
// Exemple : getProducts devient tenant-aware
getProducts: async (tenantId: string) => {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId); // Filtrer par tenant
    return data;
}
```

### **3. Multi-Instance WhatsApp (Baileys)**
**Fichier** : `backend/src/services/baileysManager.ts` (nouveau)
```typescript
// Map pour stocker une instance Baileys par tenant
const whatsappInstances = new Map<string, WASocket>();

export const initTenantWhatsApp = async (tenantId: string, phoneNumber: string) => {
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${tenantId}`);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });
    
    sock.ev.on('connection.update', (update) => {
        // Gérer QR, connexion pour CE tenant
    });
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        // Passer le TENANT_ID à l'AI Service
        const response = await generateAIResponse(message.text, { tenantId });
        await sock.sendMessage(message.from, { text: response });
    });
    
    whatsappInstances.set(tenantId, sock);
};
```

### **4. AI Service avec Contexte Tenant**
**Fichier** : `backend/src/services/aiService.ts` (modifier)
```typescript
export const generateAIResponse = async (
    message: string, 
    context: { tenantId: string }
) => {
    // 1. Récupérer les settings du TENANT spécifique
    const settings = await db.getSettings(context.tenantId);
    const products = await db.getProducts(context.tenantId);
    
    // 2. Construire le prompt avec les données du tenant
    const systemInstruction = `
        Tu es ${settings.botName}, assistant de vente pour ${settings.businessName}.
        Produits disponibles : ${JSON.stringify(products)}
        Instructions spécifiques : ${settings.specificInstructions}
    `;
    
    // 3. Appeler Gemini
    const result = await model.generateContent([systemInstruction, message]);
    return result.response.text();
};
```

---

## 💰 Gestion des Abonnements

### **Table `subscriptions`**
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    plan TEXT CHECK (plan IN ('starter', 'pro', 'business')),
    status TEXT CHECK (status IN ('active', 'expired', 'cancelled')),
    started_at TIMESTAMP,
    expires_at TIMESTAMP,
    auto_renew BOOLEAN DEFAULT true
);
```

### **Webhook de Paiement (Wave/Orange Money)**
```typescript
app.post('/api/webhooks/payment', async (req, res) => {
    const { tenantId, amount, transactionId } = req.body;
    
    // Vérifier la signature du webhook
    if (!verifyWebhookSignature(req)) return res.status(401).send('Invalid');
    
    // Activer/Prolonger l'abonnement
    await db.updateSubscription(tenantId, {
        status: 'active',
        expires_at: addMonths(new Date(), 1)
    });
    
    res.status(200).send('OK');
});
```

---

## 🎨 Frontend : Deux Dashboards

### **1. Dashboard Admin (Propriétaire Tdjaasa)**
*   Vue sur TOUS les tenants
*   Statistiques globales (Revenus, Nombre de clients actifs)
*   Gestion manuelle des tenants (activer/désactiver)

### **2. Dashboard Tenant (Client Final)**
*   Vue sur SES propres données uniquement
*   Ses ventes, ses produits, son bot
*   Configuration de son identité IA

---

## 🔒 Sécurité & Scalabilité

### **Sécurité**
*   ✅ **JWT Tokens** : Authentification sécurisée
*   ✅ **Row Level Security (RLS)** : Supabase filtre automatiquement par `tenant_id`
*   ✅ **Rate Limiting** : Limiter les requêtes abusives par tenant
*   ✅ **Encryption** : Credentials WhatsApp chiffrés dans la DB

### **Scalabilité**
*   ✅ **Horizontal Scaling** : Utiliser plusieurs serveurs Node.js (Load Balancer)
*   ✅ **Queue System** : Redis pour gérer les messages WhatsApp en file d'attente
*   ✅ **Database Optimization** : Index sur `tenant_id` dans toutes les tables

---

## 📋 Checklist Implémentation

- [ ] 1. Créer les nouvelles tables Supabase (tenants, subscriptions, users)
- [ ] 2. Implémenter l'authentification JWT (signup/login)
- [ ] 3. Modifier `dbService.ts` pour ajouter `tenantId` partout
- [ ] 4. Créer `baileysManager.ts` pour gérer plusieurs instances
- [ ] 5. Ajouter le contexte tenant dans `aiService.ts`
- [ ] 6. Créer la page d'onboarding (signup → paiement → config)
- [ ] 7. Intégrer Wave/Orange Money pour les paiements
- [ ] 8. Tester avec 3 tenants en parallèle

---
*Ce document est un guide stratégique. Chaque section peut être approfondie lors de l'implémentation.*
