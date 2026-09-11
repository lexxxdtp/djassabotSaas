# DjassaBot — audit transversal hors production

> Synthèse préliminaire, complétée et remplacée par [l'audit consolidé du 11 septembre 2026](AUDIT_VIABILITE_2026-09-11.md). Consulter ce dernier pour les reproductions, les nouveaux blocages et la prise en main.

Date : 10 septembre 2026. Base locale : commit `308ed0e`.

## Conclusion

Le besoin produit est cohérent : éviter au commerçant de répéter les mêmes informations et préparer des commandes exploitables. En revanche, la fiabilité de plusieurs transitions ne permet pas encore de considérer chaque conversation comme une vente correctement suivie. Changer de modèle ne corrigera pas ces défauts.

OpenRouter mérite une évaluation : ce n'est pas un modèle concurrent de Gemini, mais un accès unifié à plusieurs modèles et fournisseurs. Recommandation : rendre le fournisseur interchangeable, comparer sur les mêmes conversations, puis choisir un modèle principal et un secours testés. Ne pas migrer aveuglément ni engager des dépenses maintenant.

## Portée et limites

Lecture des principaux parcours backend et frontend : WhatsApp, sessions, IA, catalogue, panier, commandes, paiements, abonnements, authentification, campagnes, navigation et scripts d'exploitation. Audit statique et vérifications locales, pas une certification exhaustive ligne par ligne, un pentest ou un test de production.

Le VPS est arrêté selon Alex. Les données réellement présentes, migrations appliquées, règles RLS, secrets, webhooks, sauvegardes, sessions WhatsApp et performances réelles n'ont pas été vérifiés. Aucun envoi WhatsApp, appel IA payant, changement de configuration distante ou redémarrage n'a été effectué. Les références de code ci-dessous sont relatives à la racine du dépôt.

## Constats prioritaires

### P1 — Messages reçus avec retard potentiellement perdus pour la vente

Dans `backend/src/services/whatsapp/sessionManager.ts:137`, un message de plus de 60 secondes est ignoré ; au-delà de 10 secondes il est traité comme de l'historique. L'âge ne suffit pas à distinguer un doublon d'un vrai message arrivé tard. Le traitement séquentiel peut aussi faire vieillir les messages d'un lot.

À faire : distinguer explicitement relecture et nouvel événement, conserver les identifiants traités, prévoir une politique de reprise après panne. Ne pas répondre automatiquement à tout l'ancien historique lors du redémarrage.

### P1 — Paiement, commande et stock ne forment pas une opération fiable unique

`backend/src/services/dbService.ts:27` bascule sur une modification de stock en lecture/écriture après une erreur RPC ; une branche d'échec peut retourner un succès. À partir de `:392`, le statut de commande change avant certaines opérations de stock. À partir de `:710`, les produits sont traités séparément avec compensation : ce n'est pas une transaction globale. Deux annulations concurrentes peuvent appliquer deux remises en stock.

À faire : opérations transactionnelles, transitions autorisées et protection contre les traitements répétés. Tester concurrence, rupture sur le deuxième article et panne de base. Une erreur ne doit pas devenir une confirmation de vente.

### P1 — La création et la confirmation d'un paiement doivent être rattachées à la commande

`backend/src/routes/paystackRoutes.ts:219` accepte montant et identifiant depuis la requête sans recalculer le montant depuis la commande du commerçant. `backend/src/services/paystackService.ts:276` passe la commande à PAID sur la base des métadonnées, sans comparaison visible montant/devise attendus. La vérification par référence doit également vérifier l'appartenance au commerçant.

À faire : calcul serveur, référence persistée, contrôle du montant et de la devise, traitement idempotent. Les callbacks configurés à `:54` et `:199` ne correspondent pas à des pages déclarées dans `frontend/src/App.tsx`. Ajouter un retour de paiement avec vérification serveur ; une redirection ne prouve pas le paiement.

Le correctif antérieur qui empêche une capture de reçu de suffire à déclarer PAID est utile, mais ne constitue pas à lui seul un parcours complet de rapprochement et de confirmation marchande.

### P1 — Les droits du forfait ont plusieurs sources incohérentes

Le webhook appelle `createSubscription` (`backend/src/services/paystackService.ts:264`), qui insère l'abonnement (`backend/src/services/tenantService.ts:471`). La limite de produits utilise cependant `tenant.subscriptionTier` (`backend/src/index.ts:279`), sans mise à jour correspondante visible dans ce chemin. Un forfait payé peut donc conserver la limite Starter, sauf mécanisme en base non vérifié.

L'échéance est recalculée depuis maintenant, les notifications répétées ne sont pas explicitement dédupliquées, et une erreur de persistance peut être absorbée avant la réponse de succès au webhook.

À faire : une source unique pour les droits, renouvellement à partir de la bonne échéance, référence unique et erreurs permettant une nouvelle tentative. Conserver la consultation des commandes après expiration conformément au choix déjà exprimé par Alex.

### P1 — Le simulateur utilise les sessions réelles

`backend/src/routes/aiRoutes.ts:53` accepte un identifiant de session, puis écrit l'historique avant d'appeler le parcours en mode dryRun. Ce mode évite certaines mutations de commandes, mais ne sépare pas le stockage conversationnel. Une simulation peut polluer les listes/relances ; un identifiant correspondant à une vraie session du même commerçant peut altérer celle-ci, notamment lors de la réinitialisation.

À faire : espace de simulation isolé, identifiants imposés côté serveur, exclusion des campagnes et tâches automatiques. Tester explicitement l'absence d'effets réels.

### P2 — L'historique commercial est confondu avec la mémoire courte de l'IA

`backend/src/services/sessionService.ts:96` réduit l'historique enregistré aux 20 derniers messages. `:119` ne sélectionne que les sessions actives depuis 24 heures. Cette sélection alimente aussi les conversations et audiences marketing. « Tous » et « Récents sur 30 jours » ne correspondent donc pas à leur promesse. Le compteur non lu est fixé à zéro (`backend/src/routes/chatRoutes.ts:41`). L'audience VIP additionne des commandes sans limiter le calcul aux ventes payées.

À faire : conserver séparément les messages commerciaux et le contexte court du modèle ; requêtes paginées et filtrées par commerçant dès la base ; état de lecture réel. Différer les campagnes avancées tant que les audiences ne sont pas fiables.

### P2 — Le raisonnement commercial doit être structuré, pas seulement mieux formulé

`backend/src/services/aiService.ts:22` fixe Gemini 2.5 Flash. À `:389`, les règles sont envoyées comme un message utilisateur intitulé « System Instruction », pas dans le champ système dédié. Les actions reposent sur des balises textuelles et une analyse par expressions régulières. Sans clé, `:99` retourne une logique de simulation dans le chemin normal.

Deux sondes locales reproduisent des ambiguïtés : « robe » sélectionne le premier produit parmi robe rouge et robe bleue ; le montant « 12.5k » est interprété comme 125000. Les contrôles serveur peuvent limiter certaines conséquences, mais pas corriger la compréhension du client.

À faire : rôle système adapté au fournisseur, actions structurées validées, clarification des produits ambigus, gestion explicite des modifications du panier et confirmation du total livré. Ne jamais utiliser les réponses simulées en production faute de clé.

Pour la négociation : une seule politique de prix, mémoire de l'offre déjà proposée, distinction entre prix unitaire, lot et livraison, aucune promesse hors des règles du vendeur. Les particularités de langage et pratiques locales doivent être éprouvées avec des conversations ivoiriennes autorisées et anonymisées, sans prétendre à une méthode universelle.

### P2 — Le catalogue ne porte pas encore toute la promesse commerciale

Le formulaire produit ne permet pas de configurer `minPrice`, alors que le moteur et la promesse commerciale en ont besoin. Le stock des variations est additionné entre dimensions : compter les tailles puis les couleurs peut compter deux fois les mêmes unités physiques.

À faire : prix plancher propriétaire, validation serveur et stock par combinaison vendable lorsque plusieurs dimensions existent. Réutiliser livraison, paiement et retours au niveau boutique ; ne demander au vendeur que les exceptions par produit.

### P2 — Les échecs d'enregistrement restent parfois masqués

Certains services de sessions et de données absorbent les erreurs ou utilisent une mémoire locale. Une réponse HTTP réussie ne garantit donc pas toujours une pause ou une modification durable. L'inscription crée plusieurs objets successivement sans rollback global visible : une panne intermédiaire peut laisser une inscription partielle.

À faire : distinguer explicitement les opérations critiques des lectures tolérant un cache, renvoyer l'échec réel et rendre l'inscription relançable sans doublons. Tester les pannes, pas seulement le chemin heureux.

## OpenRouter : intérêt réel et limites

### Ce que cela apporte

- Une interface commune pour comparer des modèles sans réécrire le métier.
- Des possibilités de secours entre fournisseurs ou modèles.
- Des paramètres de routage, coût et confidentialité à fixer explicitement.

### Ce que cela ne résout pas

- Ni l'hébergement du backend, ni la connexion WhatsApp persistante.
- Ni les erreurs de stock, les messages ignorés ou les droits d'abonnement.
- Ni la qualité automatiquement : elle dépend du modèle sélectionné, du contexte et des règles.
- Ni une production gratuite garantie : les variantes gratuites ont des limites.

La tarification publique consultée affiche 5,5 % de frais de plateforme en paiement à l'usage ; ne pas assimiler les tarifs d'inférence affichés à l'absence de frais. La confidentialité dépend également des fournisseurs derrière OpenRouter, pas seulement d'OpenRouter. Restreindre les fournisseurs et politiques de conservation selon les données transmises.

Sources officielles consultées : [tarification](https://openrouter.ai/pricing), [FAQ](https://openrouter.ai/docs/faq), [sélection des fournisseurs](https://openrouter.ai/docs/guides/routing/provider-selection), [modèles de secours](https://openrouter.ai/docs/guides/routing/model-fallbacks), [sorties structurées](https://openrouter.ai/docs/guides/features/structured-outputs).

### Architecture recommandée — à valider avant migration

Garder les règles commerciales indépendantes de l'IA. Ajouter une petite interface fournisseur avec configuration du modèle, délai maximal, validation des actions et mesure des usages. Choisir un modèle principal stable et un secours explicitement testé ; ne pas activer une sélection incontrôlée de modèles pour une même négociation.

Comparer séparément texte, photos de produits et vocaux : la compatibilité sur le texte ne garantit pas celle de l'audio. Prévoir le contexte adapté plutôt que renvoyer tout le catalogue systématiquement. Aucun besoin démontré aujourd'hui de fine-tuning, d'agents multiples ou d'une base vectorielle.

Si Gemini direct est conservé, le SDK utilisé `@google/generative-ai` a un successeur recommandé par Google : [guide de migration vers Google GenAI](https://ai.google.dev/gemini-api/docs/migrate). Ce chantier est distinct du choix OpenRouter.

### Évaluation proposée, sans dépense engagée

Constituer 40 à 60 conversations de test, puis un jeu indépendant de validation : produit ambigu, variantes, vocabulaire local, montant abrégé, négociation répétée, lot, livraison, vocal, photo, changement d'avis, annulation, rupture, faux reçu et demande hors règles.

Comparer l'existant à deux options accessibles via OpenRouter sur les mêmes cas. Mesurer exactitude produit/prix, respect du plancher, commandes correctement préparées, questions inutiles, temps de réponse, échecs et coût par conversation utile. Pour les garde-fous critiques, exiger zéro violation dans le jeu de validation, sans prétendre que cela garantit zéro erreur future.

Ne pas sélectionner uniquement la réponse qui « parle le mieux ». Sans mesure de tokens, volume réel, longueur des échanges et taux de reprise, il serait trompeur de promettre une économie mensuelle.

## Produit : simplifier le service avant d'ajouter des écrans

### Cadrage confirmé avec Alex après la première restitution

Ce travail reste une phase de diagnostic et de proposition. Développement, migration IA et mise en production viendront ensuite, après discussion des priorités. Le VPS arrêté et le budget limité sont des contraintes de conception, pas une raison d'engager une migration précipitée.

La finalité n'est pas seulement de faire répondre un bot : réduire les échanges répétitifs du vendeur, préparer une commande exploitable et faciliter son exécution jusqu'à la livraison. Le vendeur doit pouvoir reprendre la conversation à tout moment, mais ce n'est pas le principal problème à résoudre. Les propositions doivent tenir compte du téléphone comme outil quotidien, du transfert de messages WhatsApp et des informations réellement utilisables par le livreur. Les pratiques supposées locales restent des hypothèses tant qu'elles ne sont pas validées par des échanges réels autorisés.

### Complément vérifié — message transférable au livreur

La fonction existe déjà en partie dans `backend/src/services/whatsapp/notificationService.ts` : un résumé est envoyé au numéro de notification du vendeur avec contact client, adresse, articles, variantes et total. L'appel se trouve dans `backend/src/services/whatsapp/flowHandler.ts` à la confirmation de commande. Ce constat corrige toute impression qu'il faudrait construire cette fonction de zéro ; son fonctionnement réel sur WhatsApp reste à tester.

Limites constatées : le message annonce « à livrer » et « total à encaisser » sans consulter l'état du paiement ; il peut également préciser que les frais de livraison restent inconnus. L'appel ne transmet pas la référence de la commande créée. Le résumé est construit à partir du panier temporaire, pas d'une fiche de préparation actualisée depuis la commande.

Proposition à valider : séparer l'alerte de nouvelle commande de la fiche prête à transférer. Cette dernière doit contenir référence, destinataire et téléphone, lieu avec repère si nécessaire, contenu et variantes, frais de livraison, paiement confirmé et reste exact à encaisser. Ajouter le point de retrait et un créneau seulement s'ils sont nécessaires et réellement renseignés. Ne pas y inclure les marges, prix planchers, reçus ou historique privé de négociation.

Si adresse, frais ou paiement sont incertains, afficher une fiche à compléter plutôt qu'une instruction ambiguë de départ. Ne pas confondre validation du client avec décision d'expédier. Prévoir une action de copie/partage et une fiche actualisée en cas de modification ; le vendeur garde le choix de son livreur, sans envoi automatique à un tiers présumé.

Critères de validation : le vendeur peut transférer sans réécrire ; le livreur comprend quoi récupérer, où livrer, qui appeler et combien encaisser ; une commande déjà payée ne demande pas un deuxième encaissement ; une commande modifiée ou annulée n'est pas présentée comme prête. Tester aussi frais seuls à encaisser, paiement à la livraison, adresse incomplète et destinataire différent de l'acheteur.

Autre incohérence découverte lors de cette vérification : la confirmation client contient encore une promesse de validation automatique du reçu, alors que le correctif antérieur exige désormais une vérification humaine. Aligner ce texte sur le comportement réel avant remise en service.

### Grille pour compléter la validation du produit

Suivre le parcours entier : ajout du produit, arrivée du prospect, identification, questions et négociation, panier modifiable, accord sur le total, confirmation du paiement selon le mode choisi, préparation, transfert au livreur, livraison réussie ou échouée, annulation et éventuel remboursement. Pour chaque étape, documenter ce qui existe, les informations manquantes, les actions du vendeur/client/livreur, les reprises après erreur et les preuves nécessaires.

Les dernières étapes, notamment livraison échouée, retour et remboursement, ne sont pas certifiées couvertes par cet audit. Elles constituent des scénarios à examiner explicitement, pas des fonctionnalités à ajouter automatiquement sans besoin validé. Cette grille doit guider la suite du rapport et les arbitrages, sans présenter les recommandations comme du code déjà testé.

Parcours cible : le vendeur ajoute ses produits et règles une fois ; le client obtient les bonnes informations ; le bot prépare un panier modifiable ; le client confirme le total livré ; le vendeur reçoit une commande exploitable et voit séparément paiement et livraison.

L'accueil doit répondre à trois questions : WhatsApp fonctionne-t-il ? Qu'est-ce qui nécessite mon attention ? Quelle action faire maintenant ? Montrer les données indisponibles comme indisponibles, pas comme zéro vente.

L'activation doit inclure un test réel et une confirmation explicite. Les reprises après panne et expiration font partie du produit, pas seulement de l'exploitation. Les fonctionnalités avancées de marketing et statistiques viennent après la fiabilité de cette boucle principale.

## Coût et exploitation avec le VPS arrêté

On peut maintenant lire le code, compiler, tester les fonctions isolées et simuler les dépendances sans rallumer le VPS. Le dépôt GitHub n'est pas une sauvegarde des données ou sessions WhatsApp. Le script de sauvegarde observé conserve des archives sur le même VPS : il ne protège pas contre la perte de ce serveur.

Avant renouvellement ou changement d'hébergeur : vérifier dans le compte Hostinger la conservation du disque, les sauvegardes disponibles et les conditions de restauration. L'arrêt seul ne prouve pas une perte de données. Aucun de ces points n'a été vérifié ici.

À la remise en ligne : contrôler sauvegardes, migrations, configuration, paiements et file de messages avant de réactiver les automatismes. Ajouter une sauvegarde hors serveur et éprouver la restauration. Ne pas migrer Baileys vers un simple hébergement de pages ou de fonctions éphémères en supposant une connexion persistante identique. Une éventuelle évolution de l'intégration WhatsApp doit faire l'objet d'une comparaison séparée des contraintes officielles et coûts actuels.

## Qualité et performances

- 35 tests backend passent ; la vérification TypeScript backend passe.
- Le build frontend avait passé lors de la vérification du commit courant.
- Le lint frontend échoue sur trois `any` : `Login.tsx:46`, `Orders.tsx:329`, `Signup.tsx:88`.
- Pas de workflow d'intégration continue trouvé dans `.github/workflows`.
- Plusieurs vues interrogent périodiquement plusieurs routes ; ajouter pagination et pause des rafraîchissements quand l'onglet est masqué avant d'introduire une infrastructure plus complexe.
- Le découpage des pages et du module de graphiques est un acquis à préserver. Le cache PWA ne prouve pas que les commandes sont utilisables hors ligne.

Les tests existants ne prouvent pas les scénarios WhatsApp, paiement réel, concurrence et reprise après panne. Le rendu visuel mobile complet n'a pas été testé dans cet audit.

## Ordre proposé

1. Sans dépense : tests reproduisant les constats, séparation simulation/réel, erreurs honnêtes, normalisation des montants et produits ambigus.
2. Avant clients payants : cohérence commande-stock-paiement, droits des forfaits, historique durable et reprise WhatsApp.
3. Avec un petit budget explicitement autorisé : comparaison mesurée via OpenRouter, puis décision de fournisseur et secours.
4. Après remise en ligne contrôlée : essais bout en bout avec quelques vendeurs, suivi du temps économisé et des commandes réellement exploitables.
5. Refonte complète de l'interface sur ces parcours stabilisés, sans remplacer les preuves de fiabilité par une nouvelle apparence.

Ce document propose des décisions ; il ne les applique pas. Aucun code applicatif modifié, aucun abonnement acheté et aucun push effectué pendant cet audit.
