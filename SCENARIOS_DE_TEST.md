# 🧪 SCÉNARIOS DE TEST - DjassaBot

Ce document contient tous les scénarios de test pour valider le fonctionnement du bot IA.

---

## 📋 Prérequis

Avant de tester, assurez-vous que :
- [ ] Vous avez des produits dans l'inventaire (avec images)
- [ ] Les produits ont des prix et stocks définis
- [ ] Au moins un produit a des "Consignes IA" spéciales
- [ ] Au moins un produit a des variations (taille, saveur, etc.)
- [ ] Le mode négociation est configuré (activé ou désactivé selon les tests)

---

## 🟢 NIVEAU 1 : Tests Basiques

### Test 1.1 : Salutation
**Message à envoyer :**
```
Bonjour
```
**Comportement attendu :**
- [ ] L'IA répond avec une salutation personnalisée
- [ ] Le ton correspond à la personnalité configurée
- [ ] Pas de mention de produits non sollicités

---

### Test 1.2 : Demander le catalogue
**Message à envoyer :**
```
Qu'est-ce que vous vendez ?
```
**Comportement attendu :**
- [ ] L'IA liste les produits disponibles avec les prix
- [ ] Les produits en rupture sont mentionnés comme indisponibles
- [ ] Le format est clair et professionnel

---

### Test 1.3 : Demander une photo de produit spécifique
**Message à envoyer :**
```
Je peux voir les croissants ?
```
**Comportement attendu :**
- [ ] L'IA affiche UNIQUEMENT les images des croissants
- [ ] PAS d'images d'autres produits
- [ ] Description courte du produit avec prix

---

### Test 1.4 : Demander des infos sur un produit
**Message à envoyer :**
```
C'est quoi les brownies ? Ça contient quoi ?
```
**Comportement attendu :**
- [ ] L'IA donne la description du produit
- [ ] Mentionne le prix et la disponibilité
- [ ] Reste dans le contexte (ne parle que des brownies)

---

## 🟡 NIVEAU 2 : Tests de Commande

### Test 2.1 : Commande simple
**Message à envoyer :**
```
Je veux 2 croissants
```
**Comportement attendu :**
- [ ] Confirmation de l'ajout au panier
- [ ] Calcul correct du total (2 x prix unitaire)
- [ ] Demande l'adresse de livraison

---

### Test 2.2 : Commande avec consignes spéciales (UPSELL)
**Prérequis :** Le produit BROWNIES doit avoir cette consigne :
> "Si le client prend 3 brownies propose lui 5 avec 10% de réduction"

**Message à envoyer :**
```
Je peux avoir 3 brownies
```
**Comportement attendu :**
- [ ] ❌ L'IA NE doit PAS directement ajouter 3 brownies
- [ ] ✅ L'IA DOIT proposer l'offre 5 brownies avec 10% de réduction
- [ ] L'IA donne les deux options avec calcul des prix
- [ ] Attend la réponse du client avant d'ajouter au panier

---

### Test 2.3 : Commande avec variation
**Prérequis :** Le produit BROWNIES doit avoir des variations (ex: Chocolat, Vanille)

**Message à envoyer :**
```
Je veux un brownie vanille
```
**Comportement attendu :**
- [ ] L'IA reconnaît la variation demandée
- [ ] Applique le bon prix (prix de base + modificateur de la variation)
- [ ] Confirme l'ajout avec le bon total

---

### Test 2.4 : Commande produit inexistant
**Message à envoyer :**
```
Je veux une pizza
```
**Comportement attendu :**
- [ ] L'IA indique poliment que le produit n'est pas disponible
- [ ] Propose des alternatives similaires du catalogue
- [ ] Ne crée PAS un produit fictif

---

### Test 2.5 : Commande produit en rupture
**Prérequis :** Mettre le stock d'un produit à 0 (mode STRICT)

**Message à envoyer :**
```
Je veux ce produit [nom du produit épuisé]
```
**Comportement attendu :**
- [ ] L'IA indique que le produit est en rupture de stock
- [ ] Propose des alternatives si disponibles
- [ ] Ne confirme PAS la commande

