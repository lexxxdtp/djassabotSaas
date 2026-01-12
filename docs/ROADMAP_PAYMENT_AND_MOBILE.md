# Roadmap Technique : Paiements & Application Mobile

Ce document détaille la stratégie pour intégrer les paiements Wave/OM automatisés et transformer la plateforme en application mobile.

## 1. Intégration des Paiements (Wave, Orange Money, MTN)

Il y a deux niveaux de paiement dans l'application :
1.  **Abonnement SaaS** (Le marchand VOUS paie)
2.  **Ventes Boutique** (Le client paie LE MARCHAND)

### A. Abonnement SaaS (Vous recevoir l'argent)
C'est déjà partiellement en place avec **Paystack**.
- **Fonctionnement** : Paystack gère nativement Wave, OM, MTN et Carte Bancaire.
- **Action requise** : Avoir un compte Paystack marchand activé et mettre les clés API (`PAYSTACK_SECRET_KEY`) dans le `.env` du backend.

### B. Ventes Boutique (Le Marchand reçoit l'argent)
Pour que le bot encaisse l'argent pour le compte du vendeur automatiquement :

**Option 1 : Méthode "Simple" (Actuelle)**
- Le bot envoie le numéro Wave/OM du vendeur.
- Le bot demande : *"Envoyez la capture d'écran du transfert"*.
- Le vendeur valide manuellement la commande dans son Dashboard.
- **Avantage** : Zéro configuration technique pour le vendeur.
- **Inconvénient** : Pas 100% automatique.

**Option 2 : Paystack "Subaccounts" (Automatisé)**
- Le vendeur entre ses infos bancaires/Wave dans les paramètres.
- Vous (la plateforme) créez un "Sous-compte" (Subaccount) Paystack pour lui via l'API.
- Le bot génère un lien de paiement Paystack unique pour chaque commande.
- Quand le client paie, Paystack divise l'argent :
    - X% pour vous (commission plateforme éventuelle).
    - Y% directement sur le compte du vendeur.
- **Avantage** : 100% automatique, le statut de la commande passe à "PAYÉ" tout seul.

---

## 2. Création de l'Application Mobile

L'objectif est d'éviter le navigateur et d'avoir une icône sur le téléphone.

### Étape 1 : PWA (Progressive Web App) - *Immédiat*
Transformez votre site actuel en application installable.
- **Temps** : 1 heure.
- **Résultat** : Les utilisateurs voient "Ajouter à l'écran d'accueil". Ça crée une icône, enlève la barre d'URL, et fonctionne comme une app.
- **Technique** : Ajouter un fichier `manifest.json` et configurer Vite.

### Étape 2 : Wrapper Natif (Capacitor) - *Court Terme*
Emballer le site React actuel dans une coquille Android/iOS.
- **Temps** : 1-2 jours.
- **Résultat** : Un fichier `.apk` (Android) et `.ipa` (iOS) que vous pouvez mettre sur le Play Store / App Store.
- **Avantage** : Pas besoin de réécrire le code. C'est le même code que le site web.

### Étape 3 : Application Native (React Native) - *Long Terme*
- Si vous avez besoin de fonctions avancées (accès contacts, notifications push sans internet, etc.).
- **Inconvénient** : Il faut tout recoder.

---

## Plan d'Action Recommandé

1.  **D'abord** : Finir la stabilisation WhatsApp (Scanner QR + Envoi/Réception messages). C'est le cœur du réacteur.
2.  **Ensuite** : Activer la PWA (je peux le faire maintenant). C'est rapide et ça répond au besoin "ne pas passer par le navigateur".
3.  **Puis** : Implémenter le paiement "Option 1" (Capture d'écran) parfaitement.
4.  **Enfin** : Passer à l'automatisation Paystack Subaccounts et au wrapper Android (Capacitor).
