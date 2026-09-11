# Passation DjassaBot — 11 septembre 2026

## Lire ceci avant de reprendre

Alex suspend le travail par manque de crédits et demande une transmission, pas un nouveau développement. Le VPS Hostinger est arrêté faute de renouvellement. L'objectif reste une application de vente WhatsApp fiable, simple sur téléphone, adaptée aux commerçants de Côte d'Ivoire et à leur budget. Ne pas confondre belle interface, tests isolés réussis et produit prêt à vendre.

Lire les instructions `AGENTS.md`, le contexte `CLAUDE.md`, puis le TODO officiel `VIABILITE.md`, cette passation, l'audit consolidé `AUDIT_VIABILITE_2026-09-11.md` et le journal `CLAUDE_ROADMAP.md`. Cette passation précise l'état courant ; les affirmations historiques « tout est corrigé » ne font pas foi. L'audit global du 10 septembre est préliminaire ; les constats détaillés des audits décrivent parfois l'état AVANT les cinq lots ci-dessous.

**État de livraison : les cinq lots sont locaux, non commités et non pushés.** Dernière base connue : `308ed0e`, branche main ; aucune nouvelle vérification distante à la passation. Un clone GitHub seul ne contient donc pas ce travail. Reprendre dans ce dossier ou transférer les fichiers modifiés ET nouveaux, après contrôle des secrets. `git diff` seul omet les fichiers non suivis. Ne pas embarquer `.env`, clés Firebase, identifiants WhatsApp, `node_modules` ou archives non examinées. `backend.zip` préexistait : laissé intact, pas un livrable validé. Cette archive de 36 Mo contient `backend/.env` et `firebase-admin-key.json` : elle est désormais exclue par `.gitignore`. Ne jamais la committer, la joindre à un transfert ni l'extraire dans un dépôt partagé ; vérifier `git status` avant tout `git add`.

## Ce qui est déjà corrigé localement — ne pas refaire

1. **Accès et connexion** : zéro initial ivoirien conservé ; rejets email remontés ; groupes/broadcasts/chaînes exclus ; pause/expiration/historique contrôlés avant analyse média ; état déconnecté après fermeture, anciens sockets ignorés, fermeture répétée sans double minuterie. Code de jumelage retiré des logs.
2. **Produits et commandes** : liste blanche des champs modifiables, mapping `manageStock` ; erreurs stock non annoncées comme succès, secours limité à RPC absente ; panier fermé avant notifications et effacé explicitement en base ; échec d'envoi client n'empêchant plus la tentative vendeur. Ce n'est PAS une transaction globale ni une garantie anti-doublon.
3. **Compréhension** : montants `12.5k` / `12,5k`, quantités entières, balises invalides refusées ; produit choisi uniquement sur correspondance unique ; clarification sur ambiguïté, sans ajout partiel d'une demande contenant une ligne rejetée. Pas de reconnaissance complète des photos ni de gestion souple de toutes les variantes.
4. **Statistiques** : Accueil/Analytics affichent « Montant des commandes », pas encaissement ; annulations/statuts inconnus/montants invalides exclus, journées d'Abidjan cohérentes. Lecture DB défaillante = erreur 503 et indisponibilité, pas faux zéro. Les commandes en attente restent comptées comme commandes.
5. **Simulateur** : contexte mémoire isolé par boutique, identifiant imposé serveur, pas de sessions clients/commandes/stock/notifications/journaux métier dans les chemins simulés testés. Une action simultanée par boutique, expiration différée après 30 minutes d'inactivité, plafond 1 000 boutiques. Reset visuel seulement après succès ; erreurs explicites. Utilise les réglages ENREGISTRÉS, pas les brouillons.

Fichiers principaux modifiés : `backend/src/index.ts`, `backend/src/routes/aiRoutes.ts`, les services `dbService.ts`, `resendService.ts`, `sessionService.ts`, `whatsapp/{flowHandler,messageHandler,salesEngine,sessionManager}.ts` ; côté frontend `components/AIPlayground.tsx`, `pages/{Signup,Onboarding,WhatsAppConnect,Today,Overview}.tsx`, `utils/overviewMetrics.ts`.

