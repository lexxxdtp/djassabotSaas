# Plan de Test Fonctionnel - Interface Vendeur (Djassa Bot)

Ce document décrit la procédure de validation de l'interface vendeur (le "Dashboard"). L'objectif est de s'assurer que toutes les fonctionnalités critiques sont opérationnelles et visuellement cohérentes avec le thème Orange/Noir.

## 🛠 Pré-requis
- Le **Backend** doit être lancé (`npm run dev` dans `/backend`).
- Le **Frontend** doit être lancé (`npm run dev` dans `/frontend`).
- L'application est en mode "Local Fallback" (pas de Supabase requis pour le moment).

---

## 🧪 Scénarios de Test

### 1. Authentification & Onboarding
| Étape | Action | Résultat Attendu | Statut |
|-------|--------|------------------|--------|
| 1.1 | Aller sur `/signup` | La page s'affiche avec le thème Orange/Noir. | ⬜️ |
| 1.2 | Créer un compte (Nom commerce, email, mdp) | Redirection vers le Dashboard (`/dashboard`) après succès. | ⬜️ |
| 1.3 | Se déconnecter (Bouton en bas à gauche) | Retour à la page de Login. | ⬜️ |
| 1.4 | Se reconnecter avec les identifiants | Accès réussi au Dashboard. | ⬜️ |

### 2. Gestion des Produits (Inventaire)
Ce module est critique.
| Étape | Action | Résultat Attendu | Statut |
|-------|--------|------------------|--------|
| 2.1 | Aller sur `/dashboard/products` | Affiche "Votre boutique est vide" (si nouveau compte). | ⬜️ |
| 2.2 | Cliquer "Ajouter Produit" | La modale de création s'ouvre. | ⬜️ |
| 2.3 | Remplir le formulaire (Nom, Prix, Stock) et valider | La modale se ferme, le produit apparaît dans la grille. | ⬜️ |
| 2.4 | Modifier un produit (Icône Crayon) | La modale s'ouvre avec les infos pré-remplies. Modifications sauvegardées. | ⬜️ |
| 2.5 | **Supprimer un produit** (Icône Corbeille) | **Important** : Une modale de confirmation Rouge/Noir doit apparaître. | ⬜️ |
| 2.6 | Confirmer la suppression | Le produit disparaît de la liste. | ⬜️ |

### 3. Marketing & Apparence
| Étape | Action | Résultat Attendu | Statut |
|-------|--------|------------------|--------|
| 3.1 | Aller sur `/dashboard/marketing` | La page s'affiche avec le thème sombre (Noir) et accents Orange. | ⬜️ |
| 3.2 | Vérifier les onglets (Broadcast / Coupons) | Le changement d'onglet est fluide, l'onglet actif est Orange. | ⬜️ |
| 3.3 | Vérifier le formulaire "Créer Campagne" | Inputs style "Noir/Zinc", Bouton "Envoyer" visible. | ⬜️ |

### 4. Commandes (Orders)
| Étape | Action | Résultat Attendu | Statut |
|-------|--------|------------------|--------|
| 4.1 | Aller sur `/dashboard/orders` | Affiche une liste vide ou l'état "Aucune commande". Thème sombre. | ⬜️ |

---

## 📝 Notes de Validation
Utilisez cette section pour noter les bugs rencontrés durant le test.

*   [ ] ...
*   [ ] ...

---
**Date de validation :** ____________
**Validé par :** ____________
