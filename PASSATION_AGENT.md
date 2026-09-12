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

- [~] **Clé d'idempotence faite le 11 septembre ; transaction durable toujours ouverte.** Le panier porte une clé posée à son premier article : deux validations du même panier ne peuvent plus produire deux commandes ni deux décréments. `finalizeOrder` consulte la clé AVANT de toucher au stock, et rend le stock quand une course concurrente est perdue. Migration `add_order_idempotency_key.sql` À APPLIQUER : sans elle, le code détecte la colonne absente, avertit une fois et crée la commande sans protection. Restent ouverts : la transaction durable commande + stock + état, et le secours stock non atomique quand la RPC `adjust_stock` n'est pas déployée.
- [ ] Traiter les réponses de base perdues : une écriture peut avoir réussi malgré une erreur réseau. Pas de nouvelle commande ni restitution de stock aveugle.
- [x] **Fait le 11 septembre — échecs critiques de sauvegarde de session.** `saveSessionToDb` distingue désormais l'écriture critique (panier, état) de l'historique : la première remonte l'erreur, la seconde se contente d'un journal. `getSession` lève au lieu de fabriquer une session vide après une lecture en échec, ce qui effaçait le panier d'un client en pleine commande. `finalizeOrder` traite le cas où le panier ne peut pas être fermé après création de la commande : le client est explicitement prié de ne pas renvoyer son adresse et le vendeur reçoit un avertissement, au lieu d'un doublon silencieux. Reste ouvert dans cette ligne : l'écrasement concurrent lecture-modification-écriture hors file de conversation (relances, tableau de bord) et la revérification du filtrage boutique partout.
- [ ] File persistante de notifications avec reprises et échecs visibles, pas seulement logs. Fermer le panier avant envoi ne couvre pas un crash entre écritures.
- [ ] Tests sur base isolée : deux clients pour le dernier article, double validation, deux annulations, arrêt entre étapes, réponse perdue, échec partiel multi-articles.

Cibles : `dbService.ts`, `sessionService.ts`, `flowHandler.ts`, migrations SQL. Concevoir et tester localement avant toute migration distante ; inventaire et sauvegarde nécessaires.

### 2. Dépendances et contrôle des accès — avant remise en ligne

- [x] **Fait le 11 septembre — alertes de dépendances.** `npm audit fix` SANS `--force` a suffi : backend 25 → 9 (plus aucune critique ni haute), frontend 18 → 0. Les deux `package.json` sont inchangés, seuls les lockfiles bougent, et aucune version majeure n'a été franchie. Corrigées notamment : exécution de code arbitraire dans protobufjs, RCE `react-router` via turbo-stream, `websocket-driver`, `ws`, `axios`, `multer`, `tar`.
  ⚠️ **Baileys est passé de rc.9 à rc14 à l'intérieur de la plage déclarée.** Les 102 tests et TypeScript passent, mais aucun test ne touche une vraie connexion WhatsApp : cette montée est la seule du lot qui demande une vérification manuelle au retour en ligne (jumelage, réception d'un message, envoi d'une image).
  Restent ouvertes : 9 alertes modérées côté backend, dont la correction exigerait des changements de rupture.
- [ ] Vérifier propriété de chaque ressource sur les routes service_role, rôles, suspension des comptes avec jeton déjà émis, révocation et limitation des requêtes.
- [x] **Fait le 11 septembre — validation serveur des champs produit.** `productValidation.ts`, logique pure testée : NaN et Infinity sont des nombres non négatifs et passaient l'ancienne vérification, un seul produit à NaN contaminant ensuite tous les totaux. `minPrice`, plancher de la négociation, n'était pas validé du tout : il est désormais borné et ne peut pas dépasser le prix affiché. Stock exigé entier. Variantes et options vérifiées (nom, valeur, stock, supplément — une remise négative reste permise). Reste ouvert : la validation des autres entrées (réglages, marketing, profil).
- [x] **Fait le 11 septembre — CORS et fuites d'erreurs.** `localhost` n'est plus accepté quand `NODE_ENV` vaut production (l'app Capacitor, d'origine locale, reste autorisée). Quatorze routes renvoyaient au client le message d'erreur brut, susceptible de contenir une requête Supabase, une URL interne ou une réponse Paystack : elles renvoient désormais une phrase en français, l'erreur réelle restant journalisée côté serveur. Vérifié : aucune route n'expose la configuration Git. Restent ouverts : séparation preview/production et tri des données dans les logs.

