# 🚀 Guide de Déploiement & Modification (Pour les Testeurs)

## 1. Comment ça marche ? (L'Architecture Simplifiée)

Imaginez votre application comme un restaurant :

1.  **Le Frontend (Dashboard - Vercel)** : C'est la **Salle à Manger et le Menu**. 
    *   Les vendeurs voient leurs commandes et produits ici.
    *   *Coût : Gratuit (Vercel Hobby).*
2.  **Le Backend (Cerveau - Railway)** : C'est la **Cuisine**.
    *   Il reçoit les messages WhatsApp, discute avec l'IA (le Chef), et enregistre les commandes.
    *   C'est lui qui doit rester allumé 24h/24.
    *   *Coût : Environ 5$ / mois (Railway Hobby).*
3.  **La Base de Données (Supabase)** : C'est le **Grand Livre de Comptes**.
    *   Tout est écrit ici : utilisateurs, stocks, historique.
    *   *Coût : Gratuit (Supabase Free Tier).*
4.  **L'IA (Gemini)** : C'est le **Consultant Expert**.
    *   Le backend lui envoie "Le client a dit X", l'IA répond "Dis-lui Y".
    *   *Coût : Gratuit (jusqu'à une certaine limite) ou très faible.*

**🔗 La Connexion** :
Tout ce petit monde discute par internet via des **API**. Quand un testeur envoie un message WhatsApp, WhatsApp prévient votre Backend (Railway), qui interroge l'IA, puis répond au testeur.

---

## 2. Faut-il Déployer pour Tester ?

**OUI, c'est fortement recommandé.**

*   **Pourquoi ?** Si vous hébergez sur votre ordinateur (Localhost), dès que vous fermez votre PC ou coupez le Wifi, le bot meurt. Vos 3-4 testeurs ne pourront plus rien faire.
*   **La Solution Cloud** : En mettant le code sur Railway/Vercel, le bot vit sa vie 24h/24, 7j/7, même si vous dormez.

---

## 3. Comment Modifier le Projet en cours de route ?

C'est là que la magie du développement moderne opère. Voici le cycle :

1.  **Détection** : Un testeur vous dit "Hey, le bot a fait une erreur de calcul !"
2.  **Correction (Local)** : Vous revenez vers moi (l'IA) sur votre ordinateur. On corrige le code ensemble.
3.  **Vérification** : On teste juste la correction sur votre machine.
4.  **Mise à jour (Push)** :
    *   On tape une commande git (`git push`).
    *   Railway et Vercel voient la modification et **mettent à jour le site automatiquement** en 2-3 minutes.
    *   Le bot redémarre tout seul avec le nouveau cerveau.

**✨ C'est transparent pour les utilisateurs.** Ils n'ont rien à réinstaller.

---

## 4. Résumé des Coûts pour le Test

| Service | Rôle | Prix estimé (Phase Test) |
| :--- | :--- | :--- |
| **Vercel** | Héberge le site web | **0 €** |
| **Supabase** | Stocke les données | **0 €** |
| **Gemini API** | Intelligence Artificielle | **0 €** (Free tier) |
| **Railway** | Fait tourner le code 24/7 | **~5 € / mois** |
| **TOTAL** | | **~5 € / mois** |

*Note : C'est le prix de la tranquillité d'esprit pour que ça marche tout le temps.*
