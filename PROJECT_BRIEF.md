# 🌍 TDJAASA BOT - L'Innovation Commerce pour la Côte d'Ivoire 🇨🇮

## 📄 Résumé Exécutif
Tdjaasa Bot est une solution de **commerce conversationnel automatisé** qui permet à tout vendeur ivoirien de transformer son WhatsApp en une boutique en ligne intelligente. Grâce à une IA avancée (Gemini), le bot gère les clients, négocie les prix, prend les commandes et génère les factures, le tout dans un langage local adapté ("Nouchi" et Français Ivoirien).

---

## 💎 Pourquoi ce projet est unique ?
1.  **ADN Ivoirien** : Le bot ne parle pas comme un robot standard. Il utilise des expressions locales ("Y'a pas son deux", "On dit quoi ?") pour créer une relation de confiance immédiate.
2.  **Négociation Active** : Ce n'est pas un simple catalogue. Le bot peut négocier le prix (dans une limite fixée par le vendeur) pour conclure la vente, comme au marché (Djassa).
3.  **Simplicité WhatsApp** : Tout se passe là où sont les clients. Pas de site web compliqué à visiter pour l'acheteur.

---

## 🛠 Stack Technique (Architecture)

### 🖥️ Frontend (Le Dashboard)
*   **React 19 & Vite** : Pour une interface ultra-rapide et fluide.
*   **TailwindCSS V4** : Design premium, sombre et élégant ("Dark Analytics").
*   **Interactions** : Cartes cliquables, Modales de facture, Graphiques Recharts.
*   **Fonction** : Permet au vendeur de surveiller son business (Ventes, Commandes) et de configurer le bot.

### 🧠 Backend (Le Moteur)
*   **Node.js & Express** : Serveur robuste et évolutif.
*   **Baileys (WhatsApp)** : Connexion directe à WhatsApp Web via QR Code (sans frais API Meta).
*   **Google Gemini AI** : Le "cerveau" qui analyse les messages, comprend le contexte et génère les réponses de vente.
*   **Data Persistence** : Système de base de données JSON local (extensible vers Supabase).
*   **Script de Seed** : Générateur de commandes de test pour simuler l'activité.

---

## ✨ Fonctionnalités Détaillées

### 1. 🤖 Relation Client Automatisée
*   Réponse instantanée 24/7.
*   Présentation des produits (Mèches, Bazin, Perruques...).
*   Gestion du panier et validation de commande.

### 2. 📊 Pilotage de l'Activité
*   **Vue d'Ensemble** : Chiffre d'affaires du jour, Taux de conversion.
*   **Facturation** : Visualisation des factures pro-forma détaillées (Produits x Prix = Total).
*   **Live Sales** : Mise à jour en temps réel des graphiques.

### 3. ⚙️ Configuration Intuitive
*   **Identité IA** : Le vendeur peut "coacher" son bot via les paramètres (Instructions spécifiques).
*   **Connexion QR** : Appairage simple par scan de code.

---

## 🚀 Potentiel d'Évolution
*   **Support Audio** : Le bot pourra bientôt écouter les notes vocales (feature IA prévue).
*   **Paiement Mobile** : Intégration future de Wave et Orange Money pour valider les paiements automatiquement.

---
*Document généré automatiquement pour la présentation du projet Tdjaasa.*