### 3. Paiements, reçus et abonnements

- [x] **Fait le 11 septembre — le montant payé décide, plus la métadonnée.** Un paiement de 100 FCFA annoncé « business » n'ouvre plus un abonnement à 15 000, un sous-paiement ne marque plus une commande payée, la devise est vérifiée, et la commande est relue depuis la base en filtrant sur la boutique. Les cas refusés produisent un avertissement lisible par le vendeur au lieu d'un silence.
- [x] **Fait le 11 septembre — webhook Paystack.** Idempotence par référence (Paystack retentait jusqu'au premier 2xx, donc le même paiement prolongeait l'abonnement à chaque tentative). Une activation ratée remonte désormais au lieu d'être acquittée par un 200 : le client payait sans recevoir son abonnement et l'événement n'était jamais représenté. La signature et le corps brut étaient déjà vérifiés. Reste ouvert : l'ordre inversé des événements.
- [ ] Source unique du forfait effectif, renouvellement depuis la bonne échéance, annulation effective et règles d'expiration explicites.
- [ ] Garder la consultation des commandes existantes à expiration tout en suspendant l'automatisation : intention exprimée, contrôle des routes encore à harmoniser.
- [~] **Email fictif corrigé le 11 septembre ; le reste de la ligne est ouvert.** Le frontend envoyait `user@example.com` à Paystack quand le compte n'avait pas d'adresse (cas de toute inscription par téléphone), et la création de sous-compte retombait sur `vendor@djassabot.com` — la même adresse pour tous les vendeurs, sur un domaine qui n'existe pas. Le reçu et les notifications partaient donc dans le vide. Le serveur refuse désormais les adresses bouche-trou et mal formées ; le frontend demande l'adresse au vendeur au lieu d'en inventer une. Restent ouverts : retours de paiement, exposition contrôlée du sous-compte vendeur, intégration des liens de paiement existants.
- [ ] Aucun reçu image ne suffit à déclarer payé : rapprochement de référence, cohérence des métadonnées, file de vérification vendeur même sans commande en attente.
- [ ] Valider avec Alex le renouvellement Mobile Money manuel versus abonnement automatique carte, puis vérifier les possibilités réelles du compte Paystack ivoirien. Ne pas promettre la récurrence Mobile Money.

Cibles : routes/services Paystack, `tenantService.ts`, écrans Subscription et compte.

### 4. Livraison et après-vente — besoin explicitement demandé par Alex