**Nouveaux fichiers indispensables** : `backend/src/services/simulationContext.ts` et `backend/src/services/whatsapp/__tests__/auditFixes.test.ts`. Tests existants enrichis : `salesEngine.test.ts`. Conserver aussi les deux rapports et le dossier `audit/`.

## Vérifications acquises et limites

- Dernier passage après le cinquième lot : **83 tests backend réussis**, TypeScript backend réussi, build frontend réussi, `git diff --check` réussi.
- `npm run lint` backend correspond à TypeScript, pas à ESLint. ESLint frontend avait trois erreurs `no-explicit-any` connues dans Login, Orders et Signup ; pas corrigées ni revérifiées lors du dernier lot.
- Tests avec dépendances remplacées : aucune validation réelle DB, WhatsApp, IA, Firebase, Resend ou paiement ; pas de recette visuelle complète.
- `audit/offline-probes.cjs` conserve les dix reproductions historiques désormais remplacées par des tests de régression : elles sont ignorées. « 0 reproduit » n'est PAS une nouvelle certification de correction.
- Les snapshots `audit/*-dependencies.json` datent du 10 septembre : backend 24 entrées affectées (3 critiques), frontend 10 (2 critiques). Ce sont des alertes de dépendances, pas des exploitations démontrées. Aucune mise à jour ciblée effectuée.
- Le simulateur utilise encore une vraie IA payante quand on l'utilise normalement. Les tests seuls la remplacent. Verrou mono-processus, pas de quota ni timeout complet ; anciennes simulations persistées non nettoyées. Ne jamais les supprimer en masse sans identification.

## Travail restant — ordre recommandé

Les cases suivantes sont ouvertes. Les détails et preuves initiales restent dans l'audit consolidé. Revalider chaque constat dans le code avant modification ; ne pas interpréter cette liste comme une autorisation de dépenses ou de changements produit stratégiques.

### 1. Intégrité commande/stock et reprise après panne — prioritaire

- [ ] Transaction durable commande + stock + état, clé d'idempotence de validation, concurrence sur dernier article. Aujourd'hui le secours stock reste non atomique et la compensation peut échouer.
- [ ] Traiter les réponses de base perdues : une écriture peut avoir réussi malgré une erreur réseau. Pas de nouvelle commande ni restitution de stock aveugle.
- [ ] Faire remonter les échecs critiques de sauvegarde de session ; éviter l'écrasement concurrent panier/pause/historique par lecture-modification-écriture ; vérifier partout le filtrage boutique.
- [ ] File persistante de notifications avec reprises et échecs visibles, pas seulement logs. Fermer le panier avant envoi ne couvre pas un crash entre écritures.
- [ ] Tests sur base isolée : deux clients pour le dernier article, double validation, deux annulations, arrêt entre étapes, réponse perdue, échec partiel multi-articles.

Cibles : `dbService.ts`, `sessionService.ts`, `flowHandler.ts`, migrations SQL. Concevoir et tester localement avant toute migration distante ; inventaire et sauvegarde nécessaires.

### 2. Dépendances et contrôle des accès — avant remise en ligne

- [ ] Examiner les alertes, notamment Baileys ; mises à jour ciblées avec lockfile et régressions, jamais `audit fix --force` aveugle.
- [ ] Vérifier propriété de chaque ressource sur les routes service_role, rôles, suspension des comptes avec jeton déjà émis, révocation et limitation des requêtes.
- [ ] Validation serveur des prix/quantités/variantes et champs entrants, pas uniquement la liste blanche de modification produit.
- [ ] CORS exact, séparation preview/production, erreurs sans secrets, logs sans données inutiles. Ne jamais afficher la configuration Git : le remote peut contenir un jeton.

### 3. Paiements, reçus et abonnements

