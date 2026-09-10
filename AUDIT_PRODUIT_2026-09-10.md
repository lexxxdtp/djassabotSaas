# Audit DjassaBot : fonctionnement et viabilité

## Périmètre et conclusion

Audit local du 10 septembre 2026, sur la base GitHub `42428f4` et les modifications locales de présentation déjà présentes. Le VPS est éteint selon Alex, suite au non-renouvellement Hostinger. Aucun accès à la production, appel WhatsApp, paiement, démarrage du serveur métier ou modification applicative effectué. Ce rapport ne certifie ni la sécurité globale ni le fonctionnement en production.

**Verdict : conserver l'architecture, mais ne pas qualifier encore la vente autonome de fiable.** L'IA dialogue et le serveur contrôle prix et stock : bonne séparation. Les transitions, preuves de paiement et exceptions restent insuffisamment contrôlées. Une refonte visuelle ne résoudrait pas ces défauts.

Besoin à préserver : le vendeur renseigne ses informations une fois et ne répète plus les réponses aux prospects. Le succès principal est le temps économisé sans commande erronée, pas une hausse de conversion présumée.

## Vérifications exécutées

- Tests backend : 30/30 passent. Ils couvrent surtout les fonctions pures du moteur, pas la chaîne complète.
- TypeScript backend : passe (`npm run lint`, qui exécute `tsc --noEmit`).
- Compilation frontend : passe. Avertissement sur les données Browserslist anciennes, non bloquant.
- Sondes locales sans API : `merci` et `je prends deux plutôt` sont acceptés comme adresses ; `je veux plus de photos` et `je ne veux pas annuler` sont reconnus comme annulations.
- Aucun test authentifié de bout en bout ni validation Gemini réelle. Les résultats conversationnels non reproduits restent des risques, pas des échecs observés en production.

## Défauts prioritaires

### P1 : reçu interprété comme paiement confirmé

`backend/src/services/paymentValidationService.ts:118` passe la commande à PAID après correspondance de montant. Le destinataire extrait est journalisé et communiqué au vendeur après coup, pas comparé au compte attendu avant validation. Cette chaîne repose sur la lecture d'une image, pas sur une confirmation de transaction par l'opérateur.

Conséquence : le libellé « paiement validé » est plus fort que la preuve disponible. Recommandation : distinguer reçu reçu/à vérifier et encaissement confirmé ; confirmation vendeur ou source de transaction fiable avant préparation fondée sur le paiement. Contrôler aussi l'association au bon ordre quand plusieurs commandes ont le même total.

### P1 : adresses et annulations mal interprétées, reproduit localement

`backend/src/services/whatsapp/salesEngine.ts:311` et `:338` utilisent respectivement des sous-chaînes d'annulation et une validation d'adresse très permissive. `flowHandler.ts:82` s'appuie dessus pour finaliser la commande.

Conséquence : une correction de quantité peut devenir une adresse ; une demande de photos ou une négation peut vider le panier. Recommandation : intentions explicites, gestion de l'ambiguïté, extraction structurée de l'adresse et confirmation du récapitulatif avant engagement.

### P1 : reprise manuelle incomplète

`messageHandler.ts:97` traite un reçu avant que `flowHandler.ts:67` vérifie l'automatisation de la conversation. `abandonedCartService.ts:30` filtre l'état mais pas `autopilotEnabled`. La pause globale et l'abonnement sont contrôlés, mais pas la pause individuelle sur ces deux chemins.

Conséquence : validation/réponse automatique ou relance possible malgré la reprise du vendeur. Recommandation : appliquer les mêmes autorisations à tous les producteurs d'actions, pas uniquement au dialogue principal.

### P1 : marqueur de relance perdu à la lecture

`sessionService.ts:46` et `:129` ne restituent pas `reminder_sent`, alors que `:152` l'écrit. `abandonedCartService.ts:33` dépend de ce marqueur pour ne pas relancer plusieurs fois.

Conséquence : lorsque la lecture base réussit, le marqueur est absent ; une nouvelle relance peut repartir après le délai, même si elle a déjà été envoyée. Recommandation : restitution du marqueur, contrôle de pause, cadence bornée et test de non-répétition après relecture/redémarrage. Constat statique, aucun envoi effectué.

### P1 : négociation contradictoire

`aiService.ts:240` autorise la marge globale sans prix minimum, tandis que `:335` impose le prix fixe. `:327` et `:331` remplacent une souplesse nulle par 5 via `||`. Le serveur protège un plancher, mais cela n'empêche pas une promesse incohérente avant validation.

Recommandation : une politique unique calculée côté serveur, offres mémorisées, concessions autorisées et raisons de remise explicites. Le nouchi est une préférence de ton, pas une stratégie de négociation. Aucun bénéfice commercial supposé sans tests vendeurs.

