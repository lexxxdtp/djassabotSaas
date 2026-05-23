# Rapport d'Audit de Sécurité — DjassaBot SaaS

Ce document présente l'audit de sécurité réalisé pour le projet **DjassaBot** en suivant le skill de sécurité et les guides de bonnes pratiques.

---

## Résumé Exécutif

L'audit de sécurité de DjassaBot met en évidence une architecture globale saine où les communications de données sensibles transitent par un serveur Express centralisé, évitant l'exposition directe de clés de base de données dans le frontend. Toutefois, deux failles majeures ont été détectées : l'accès libre à la base de données de production Supabase via des politiques RLS désactivées de fait (Allow All), et une fuite d'informations sensibles (`minPrice` des produits) lors des requêtes d'écriture (création/modification).

---

## 1. Failles Critiques (Critical)

### 📌 Finding SEC-01 : Politiques d'Accès Libre (Allow All) sur Supabase
* **Fichier référencé** : [supabase_full_schema.sql](file:///Users/alexvianneykoffi/djassabotSaas/backend/supabase_full_schema.sql) (Lignes 170-179 et 214-216)
* **Description** : Toutes les tables de la base de données Supabase possèdent une règle RLS (Row Level Security) qui autorise n'importe quelle requête externe (anonyme ou utilisateur) à lire, modifier ou supprimer toutes les données sans restriction.
* **Exemple de code vulnérable** :
  ```sql
  create policy "Allow All Tenants" on tenants for all using (true) with check (true);
  ```
* **Impact** : **Un attaquant possédant l'URL publique de votre projet Supabase et la clé publique anonyme (anon key) peut usurper l'identité de n'importe quel vendeur, voler l'ensemble des données clients, modifier les prix des produits ou supprimer l'intégralité de la base de données.**

---

## 2. Failles Élevées (High)

### 📌 Finding SEC-02 : Fuite de Données Sensibles (`minPrice` des produits)
* **Fichier référencé** : [index.ts](file:///Users/alexvianneykoffi/djassabotSaas/backend/src/index.ts) (Lignes 182-200 et 202-219)
* **Description** : Le prix minimum négociable d'un produit (`minPrice`) est une donnée sensible réservée à l'usage interne de l'IA pour bloquer les négociations abusives. Bien que cette donnée soit correctement masquée lors de la lecture de la liste des produits (`GET /api/products`), elle est renvoyée en clair lors de la création d'un produit (`POST /api/products`) et de sa mise à jour (`PUT /api/products/:id`).
* **Exemple de code vulnérable** :
  ```typescript
  app.post('/api/products', authenticateTenant, async (req, res) => {
      // ...
      const product = await db.createProduct(req.tenantId!, req.body);
      res.json(product); // Le JSON contient 'minPrice'
  });
  ```
* **Impact** : Un client ou un utilisateur curieux peut intercepter les requêtes HTTP dans son navigateur lors de l'ajout ou de la modification d'un produit pour connaître le prix minimum d'acceptation du bot, brisant l'avantage commercial de la négociation automatique.

### 📌 Finding SEC-03 : Secret JWT Faible par Défaut
* **Fichier référencé** : [.env](file:///Users/alexvianneykoffi/djassabotSaas/backend/.env) (Ligne 1)
* **Description** : La clé secrète utilisée pour signer et vérifier les tokens d'authentification utilisateur (`JWT_SECRET`) est configurée localement avec une chaîne faible (`tdjaasa-super-secret-change-in-production`).
* **Impact** : Si cette clé est conservée en production, un attaquant peut facilement forger de faux tokens JWT pour s'authentifier comme n'importe quel commerçant du système.

---

## 3. Failles Moyennes (Medium)

### 📌 Finding SEC-04 : Stockage des Jetons JWT dans le LocalStorage (Vulnérabilité XSS)
* **Fichier référencé** : [AuthContext.tsx](file:///Users/alexvianneykoffi/djassabotSaas/frontend/src/context/AuthContext.tsx) (Lignes 76-81, 137-142)
* **Description** : Les jetons JWT sont stockés dans le `localStorage` du navigateur. En cas d'introduction d'une faille XSS (Cross-Site Scripting) via une dépendance compromise ou un champ non échappé, un attaquant pourrait voler les jetons de session.
* **Impact** : Vol de session commerçant et détournement des comptes.

### 📌 Finding SEC-05 : Risque de Prompt Injection sur WhatsApp
* **Fichier référencé** : [aiService.ts](file:///Users/alexvianneykoffi/djassabotSaas/backend/src/services/aiService.ts) (Ligne 398)
* **Description** : Les messages envoyés par les clients WhatsApp (`userText`) sont passés directement au modèle Gemini sans prétraitement ni barrières de sécurité spécifiques contre les injections.
* **Impact** : Un utilisateur malveillant pourrait envoyer des instructions textuelles complexes pour forcer le bot à lui accorder des remises hors normes, ignorer les stocks ou usurper l'identité de l'administrateur.

---

## 4. Recommandations de Correctifs

1.  **Sécuriser Supabase (Urgent)** : Exécuter le script SQL fourni pour supprimer les règles "Allow All" et fermer l'accès public direct.
2.  **Masquer `minPrice` dans l'API** : Mettre à jour les contrôleurs de création et de modification de produits pour filtrer systématiquement la propriété `minPrice` avant l'envoi de la réponse JSON au frontend.
3.  **Renforcer le secret JWT** : Générer une clé cryptographique forte (ex: `openssl rand -base64 32`) pour la variable `JWT_SECRET` en production.
