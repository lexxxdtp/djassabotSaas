# 💰 STRATÉGIE DE PRICING - TDJAASA BOT SAAS

## 📊 Analyse des Coûts Réels (Janvier 2026)

### 1. **Coût Intelligence Artificielle (Google Gemini)**

Nous utilisons **Gemini 2.5 Flash** (meilleur rapport qualité/prix) :
*   **Input** : $0.30 par million de tokens (~750,000 mots)
*   **Output** : $2.50 par million de tokens

**Estimation par conversation WhatsApp** :
*   Message client moyen : ~50 tokens (input)
*   Réponse bot moyenne : ~150 tokens (output)
*   Contexte (produits + settings) : ~200 tokens (input)
*   **Total par échange** : 400 tokens

**Coût par conversation** :
```
Input:  (50 + 200) tokens × $0.30 / 1M = $0.000075
Output: 150 tokens × $2.50 / 1M        = $0.000375
TOTAL:                                 = $0.00045 (~0.25 FCFA)
```

**📌 En résumé** :
*   1 conversation = **0.25 FCFA**
*   1000 conversations = **250 FCFA**
*   5000 conversations = **1250 FCFA**

---

### 2. **Coût Hébergement Backend (Node.js)**

**Option Recommandée : Railway.app**
*   **Hobby Plan** : $5/mois (5000 FCFA) pour 0.5 GB RAM, 1 vCPU
*   Convient pour : ~10-20 tenants simultanés
*   Au-delà : $10/GB RAM supplémentaire

**Alternative Budget : Render.com**
*   **Hobby (Gratuit)** : 512 MB RAM, 0.1 vCPU
*   Limité mais OK pour démarrer avec 5 clients

**📌 Coût estimé par tenant** :
*   Avec Railway Hobby ($5) réparti sur 15 clients = **~330 FCFA/mois/tenant**

---

### 3. **Coût Base de Données (Supabase)**