- [~] **`SHIPPING` / `SHIPPED` harmonisés le 11 septembre ; séparer paiement et livraison reste à faire.** Les deux orthographes coexistaient et se contredisaient : le type déclarait `SHIPPING`, la route `PUT /api/orders/:id/status` n'acceptait que `SHIPPED` (donc un appel conforme au type était rejeté en 400), et côté interface `SHIPPED` n'était traité nulle part et tombait dans la branche par défaut « Annulée » — pendant que les statistiques le comptaient en recette. Le vendeur pouvait voir une commande annulée et un chiffre d'affaires qui montait pour la même vente. La route accepte désormais les deux et n'écrit que `SHIPPING` ; le mapping d'affichage vit dans `utils/overviewMetrics.ts` au lieu d'être recopié dans Orders, Overview et Today, où les copies avaient divergé ; un statut inconnu revient dans « Nouvelle » plutôt que d'être présenté comme annulé. Reste ouvert : distinguer réellement l'état de paiement de l'état de livraison, au lieu de les faire partager une case.
- [x] **Fait le 11 septembre.** `frontend/src/utils/deliverySlip.ts`, fonction pure testée. Le bouton existe maintenant aussi sur une commande « Nouvelle », donc le paiement à la livraison est couvert, pas seulement `PAID`.
- [~] **Contenu très majoritairement fait le 11 septembre.** Présents : référence, téléphone lisible (l'identifiant WhatsApp brut, et jamais un `@lid` transformé en faux numéro), adresse, articles/variantes/quantités, articles et livraison séparés avec frais nuls dits « offerte », total, **déjà payé ou reste à encaisser**, contact vendeur, et la liste explicite de ce qui manque. Un test vérifie qu'aucune marge ni prix minimum ne fuit vers le livreur. Restent absents faute d'être stockés : la localisation GPS et le créneau de livraison.
- [ ] Frais zéro explicites ; vérifier zone desservie avant seuil de gratuité.
- [ ] Client absent, livraison échouée, annulation après paiement, retour, remboursement et remise en stock physique : états et responsabilités distincts.
- [ ] Retrouver la commande après validation pour « où est ma commande ? », même lorsque le panier est revenu à l'état initial.

Cibles : Orders, `notificationService.ts`, types et données commande. Commencer par une file d'actions vendeur simple, pas un système logistique disproportionné.

### 5. Fiabilité WhatsApp et récupération de compte

- [x] **Fait le 11 septembre.** Une seule tentative de connexion en vol par boutique : les appels concurrents la partagent au lieu d'ouvrir trois sockets. `wantedOffline` porte l'état SOUHAITÉ : une déconnexion volontaire fait renoncer les minuteries de reconnexion et le watchdog. Limite : cet état vit en mémoire, un redémarrage du processus l'oublie.
- [x] **Lecture du statut passive — fait le 11 septembre.** `GET /whatsapp/status` ouvrait un socket Baileys à chaque appel pour une boutique déconnectée, soit toutes les 15 secondes depuis le tableau de bord : c'est précisément ce qui fait bannir un numéro. La route appelle maintenant `ensureSession`, qui n'ouvre que s'il n'existe aucune session et que le vendeur ne s'est pas déconnecté volontairement. Le rebranchement passe par la demande de code de jumelage, qui est explicite. Reste ouverte : la reprise au démarrage des sessions déconnectées disposant d'identifiants.
- [~] **Déduplication en mémoire faite le 11 septembre ; persistance toujours ouverte.** Un message relivré (reconnexion, resynchronisation, socket remplacé) ne déclenche plus une deuxième réponse : les identifiants vus sont retenus 10 minutes, bornés à 5 000 entrées. Limite assumée : cette mémoire est celle du processus, un redémarrage l'efface. Restent ouverts : la déduplication persistante, la politique de retard après panne et l'arrêt propre.
- [ ] Limites taille/durée média et timeouts, respect de `voiceEnabled`, traitement honnête des échecs, messages cités/statuts/localisation/contacts et identifiants `@lid`.
- [ ] Recontrôler pause avant envoi après attente IA ; coordonner réponses manuelles, bot et relances ; consentement/opposition aux relances. Les délais ne garantissent pas l'absence de bannissement.
- [~] **Sauvegarde et consommation du jeton vérifiées le 12 septembre ; inscription partielle toujours ouverte.** `updateUser` rend `null` en cas d'échec au lieu de lever, et trois routes ignoraient ce retour. À la réinitialisation : mot de passe non enregistré, lien pourtant consommé, réponse « Mot de passe réinitialisé » — l'utilisateur se retrouvait enfermé dehors, ancien mot de passe oublié et lien brûlé. Même chose aux vérifications e-mail et téléphone, qui annonçaient « vérifié » sans que le drapeau soit écrit, bloquant l'utilisateur au contrôle suivant, code déjà consommé. Les trois vérifient désormais l'écriture avant de répondre, et le jeton n'est consommé qu'après confirmation. Reste ouverte : l'inscription partielle récupérable et idempotente.
- [ ] Examiner parcours de vérification inactifs et contournements de test ; recette réelle Firebase/Resend quand possible, sans annoncer l'envoi s'il n'existe pas.

Cibles : `sessionManager.ts`, gestion Baileys, `messageHandler.ts`, relances, contrôleurs auth et `tenantService.ts`.

### 6. Vente conversationnelle et choix IA

- [~] **Réponses factices coupées en production le 12 septembre ; le reste est ouvert.** Sans clé Gemini valide, le bot envoyait à de vrais clients « [SIMULATED AI] Je suis en mode test », « (Mock: Price Inquiry) », et surtout une description de robe rouge pour n'importe quelle photo reçue — de quoi faire acheter autre chose que ce qui a été montré. En production, l'absence de clé lève désormais : le messageHandler répond qu'il y a un souci technique, ce qui est la vérité. Les simulacres restent disponibles hors production, où ils servent. Restent ouverts : actions structurées plutôt que balises libres, et vraies instructions système côté fournisseur.
- [ ] Politique de négociation unique : plancher, concessions, offre déjà faite mémorisée, prix par lot/unité, frais séparés. Champ vendeur « dernier prix accepté » accessible.
- [ ] Changer article/quantité/variante, retirer une ligne et revenir en arrière sans perdre le panier ; confirmation explicite du total livraison comprise avant validation.
- [~] **La confusion de tailles est corrigée le 12 septembre ; le reste de la ligne est ouvert.** La sélection testait `option.value.includes(saisie)` : « xs » contient « s » et « xl » contient « l », donc un client répondant « S » recevait du XS et « L » du XL, sans aucun signal avant la livraison. `chooseVariationOption` (logique pure testée) fait désormais correspondance exacte d'abord, puis rang dans la liste (« 2XL » reste un nom, pas un rang), puis correspondance partielle seulement si elle désigne une option unique ; une saisie ambiguë comme « bleu » face à « Bleu clair » et « Bleu foncé » fait demander de préciser au lieu de trancher. Restent ouverts : contrôle supplément/plancher, stock multidimensionnel, images de variantes, et la limite silencieuse de trois lignes.
- [ ] Produit depuis photo/message cité : contexte fiable, pas simple proximité de nom. Évaluer les clarifications supplémentaires du nouveau matcher.
- [~] **Faux nom de boutique retiré le 12 septembre.** Les valeurs par défaut d'adresse et de téléphone étaient déjà vides, et les exemples d'entraînement ne sont pas réinjectés. Restait `storeName`, qui retombait sur « Ma Boutique Mode » et `businessType` sur « Mode & Vêtements » : le bot annonçait donc à de vrais clients un nom de boutique et une activité inventés. Les deux sont désormais vides, et le prompt dit explicitement à l'IA de ne pas en inventer. Reste ouvert : le tri des données privées inutiles dans le prompt.
- [ ] **OpenRouter est une passerelle, pas un modèle.** Comparer fournisseurs/modèles avec conversations ivoiriennes anonymisées et autorisées : exactitude commerciale, coût texte/images/vocaux, latence, limites, confidentialité, secours. Aucun changement de fournisseur décidé, aucune promesse que ce sera meilleur.
- [ ] Tester négociation et confiance avec commerçants locaux ; pas de ton « ivoirien » caricatural ou de méthode unique présumée.

Cibles : `aiService.ts`, `salesEngine.ts`, `flowHandler.ts`, réglages et catalogue. Valider budget et politique de données avec Alex avant tout benchmark payant.

### 7. Données, interface et prise en main

- [ ] Journal de conversations durable distinct des 20 messages de contexte ; historique et pagination adaptés (les sessions actives sur 24 h ne sont pas l'ensemble des clients).
- [ ] Vrais états lu/non lu ; agrégats serveur au-delà des limites de lecture Supabase ; journal paiements/remboursements avant statistiques d'encaissement réel.
- [ ] Marketing : type de journal compatible schéma, erreurs visibles, segments n'assimilant pas commandes impayées à dépenses, opposition aux campagnes. Fonctions avancées secondaires au parcours de vente.
- [x] **Fait le 11 septembre — les cinq points.** Un refus HTTP à l'envoi ne produisait rien à l'écran (seule une coupure réseau montrait quelque chose) : il affiche maintenant une erreur et conserve le texte. Le sondage écrivait `setMessages` sans vérifier ni le statut ni la forme de la réponse, donc un objet d'erreur remplaçait la liste. Une réponse arrivée après un changement de conversation écrasait celle qu'on regardait : la conversation affichée est désormais comparée avant affichage, et la liste est vidée au changement au lieu de laisser les messages du client précédent sous le nom du nouveau. Le défilement automatique ne s'applique plus que si le vendeur était déjà en bas — sinon un rafraîchissement toutes les 8 secondes le ramenait de force et rendait la lecture de l'historique impossible.
- [~] **Caches privés isolés le 12 septembre ; le reste de la ligne est ouvert.** La synthèse d'identité générée par l'IA était stockée sous la clé globale `aiSummary` et n'était pas effacée à la déconnexion : sur un téléphone partagé, le vendeur suivant retrouvait la description de la boutique du précédent — produits, ton, politique commerciale. La clé est désormais préfixée par l'identifiant de la boutique, et la déconnexion efface tous les caches portant ce préfixe. Restent ouverts : unifier l'édition produit et compte, supprimer les commandes visuelles inactives, la sauvegarde effective du profil, la mise à jour du contexte utilisateur, la cohérence des champs optionnels.
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

- [x] **Clignotement des chiffres toutes les 15 secondes (régression du quatrième lot).** Corrigé le 11 septembre : `Today.tsx` et `Overview.tsx` accumulent le résultat dans une variable locale et n'appellent `setOrdersAvailable` qu'une fois, après lecture de la réponse. Plus de rendu intermédiaire « — ».
- [x] **`updateOrderStatus` : erreur affichée alors que l'annulation a eu lieu.** Corrigé le 11 septembre : l'ajustement de stock et l'écriture du journal sont dans leurs propres `try/catch` après l'écriture du statut. Un échec de remise en stock produit un journal d'avertissement destiné au vendeur au lieu de faire échouer la route. Reste ouvert : la remise en stock elle-même n'est toujours pas atomique (priorité 1).
- [x] **Ancien socket WhatsApp non fermé.** Corrigé le 11 septembre : `createSession` appelle `end()` sur le socket remplacé, et l'écoute `messages.upsert` porte la même garde que `connection.update` (le socket qui n'est plus celui de la session ne traite plus rien). Le reste de la priorité 5 (sérialisation des connexions concurrentes, déduplication persistante) demeure ouvert.
- [ ] **Correspondance produit plus stricte à éprouver.** Le nouveau `findProduct` exige que tous les mots correspondent, pluriel simple toléré ; les mots d'une lettre comptent désormais. Attendu, mais à mesurer sur de vraies conversations avant d'en faire une règle définitive : le bot demandera plus souvent de préciser.

Nuance sur `audit/offline-probes.cjs` : ses dix sondes ont été remplacées par des tests de régression et n'exécutent plus rien. Son « 0 constat reproduit » ne doit pas être cité comme une vérification indépendante des corrections.

## Session du 12 septembre — ce qui a été corrigé, et ce que ça ne prouve pas

Quinze commits sur la branche `claude/dois-commiter-3h9adk`. Les cases concernées
ci-dessus sont annotées individuellement : `[x]` pour fait, `[~]` pour
partiellement fait avec le reste explicité. Rien n'a été déployé, aucune
migration n'a été appliquée, aucun accès distant n'a eu lieu.

**Vérifications à la fin de la session** : 114 tests backend (contre 83), TypeScript
backend, ESLint frontend sans erreur pour la première fois, build frontend,
`git diff --check`. Alertes de dépendances : backend 25 → 9 (aucune critique ni
haute), frontend 18 → 0.

**Ce que ces vérifications ne prouvent pas.** Aucun test ne touche une vraie base,
une vraie connexion WhatsApp, une vraie clé IA, Firebase, Resend ou Paystack. Les
corrections de paiement sont validées par des tests à dépendances remplacées, pas
par un paiement réel. Aucune recette visuelle n'a été faite.

**Deux points demandent une action humaine avant la remise en ligne :**

1. **Appliquer `database/migrations/add_order_idempotency_key.sql`** dans Supabase.
   Sans elle, la protection anti-doublon de commande est INACTIVE : le code
   détecte la colonne absente, journalise un avertissement une fois, et crée la
   commande comme avant. La même remarque vaut toujours pour
   `add_adjust_stock_rpc.sql`, jamais appliquée.
2. **Vérifier Baileys manuellement.** Il est passé de rc.9 à rc14 dans la plage
   déjà déclarée. Jumelage, réception d'un message, envoi d'une image : à
   éprouver sur un vrai numéro avant d'ouvrir aux vendeurs.

**Vérifier aussi que `NODE_ENV=production` est bien positionné sur le VPS.** Deux
protections en dépendent désormais : le refus des origines CORS locales, et
l'interdiction des réponses IA factices. Sans cette variable, les deux restent
en mode permissif.

**Ce qui reste le plus gros trou de la priorité 1** : la transaction durable
commande + stock + état n'existe toujours pas. La clé d'idempotence empêche le
doublon, mais un arrêt entre le décrément du stock et la création de la commande
laisse encore un écart que seule une compensation, faillible, rattrape.

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