---

### Test 2.6 : Commande quantité > stock disponible
**Prérequis :** Un produit avec stock = 5 (mode STRICT)

**Message à envoyer :**
```
Je veux 10 [nom du produit avec 5 en stock]
```
**Comportement attendu :**
- [ ] L'IA signale qu'il n'y a que 5 disponibles
- [ ] Propose de commander les 5 restants
- [ ] Calcule le bon total pour 5 unités

---

### Test 2.7 : Produit en mode FLEXIBLE (sur commande)
**Prérequis :** Un produit avec gestion de stock FLEXIBLE (♾️)

**Message à envoyer :**
```
Je veux 100 [nom du produit flexible]
```
**Comportement attendu :**
- [ ] L'IA accepte la commande SANS vérifier le stock
- [ ] Mentionne éventuellement un délai de préparation
- [ ] Confirme la commande normalement

---

## 🔴 NIVEAU 3 : Tests Avancés

### Test 3.1 : Négociation (si activée)
**Prérequis :** 
- Négociation activée dans les réglages
- Produit avec minPrice défini

**Message à envoyer :**
```
C'est un peu cher, vous faites 10000 au lieu de 15000 ?
```
**Comportement attendu :**
Si offre < minPrice :
- [ ] L'IA refuse poliment
- [ ] Peut proposer un contre-prix plus élevé

Si offre >= minPrice :
- [ ] L'IA peut accepter ou négocier légèrement
- [ ] Ne révèle JAMAIS le prix minimum

---

### Test 3.2 : Négociation (si désactivée)
**Prérequis :** Négociation désactivée

**Message à envoyer :**
```
Tu peux me faire un prix ?
```
**Comportement attendu :**
- [ ] L'IA refuse poliment toute négociation
- [ ] Explique que les prix sont fixes
- [ ] Reste courtoise

---

### Test 3.3 : Questions hors contexte
**Message à envoyer :**
```
Quelle est la capitale de la France ?
```
**Comportement attendu :**
- [ ] L'IA répond brièvement OU redirige vers le commerce
- [ ] Ne se perd pas dans une conversation hors sujet
- [ ] Reste focalisée sur son rôle de vendeur

---

### Test 3.4 : Cross-selling intelligent
**Prérequis :** Avoir des produits complémentaires (ex: croissant + café)

**Message à envoyer :**
```
Je veux un croissant
```
**Comportement attendu :**
- [ ] L'IA peut suggérer un produit complémentaire (café)
- [ ] La suggestion est optionnelle, pas forcée
- [ ] Si le client refuse, l'IA continue normalement

---

### Test 3.5 : Mémoire de conversation
**Séquence de messages :**

1. "Bonjour"
2. "Je veux 2 croissants"
3. "Ajoutez aussi un brownie"
4. "Quel est mon total ?"

**Comportement attendu :**
- [ ] L'IA se souvient de toute la conversation
- [ ] Le panier contient 2 croissants + 1 brownie
- [ ] Le total est correctement calculé

---

### Test 3.6 : Horaires d'ouverture
**Prérequis :** Configurer des horaires dans les réglages

**Message à envoyer :**
```
Vous êtes ouverts quand ?
```
**Comportement attendu :**
- [ ] L'IA donne les horaires configurés
- [ ] Le format est clair et lisible

---

### Test 3.7 : Localisation / Adresse
**Prérequis :** Configurer l'adresse dans les réglages

**Message à envoyer :**
```
Où vous êtes situés ?
```
**Comportement attendu :**
- [ ] L'IA donne l'adresse configurée
- [ ] Peut mentionner les zones de livraison

---

## 🟣 NIVEAU 4 : Tests d'Edge Cases

### Test 4.1 : Message vide ou spam
**Message à envoyer :**
```
.
```
ou
```
hdhdhdhdhdhd
```
**Comportement attendu :**
- [ ] L'IA demande poliment de reformuler
- [ ] Ne plante pas
- [ ] Reste professionnelle

---