- [ ] Montant calculé serveur depuis la commande appartenant à la boutique ; référence unique persistée et rapprochement montant/devise/commande. Ne pas croire le corps de requête ou les métadonnées seuls.
- [ ] Webhooks idempotents et ordre inversé, vérification de signature/configuration du corps brut, erreurs de persistance non acquittées comme succès.
- [ ] Source unique du forfait effectif, renouvellement depuis la bonne échéance, annulation effective et règles d'expiration explicites.
- [ ] Garder la consultation des commandes existantes à expiration tout en suspendant l'automatisation : intention exprimée, contrôle des routes encore à harmoniser.
- [ ] Corriger email fictif de paiement, parcours téléphone sans email, retours de paiement, exposition contrôlée du sous-compte vendeur et intégration des liens de paiement existants.
- [ ] Aucun reçu image ne suffit à déclarer payé : rapprochement de référence, cohérence des métadonnées, file de vérification vendeur même sans commande en attente.
- [ ] Valider avec Alex le renouvellement Mobile Money manuel versus abonnement automatique carte, puis vérifier les possibilités réelles du compte Paystack ivoirien. Ne pas promettre la récurrence Mobile Money.

Cibles : routes/services Paystack, `tenantService.ts`, écrans Subscription et compte.

### 4. Livraison et après-vente — besoin explicitement demandé par Alex

- [ ] Séparer paiement et livraison ; harmoniser `SHIPPING` / `SHIPPED` et les traductions qui confondent livraison et paiement.
- [ ] Une fiche livreur unique, copiée/partagée depuis les données sauvegardées, disponible aussi pour paiement à réception, pas seulement `PAID`.
- [ ] Contenu : référence, nom/téléphone utilisable (pas JID), commune/quartier/repère, localisation si fournie, articles/variantes/quantités, créneau, frais, déjà payé, **reste à encaisser**, contact vendeur, informations manquantes. Aucune marge/prix minimum ni conversation privée.
- [ ] Frais zéro explicites ; vérifier zone desservie avant seuil de gratuité.
- [ ] Client absent, livraison échouée, annulation après paiement, retour, remboursement et remise en stock physique : états et responsabilités distincts.
- [ ] Retrouver la commande après validation pour « où est ma commande ? », même lorsque le panier est revenu à l'état initial.

Cibles : Orders, `notificationService.ts`, types et données commande. Commencer par une file d'actions vendeur simple, pas un système logistique disproportionné.

### 5. Fiabilité WhatsApp et récupération de compte

- [ ] Sérialiser les connexions concurrentes ; déconnexion volontaire annulant watchdog et minuteries ; état souhaité persistant distinct de l'état observé.
- [ ] Lecture du statut sans effet de connexion ; reprise au démarrage des sessions déconnectées disposant d'identifiants.
- [ ] Déduplication persistante des messages, politique explicite de retard après panne, arrêt propre avec tâches en cours récupérables.
- [ ] Limites taille/durée média et timeouts, respect de `voiceEnabled`, traitement honnête des échecs, messages cités/statuts/localisation/contacts et identifiants `@lid`.
- [ ] Recontrôler pause avant envoi après attente IA ; coordonner réponses manuelles, bot et relances ; consentement/opposition aux relances. Les délais ne garantissent pas l'absence de bannissement.
- [ ] Réinitialisation mot de passe : vérifier réellement la sauvegarde utilisateur, consommation unique du jeton après succès ; inscription partielle récupérable/idempotente.
- [ ] Examiner parcours de vérification inactifs et contournements de test ; recette réelle Firebase/Resend quand possible, sans annoncer l'envoi s'il n'existe pas.

Cibles : `sessionManager.ts`, gestion Baileys, `messageHandler.ts`, relances, contrôleurs auth et `tenantService.ts`.

### 6. Vente conversationnelle et choix IA