## Lacunes du parcours

### Identification de l'article

Le traitement entrant extrait le texte courant mais ne reprend pas le contexte cité (`contextInfo`/`quotedMessage`) dans le chemin inspecté. L'analyse d'image reçoit essentiellement les noms du catalogue. Un « celui-là » répondant à une publication peut donc perdre son référent. Tester texte cité, réponse à statut, photo ressemblante, variantes proches ; clarifier plutôt qu'affirmer une correspondance incertaine.

### Panier trop dépendant d'étapes rigides

En attente d'adresse, les messages non reconnus comme adresses passent au dialogue avec ajout au panier désactivé. Les modifications de panier ne disposent pas dans cette branche d'actions explicites. Le choix de variante utilise une correspondance de texte ou un numéro, qui gère mal une réponse naturelle complète. Introduire des actions d'ajout, retrait, remplacement et changement de quantité, toutes revalidées.

### Total complet accepté trop tard

La réception de l'adresse déclenche calcul de livraison, décrément de stock et création de commande. Prévoir un récapitulatif accepté avec total et livraison connus. Définir le traitement des zones inconnues et la réservation/libération de stock des commandes non payées. Ce dernier point nécessite une décision produit et une vérification plus approfondie, pas une suppression automatique des commandes.

### Mise en route et disponibilité

L'onboarding permet de sauter les étapes mais termine sur « C'est prêt ». Son premier produit utilise un formulaire distinct de l'ajout par photo du catalogue. L'accueil conserve des valeurs initiales si certaines lectures échouent : distinguer absence de données, panne de service et WhatsApp déconnecté. La panne Hostinger rend ce besoin particulièrement concret.

### Confirmation des actions dans l'interface

`frontend/src/pages/Inbox.tsx:145` affiche la nouvelle pause avant confirmation, sans contrôle de réponse HTTP ni restauration fiable. Des échecs d'envoi restent seulement dans la console. Ne jamais laisser croire qu'un message ou un changement de contrôle a réussi sans preuve.

## Choix produit à distinguer des bugs

- Les quatre statuts de commande sont un choix explicite dans CLAUDE.md : ne pas présenter le regroupement PAID/SHIPPING comme un accident. Vérifier si les vendeurs ont besoin d'un suivi de livraison séparé avant de le modifier.
- L'expiration d'abonnement est maintenant implémentée ; certaines anciennes notes ne sont plus à jour. Alex a approuvé le principe de conserver au moins la consultation des commandes après expiration : à concevoir, pas encore implémenté.
- La diffusion existe mais n'est pas centrale dans la navigation. Ne pas ajouter marketing, CRM ou promotions avant de fiabiliser la vente de base.
- Le catalogue doit rester peu coûteux à renseigner : photo, prix, disponibilité, puis règles communes réutilisées. Tester ce coût d'entrée plutôt que multiplier les réglages IA.

## Conséquences du VPS arrêté

La page publique peut fonctionner alors que les fonctions dépendant de l'API sont indisponibles. Ce n'est pas une preuve de panne du frontend. Ne pas lancer le backend local avec ses paramètres existants pour « voir » : le démarrage importe les relances automatiques et pourrait joindre les services réels.

Impossible à certifier ici : sessions WhatsApp récupérables, migrations réellement appliquées, état des données, configuration des emails et paiements, restauration de sauvegardes. Les sauvegardes WhatsApp décrites sont sur le même VPS : leur existence ne prouve pas qu'elles soient accessibles pendant une suspension. Supabase est un service distinct ; l'arrêt du VPS ne démontre pas une perte de sa base.

## Plan d'action proposé

1. Verrouiller la signification de « payé », la pause individuelle et la non-répétition des relances.
2. Corriger les intentions, unifier la négociation et ajouter une confirmation finale fiable.
3. Tester le moteur complet hors ligne avec dépendances simulées : aucune API réelle, aucun client contacté.
4. Couvrir produit ambigu, modification de panier, montant livraison, reçu non vérifié, pause, répétition d'événement, perte réseau et reprise.
5. Simplifier onboarding et interface autour de ces états fiables.
6. Après restauration du service, vérifier les configurations et effectuer une vente réelle contrôlée avec les comptes/numéros de test autorisés, puis observer quelques commerçants sans les guider.

Critères de sortie proposés : aucune fausse confirmation dans les scénarios testés ; aucune action automatique sur conversation en pause ; aucune relance répétée involontaire ; prix et quantité identiques entre accord et commande ; erreur récupérable sans ressaisie inutile. Mesurer ensuite temps vendeur économisé et interventions nécessaires. Les 30 tests actuels ne suffisent pas à garantir ces critères.