### Test 4.2 : Emojis et caractères spéciaux
**Message à envoyer :**
```
Je veux ça 🥐🥐 svp 😍
```
**Comportement attendu :**
- [ ] L'IA comprend l'intention
- [ ] Répond normalement (peut utiliser des emojis aussi)

---

### Test 4.3 : Message très long
**Message à envoyer :**
```
Bonjour, j'espère que vous allez bien, je vous contacte parce que j'organise une fête ce weekend et j'aurais besoin de beaucoup de pâtisseries, notamment des croissants, des brownies, peut-être aussi des gâteaux si vous en avez, et je voudrais savoir si vous pouvez me faire une livraison samedi matin vers 10h à Cocody, et aussi est-ce que vous faites des remises pour les grosses commandes ?
```
**Comportement attendu :**
- [ ] L'IA traite les multiples demandes
- [ ] Répond de manière structurée
- [ ] Adresse chaque point (produits, livraison, remise)

---

### Test 4.4 : Changement d'avis
**Séquence :**
1. "Je veux 3 brownies"
2. "Finalement non, je veux 2 croissants à la place"

**Comportement attendu :**
- [ ] L'IA comprend l'annulation
- [ ] Met à jour le panier correctement
- [ ] Confirme le changement

---

### Test 4.5 : Demande en plusieurs langues
**Message à envoyer :**
```
Hello, I want des croissants
```
**Comportement attendu :**
- [ ] L'IA comprend (mélange français/anglais)
- [ ] Répond dans la langue principale (français)

---

## 📊 Tableau de Suivi des Tests

| # | Test | Résultat | Notes |
|---|------|----------|-------|
| 1.1 | Salutation | ⬜ | |
| 1.2 | Catalogue | ⬜ | |
| 1.3 | Photo produit | ⬜ | |
| 1.4 | Info produit | ⬜ | |
| 2.1 | Commande simple | ⬜ | |
| 2.2 | Consignes IA (upsell) | ⬜ | |
| 2.3 | Commande variation | ⬜ | |
| 2.4 | Produit inexistant | ⬜ | |
| 2.5 | Produit rupture | ⬜ | |
| 2.6 | Quantité > stock | ⬜ | |
| 2.7 | Mode FLEXIBLE | ⬜ | |
| 3.1 | Négociation ON | ⬜ | |
| 3.2 | Négociation OFF | ⬜ | |
| 3.3 | Hors contexte | ⬜ | |
| 3.4 | Cross-selling | ⬜ | |
| 3.5 | Mémoire | ⬜ | |
| 3.6 | Horaires | ⬜ | |
| 3.7 | Localisation | ⬜ | |
| 4.1 | Spam | ⬜ | |
| 4.2 | Emojis | ⬜ | |
| 4.3 | Message long | ⬜ | |
| 4.4 | Changement avis | ⬜ | |
| 4.5 | Multi-langue | ⬜ | |

**Légende :**
- ⬜ Non testé
- ✅ Passé
- ❌ Échoué
- ⚠️ Partiellement passé

---

## 🔧 Scénarios de Configuration à Tester

### Config 1 : Pâtisserie standard
- Produits avec images
- Prix fixes
- Stock strict sur certains, flexible sur d'autres
- Consignes d'upsell

### Config 2 : Boutique de vêtements
- Produits avec variations (taille, couleur)
- Négociation activée
- Prix minimum différents

### Config 3 : Restaurant
- Produits simples (plats)
- Horaires d'ouverture importants
- Zones de livraison

---

## 📝 Notes de Test

Utilisez cet espace pour documenter vos observations :

```
Date: ___________
Testeur: ___________

Observations:
-
-
-

Bugs trouvés:
-
-

Améliorations suggérées:
-
-
```

---

## ✅ Critères de Validation Finale

Avant de passer en production :

- [ ] Tous les tests de Niveau 1 passés
- [ ] 80%+ des tests de Niveau 2 passés
- [ ] Tests critiques de Niveau 3 passés (négociation, mémoire)
- [ ] Pas de crash sur les edge cases
- [ ] Performance acceptable (< 5s de réponse)
- [ ] Identité IA cohérente dans toutes les réponses