- [ ] Actions structurées plutôt que balises libres ; véritables instructions système côté fournisseur ; désactiver les réponses factices de secours en production sans clé.
- [ ] Politique de négociation unique : plancher, concessions, offre déjà faite mémorisée, prix par lot/unité, frais séparés. Champ vendeur « dernier prix accepté » accessible.
- [ ] Changer article/quantité/variante, retirer une ligne et revenir en arrière sans perdre le panier ; confirmation explicite du total livraison comprise avant validation.
- [ ] Variantes : éviter S correspondant à XS ou L à XL, contrôler supplément/plancher, stock multidimensionnel, images de variantes ; ne pas supprimer silencieusement les achats au-delà de trois lignes.
- [ ] Produit depuis photo/message cité : contexte fiable, pas simple proximité de nom. Évaluer les clarifications supplémentaires du nouveau matcher.
- [ ] Ne pas réinjecter d'exemples fictifs quand les exemples enregistrés sont vides ; ne pas sauvegarder d'adresse/téléphone par défaut après échec de chargement ; retirer les données privées inutiles du prompt.
- [ ] **OpenRouter est une passerelle, pas un modèle.** Comparer fournisseurs/modèles avec conversations ivoiriennes anonymisées et autorisées : exactitude commerciale, coût texte/images/vocaux, latence, limites, confidentialité, secours. Aucun changement de fournisseur décidé, aucune promesse que ce sera meilleur.
- [ ] Tester négociation et confiance avec commerçants locaux ; pas de ton « ivoirien » caricatural ou de méthode unique présumée.

Cibles : `aiService.ts`, `salesEngine.ts`, `flowHandler.ts`, réglages et catalogue. Valider budget et politique de données avec Alex avant tout benchmark payant.

### 7. Données, interface et prise en main