**Free Tier** (jusqu'à 500 MB) :
*   ✅ GRATUIT jusqu'à 50 000 MAU (utilisateurs actifs)
*   ✅ GRATUIT jusqu'à 5 GB de bande passante

**Pro Plan** ($25/mois = 15,000 FCFA) :
*   8 GB de base de données
*   50 GB de bande passante
*   Backups automatiques

**📌 Stratégie** :
*   Démarrer avec le **Free Tier** (0-50 clients)
*   Passer au **Pro** à partir de 50 clients → **300 FCFA/tenant**

---

### 4. **Coût WhatsApp (Baileys = GRATUIT)**

**WhatsApp Official Business API** :
*   Marketing messages : ~$0.05-0.10 par message (30-60 FCFA)
*   ❌ **Trop cher pour notre cible**

**Baileys (Open Source)** :
*   ✅ **100% GRATUIT**
*   Simule WhatsApp Web (pas de frais par message)
*   Seule limite : Risque de ban si abus (résolu en respectant les bonnes pratiques)

**📌 Coût WhatsApp** : **0 FCFA** 🎉

---

### 5. **Coût Paiement Mobile (Wave/Orange Money)**

**Wave** :
*   Frais marchand : ~1-2% par transaction
*   Sur un paiement de 10,000 FCFA → **100-200 FCFA de frais**

**📌 Stratégie** :
*   Facturer légèrement au-dessus pour absorber les frais
*   Ex : Forfait affiché à 10,500 FCFA (client paie 10,500, vous recevez ~10,300)

---

## 🧮 CALCUL DU COÛT TOTAL PAR TENANT

| Poste                  | Coût/Tenant/Mois |
|------------------------|------------------|
| **IA (Gemini)**        | 250-1250 FCFA    |
| **Hébergement**        | 330 FCFA         |
| **Base de Données**    | 0-300 FCFA       |
| **WhatsApp (Baileys)** | 0 FCFA           |
| **Frais Paiement**     | Absorbés         |
| **TOTAL**              | **580-1880 FCFA**|

**📌 Coût moyen conservateur : ~1500 FCFA/tenant/mois**

---

## 💎 PROPOSITION DE FORFAITS

### 🥉 **FORFAIT STARTER - 5,000 FCFA/mois**

**Idéal pour** : Petits commerçants, friperies, vendeurs de produits uniques

**Inclus** :
*   ✅ **500 conversations IA/mois** (~3,000 messages clients)
*   ✅ **1 agent WhatsApp** (1 numéro connecté)
*   ✅ **50 produits** dans l'inventaire
*   ✅ **Support email** (réponse sous 48h)
*   ✅ **Dashboard de base** (ventes, commandes)
*   ✅ **Personnalisation limitée** (nom, description, produits)

**Limite** :
*   ❌ Pas de multi-agents
*   ❌ Pas d'analytics avancés

**Marge bénéficiaire** :
```
Revenu :       5,000 FCFA
Coût réel :   -1,500 FCFA (estimé avec 500 conversations)
Profit :       3,500 FCFA par client (70% de marge)
```

---

### 🥈 **FORFAIT PRO - 10,000 FCFA/mois**

**Idéal pour** : Restaurants, boutiques établies, services de livraison

**Inclus** :
*   ✅ **2,000 conversations IA/mois** (~12,000 messages)
*   ✅ **1 agent WhatsApp** + **Analytics avancés**
*   ✅ **Produits illimités**
*   ✅ **Support prioritaire** (réponse sous 24h)
*   ✅ **Dashboard Pro** (graphiques, tendances, facturation automatique)
*   ✅ **Personnalisation avancée** (style de réponse, instructions spécifiques)
*   ✅ **Envoi d'images** (photos de produits automatiques)
*   ✅ **Réservations** (pour restaurants/services)

**Nouveautés** :
*   📊 Export des données (CSV)
*   🎨 Branding personnalisé (logo dans les factures)

**Marge bénéficiaire** :
```
Revenu :       10,000 FCFA
Coût réel :    -2,500 FCFA (estimé avec 2,000 conversations)
Profit :        7,500 FCFA par client (75% de marge)
```

---

### 🥇 **FORFAIT BUSINESS - 15,000 FCFA/mois**

**Idéal pour** : Grandes boutiques, chaînes de restaurants, entreprises

**Inclus** :
*   ✅ **Conversations ILLIMITÉES**
*   ✅ **3 agents WhatsApp** (3 numéros connectés)
*   ✅ **Tout du Forfait Pro** +
*   ✅ **Support téléphonique** (réponse immédiate)
*   ✅ **Multi-utilisateurs** (plusieurs employés sur le dashboard)
*   ✅ **API Access** (intégration avec d'autres outils)
*   ✅ **Webhooks** (notifications externes)
*   ✅ **Formation personnalisée** (1h de coaching sur l'optimisation du bot)
*   ✅ **White-label** (pas de mention "Powered by Tdjaasa" optionnel)

**Nouveautés** :
*   🤖 **Mode Multi-Agent** : SAV, Ventes, Réservations dans des numéros séparés
*   🔗 **Intégrations** : Link vers site e-commerce, CRM

**Marge bénéficiaire** :
```
Revenu :       15,000 FCFA
Coût réel :    -4,000 FCFA (estimé avec beaucoup de conversations + ressources)
Profit :       11,000 FCFA par client (73% de marge)
```

---

## 📈 SIMULATION DE REVENUS

### **Scénario Conservateur (Année 1)**

| Mois | Starter (5k) | Pro (10k) | Business (15k) | Revenu Total    | Coûts        | Profit Net   |
|------|--------------|-----------|----------------|-----------------|--------------|--------------|
| M1   | 5 clients    | 0         | 0              | 25,000 FCFA     | -12,500 FCFA | 12,500 FCFA  |
| M3   | 15 clients   | 5         | 0              | 125,000 FCFA    | -40,000 FCFA | 85,000 FCFA  |
| M6   | 30 clients   | 15        | 3              | 345,000 FCFA    | -90,000 FCFA | 255,000 FCFA |
| M12  | 50 clients   | 30        | 10             | 700,000 FCFA    | -180,000 FCFA| 520,000 FCFA |

**Projection Année 1** : **6,240,000 FCFA de revenus** (~€9,500)

---

### **Scénario Optimiste (Année 2)**

| Mois | Starter (5k) | Pro (10k) | Business (15k) | Revenu Total      | Profit Net      |
|------|--------------|-----------|----------------|-------------------|-----------------|
| M12  | 80 clients   | 60        | 20             | 1,300,000 FCFA    | 975,000 FCFA    |
| M24  | 100 clients  | 100       | 50             | 2,250,000 FCFA    | 1,687,500 FCFA  |

**Projection Année 2** : **27,000,000 FCFA de revenus** (~€41,000)

---

## 🎯 STRATÉGIE DE LANCEMENT

### **Phase 1 : MVP + Early Adopters (Mois 1-3)**
*   Offrir **1 mois gratuit** aux 10 premiers clients
*   Récolter les feedbacks pour améliorer
*   Objectif : **20 clients payants** à la fin du Mois 3

### **Phase 2 : Growth (Mois 4-12)**
*   Lancer des **campagnes sur WhatsApp** (ironique mais efficace !)
*   Partenariats avec des influenceurs business locaux
*   Objectif : **100 clients** à la fin de l'année

### **Phase 3 : Expansion (Année 2)**
*   Ajouter des **features premium** (paiement automatique Wave/OM)
*   Créer un **programme d'affiliation** (parrainer = -20% sur 3 mois)
*   Objectif : **250 clients** et devenir leader en Côte d'Ivoire

---

## 🛡️ OPTIMISATION DES COÛTS

### **1. Réduire les Coûts Gemini**
*   Utiliser le **Context Caching** : -90% sur les prompts répétés
*   Passer à **Gemini Flash-Lite** pour les clients Starter : $0.10/$0.40 (encore moins cher)

### **2. Hébergement Évolutif**
*   Commencer avec **Render Free** (0$) pour tester
*   Migrer vers **Railway** quand >10 clients
*   Considérer **VPS dédié** (Contabo, Hostinger) à partir de 100 clients (~€5/mois)

### **3. Base de Données**
*   Rester en **Supabase Free** tant que possible
*   Archiver les vieilles commandes (>6 mois) pour libérer de l'espace

---

## ✅ RECOMMANDATION FINALE

**Pricing optimal pour le marché ivoirien** :
*   ✅ **Starter : 5,000 FCFA** (accessible, rentable)
*   ✅ **Pro : 10,000 FCFA** (sweet spot)
*   ✅ **Business : 15,000 FCFA** (premium)

**Marges prévues** :
*   **Starter** : 70% de marge
*   **Pro** : 75% de marge
*   **Business** : 73% de marge

**Avec 100 clients mixtes (50/30/20) :**
*   **Revenus mensuels : ~1,000,000 FCFA** (€1,500)
*   **Profit net : ~750,000 FCFA** (€1,140)

---
*Ce document est basé sur les tarifs réels de janvier 2026 et des estimations d'usage. À ajuster selon les retours terrain.*