- [ ] Journal de conversations durable distinct des 20 messages de contexte ; historique et pagination adaptés (les sessions actives sur 24 h ne sont pas l'ensemble des clients).
- [ ] Vrais états lu/non lu ; agrégats serveur au-delà des limites de lecture Supabase ; journal paiements/remboursements avant statistiques d'encaissement réel.
- [ ] Marketing : type de journal compatible schéma, erreurs visibles, segments n'assimilant pas commandes impayées à dépenses, opposition aux campagnes. Fonctions avancées secondaires au parcours de vente.
- [ ] Inbox : gérer les refus HTTP d'envoi, conserver le texte/réessai, ne pas afficher les réponses d'une ancienne conversation après changement, vérifier les réponses avant affichage, ne pas forcer le défilement pendant lecture.
- [ ] Unifier édition produit et compte ; supprimer commandes visuelles inactives, sauvegarde profil effective, mise à jour du contexte utilisateur, champs optionnels cohérents, caches privés isolés par boutique et effacés à déconnexion.
- [ ] Onboarding reprenable : minimum d'informations, règles boutique réutilisées, test puis activation explicite ; accueil montrant état réel du bot et prochaine action. Ne pas annoncer « prêt » trop tôt.
- [ ] Refonte globale ensuite, sur parcours validés : navigation simple, français sans jargon, priorité téléphone, noir/vert solide existant ; s'inspirer de la page appréciée sans animations gratuites.
- [ ] Accessibilité : labels, boutons nommés, clavier, focus des modales, fermeture, contraste, cibles tactiles, mouvement réduit, petit écran 320 px/zoom/clavier virtuel.
- [ ] Images compressées et chargées à la demande, formats/taille, nettoyage des fichiers orphelins ; requêtes annulables et réseau lent. PWA ne signifie pas données métier disponibles hors ligne.
- [ ] Capacitor : caméra/localisation/liens de paiement sur appareil réel si cette distribution est retenue ; privilégier le périmètre viable au budget disponible.

### 8. Schéma, exploitation et remise en production

- [ ] Réconcilier schéma initial et migrations (auth_tokens, essais/abonnements, colonnes Paystack), tester installation fraîche et mise à niveau sur base isolée.
- [ ] Examiner la migration RLS qui supprime les politiques publiques existantes : ne pas l'appliquer aveuglément. La clé service_role contourne RLS ; elle ne dispense jamais du filtrage métier.
- [ ] Sauvegardes externes DB + fichiers Storage + identifiants WhatsApp, test de restauration ; ne pas supposer une sauvegarde gratuite automatique complète.
- [ ] Santé réelle des dépendances, surveillance extérieure au VPS, rétention et protection des logs, support fonctionnel ; aligner suppression/conservation annoncées et implémentées. Les documents ne valent pas validation juridique.
- [ ] Mesurer coût IA, mémoire/CPU par boutique, concurrence, files et latence avant de promettre un nombre de bots ou des coûts négligeables.
- [ ] Recette bout en bout sur numéros autorisés après remise en service : compte → catalogue → connexion → négociation → commande → paiement vérifié → fiche livreur → livraison/incident → expiration → reprise après panne.

### 9. Défauts relevés lors d'une relecture externe, le 11 septembre au soir

Relecture du diff et des rapports par un agent tiers, sans exécution distante. Vérifications refaites : 83 tests backend, TypeScript backend, `git diff --check`, et les trois erreurs ESLint `no-explicit-any` de Login, Orders et Signup toujours présentes. Le build Vite complet n'a pas été rejoué. Les quatre points ci-dessous ne figuraient dans aucun document.

- [ ] **Clignotement des chiffres toutes les 15 secondes (régression du quatrième lot).** `Today.tsx` et `Overview.tsx` appellent `setOrdersAvailable(false)` avant de lire la réponse : entre les deux `await`, un rendu affiche « — » et « Impossible de vérifier les commandes ». Ne passer à l'état indisponible qu'en cas d'échec réel.
- [ ] **`updateOrderStatus` : erreur affichée alors que l'annulation a eu lieu.** Le statut est écrit en base, puis `restockItems` peut lever ; l'exception est capturée plus haut et la route répond en échec. Séparer l'échec de transition de l'échec de remise en stock, et signaler le second sans nier le premier.
- [ ] **Ancien socket WhatsApp non fermé.** Quand `createSession` remplace une session encore en `connecting`, l'ancien socket reste vivant : ses événements de connexion sont désormais ignorés, mais son écoute `messages.upsert` n'a pas de garde. Risque de double réponse au même client. Fermer explicitement le socket remplacé et filtrer aussi l'écoute des messages. Complète la priorité 5.
- [ ] **Correspondance produit plus stricte à éprouver.** Le nouveau `findProduct` exige que tous les mots correspondent, pluriel simple toléré ; les mots d'une lettre comptent désormais. Attendu, mais à mesurer sur de vraies conversations avant d'en faire une règle définitive : le bot demandera plus souvent de préciser.

Nuance sur `audit/offline-probes.cjs` : ses dix sondes ont été remplacées par des tests de régression et n'exécutent plus rien. Son « 0 constat reproduit » ne doit pas être cité comme une vérification indépendante des corrections.

## Décisions à demander à Alex

Modalités de renouvellement et grâce ; réservation du stock et moment exact de confirmation ; politique retours/remboursements ; conservation des données ; budget/fournisseur IA ; navigation de la refonte. Achats, migration distante, déploiement, messages et paiements réels nécessitent le périmètre/accord approprié. Ne pas refaire décider les petites corrections déjà autorisées, mais ne pas déduire une autorisation de production d'un « continue ».

## Reprise pratique, sans toucher à la production

1. Examiner `git status --short`, les différences et les nouveaux fichiers ; préserver tout travail existant, sans reset ni suppression.
2. Lire les tests isolés avant exécution. Vérifications habituelles : `cd backend && npm test`, `cd backend && npx tsc --noEmit`, `cd frontend && npm run build`, puis `git diff --check` depuis la racine. Ces commandes n'ont pas été relancées pour cette passation documentaire.
3. Choisir un lot borné parmi les priorités 1–2, définir les scénarios d'acceptation, corriger et mettre à jour VIABILITE/ROADMAP. Ne pas prétendre fermer l'audit entier avec les 83 tests.
4. Ne pas démarrer `backend/src/index.ts` avec les secrets réels : démarrage potentiellement connecté aux services, minuteries et WhatsApp. Vérifier aussi qu'une preview frontend ne cible pas la production.
5. Ne jamais exécuter `wipe_db.ts`. `scripts/check-project.sh` n'est pas un diagnostic purement passif : installation/chargement d'environnement possibles et échecs masqués. Ne pas l'utiliser sans examen.
6. Pas de SQL distant, nettoyage des anciennes simulations, appel IA payant, connexion WhatsApp, commit ou push pour cette passation. Un push main déclenche le déploiement frontend. Backend séparé, actuellement arrêté.

**Prochaine étape proposée : sécuriser les écritures commande/stock et les dépendances avant la refonte visuelle. Aucun travail de fond ne continue automatiquement après cette passation.**
