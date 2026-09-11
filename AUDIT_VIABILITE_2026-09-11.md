# DjassaBot : audit consolidé de viabilité et de prise en main

> Cinquième lot local : simulateur isolé du stockage conversationnel réel, reset limité au test et erreurs visibles. 83 tests passent ; pas de nettoyage des anciennes simulations déjà enregistrées ni de recette réelle. Voir VIABILITE.md.

> Quatrième lot local : statistiques hors annulations, libellés distinguant commandes et encaissements, calculs journaliers/hebdomadaires cohérents et indisponibilité de lecture visible. 79 tests passent. Les dix reproductions historiques ont des tests de correction ; la totalité de l'audit n'est pas close. Voir VIABILITE.md.

> Troisième lot local : montants abrégés corrigés, quantités entières exigées, produit ambigu non sélectionné arbitrairement et clarification sans ajout partiel. 71 tests passent ; les parcours complexes, transactions et validations réelles restent à compléter. Voir VIABILITE.md.

> Deuxième lot local : liste blanche produit, erreurs de stock explicites, panier fermé avant notification et effacement `null` en base. 63 tests passent. Cela réduit les risques reproduits sans résoudre l'atomicité globale, les écritures incertaines ou la reprise durable des notifications. État courant détaillé dans VIABILITE.md.

> Suivi après autorisation de développement : un premier lot corrige localement le téléphone, les résultats email, l'exclusion des groupes, la pause des médias et le blocage de reconnexion reproduit. 52 tests passent. Voir `VIABILITE.md` pour l'état courant ; les constats ci-dessous décrivent la base auditée avant ces corrections. Aucun déploiement dans ce lot.

11 septembre 2026. Base locale examinée : `308ed0e`. Ce document complète et remplace la synthèse préliminaire `AUDIT_GLOBAL_2026-09-10.md`. Il ne certifie ni l'état actuel de GitHub ni celui du serveur arrêté.

## 1. Décision proposée à Alex

**Garder le principe du produit et sa base technique, mais ne pas encore le considérer prêt pour des clients payants.** Le problème n'est pas seulement le style, ni le choix de Gemini. Plusieurs passages entre conversation, commande, stock, paiement et livraison ne sont pas assez fiables. Une réponse agréable peut cacher une action non enregistrée ou un total mal compris.

La bonne promesse reste : « Tu renseignes tes produits et tes règles une fois ; le bot répond aux questions répétitives et te remet des commandes exploitables. » Il faut mesurer le travail réellement évité, pas seulement le nombre de réponses automatiques. Le vendeur doit pouvoir rester dans WhatsApp pour certaines actions, notamment transmettre une livraison, sans devoir administrer un logiciel complexe.

Je recommande trois étapes, à valider avant développement : fiabiliser les transactions et les états ; simplifier le fonctionnement et les parcours ; appliquer ensuite la refonte graphique complète. Il n'est pas nécessaire de payer le VPS pour commencer les deux premières étapes en environnement isolé.

## 2. Ce qui a effectivement été vérifié

| Domaine | Vérification réalisée | Limite restante |
|---|---|---|
| WhatsApp et IA | Lecture des gestionnaires, sessions, moteur de vente, notifications, relances ; simulations isolées | Pas de numéro connecté, pas de réponse IA réelle ni de reprise réseau réelle |
| Commandes, stock, catalogue | Lecture des routes, services et formulaires ; erreurs de persistance simulées | Concurrence et contraintes de la base réelle non testées |
| Authentification et abonnements | Parcours front/serveur, réponses d'erreur, webhooks et documentation prestataires | Configuration Firebase, Resend et Paystack distante inconnue |
| Interface | Analyse du code des écrans, navigation, formulaires, états et construction de production | Pas de recette visuelle complète sur téléphones ou lecteur d'écran |
| Données et exploitation | Schémas SQL fournis, scripts, configuration et dépendances | Migrations appliquées, sauvegardes restaurables, charge VPS et RLS réelles inconnues |
| Distribution | Configuration PWA et présence des projets natifs | Pas de compilation Xcode/Android ni validation des retours de paiement natifs |

L'audit porte sur les parcours et surfaces identifiés du dépôt, pas sur chaque ligne des bibliothèques tierces. Aucun serveur applicatif connecté aux identifiants locaux n'a été lancé. Aucun message WhatsApp, paiement, appel IA payant, changement distant ou redémarrage du VPS n'a été effectué.

### Résultats locaux

- Tests backend existants : **35 réussis**. Ils couvrent surtout le moteur de vente et certaines régressions ; ils ne constituent pas une recette complète.
- Contrôle TypeScript backend : réussi. Le script nommé `lint` est ici `tsc --noEmit`, pas un audit stylistique.
- Construction frontend : réussie. Pré-cache PWA : 36 entrées, environ 1 054 Kio ; cela ne rend pas les commandes utilisables hors connexion.
- Lint frontend : trois erreurs `no-explicit-any`, dans Login, Orders et Signup. Une compilation réussie ne signifie donc pas que tous les contrôles passent.
- **10 comportements problématiques reproduits** par `audit/offline-probes.cjs`, sans réseau ni base réelle. Les assertions décrivent les défauts actuels : leur réussite ne signifie pas qu'ils sont corrigés.
- Instantanés de dépendances dans `audit/backend-dependencies.json` et `audit/frontend-dependencies.json` : 24 entrées backend affectées, dont 3 critiques ; 10 frontend, dont 2 critiques. Ce ne sont pas 34 attaques distinctes prouvées. Les dépendances transitives et leur accessibilité réelle doivent être triées.

Les dix reproductions concernent : montant `12.5k` mal interprété ; produit ambigu sélectionné ; reconnexion bloquée ; message de groupe traité ; transcription malgré pause ; erreur email annoncée comme succès ; commande annulée comptée en revenus ; champ propriétaire accepté dans la modification d'un produit ; erreur stock retournée comme succès ; commande créée dont la confirmation échoue et dont le panier reste revalidable.

## 3. Constats prioritaires

Niveaux : **P0**, blocage d'un parcours essentiel ; **P1**, risque majeur avant ouverture payante ; **P2**, fonctionnement ou efficacité à améliorer. Preuves : **R**, reproduit isolément ; **C**, constat de code ; **D**, documentation officielle. Une hypothèse d'effet en production reste explicitement conditionnelle.

### A. Accès et confiance

**A1 · P0 · C : téléphone transformé en numéro invalide à l'inscription.** `frontend/src/pages/Signup.tsx:72` retire le zéro initial puis ajoute +225. `backend/src/controllers/authController.ts:26` exige dix chiffres après +225. Une saisie locale de dix chiffres commençant par zéro devient incompatible avec cette validation. L'onboarding applique également cette suppression (`Onboarding.tsx:81`). Unifier la normalisation et tester le même numéro de bout en bout, sans envoyer de SMS. Ne pas déclarer l'inscription fiable sur la seule base d'un ancien test.

**A2 · P1 · R/D : « email envoyé » peut être faux.** `backend/src/services/resendService.ts` ne vérifie pas le champ `error` renvoyé par le SDK avant de retourner un succès. Le test reproduit un rejet annoncé réussi. Vérifier le résultat, permettre de réessayer et ne pas consommer un parcours sur une fausse confirmation. Le domaine d'essai Resend a aussi des restrictions de destinataires ; sa configuration réelle reste à vérifier. Sources : [réponse du SDK](https://resend.com/docs/api-reference/emails/send-email), [restriction du domaine de test](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

**A3 · P1 · C : récupération et autorisations à durcir.** Dans `authController.ts`, la réinitialisation peut poursuivre après un résultat nul de mise à jour utilisateur. Les jetons et changements critiques doivent être invalidés/enregistrés atomiquement, avec erreur visible. Le middleware JWT ne réévalue pas systématiquement les rôles et suspensions ; définir les actions réservées au propriétaire et l'effet d'une suspension sur un jeton déjà émis. Ce constat ne prouve pas un accès arbitraire au compte d'autrui.

**A4 · P2 · C : profil modifiable sans sauvegarde effective.** `UserProfileModal.tsx:239` affiche un bouton Sauvegarder sans action associée. Réglages propose un autre formulaire, qui envoie aussi des champs facultatifs vides susceptibles d'être refusés. Conserver un seul parcours de compte, avec validation cohérente, état enregistré et rafraîchissement des informations affichées. Nettoyer à la déconnexion les caches locaux non rattachés au commerçant, notamment le résumé IA.

### B. WhatsApp et continuité de service

**B1 · P1 · R : une reconnexion peut ne jamais recréer la connexion.** Dans `services/whatsapp/sessionManager.ts`, la fermeture ne quitte pas nécessairement l'état `connected`, alors que `createSession` retourne immédiatement si cet état existe. Le test ouvre, ferme puis déclenche la tentative : aucun nouveau socket n'est créé. Séparer état observé, intention de connexion et tentative en cours ; tester fermeture, redémarrage, déconnexion volontaire et doubles demandes. Le watchdog ne suffit pas à prouver la reprise.

**B2 · P1 · C : reprise des messages fondée sur l'âge.** Le gestionnaire ignore les messages de plus de 60 secondes et traite ceux dépassant 10 secondes comme historique. Un retard réseau n'est pas un doublon. Enregistrer les identifiants traités et définir une reprise contrôlée, sans répondre aveuglément à tout l'historique. Le GET de statut WhatsApp peut lui-même créer une session : consulter l'état ne devrait pas déclencher une connexion implicite.

**B3 · P1 · R : groupes non exclus.** `messageHandler.ts` filtre le statut broadcast, pas les groupes. Le test fait passer un message `@g.us` dans le parcours de vente. Par défaut, limiter la vente aux discussions individuelles ; garder l'identité WhatsApp distincte du numéro de livraison. Les groupes et identifiants modernes ne doivent pas être convertis arbitrairement en numéros.

**B4 · P1 · R/C : pause et limites de consommation incomplètes.** La transcription vocale précède la vérification de pause ; l'analyse d'image possède aussi un chemin non couvert par cette pause. L'import des médias manque de limites explicites de durée/taille à ce niveau. Mettre les contrôles d'autorisation et de budget avant les appels coûteux. Prévoir un message récupérable si un vocal échoue, plutôt qu'un silence ou une disparition de l'échange.

**B5 · P1 · R : commande créée mais panier encore validable après échec d'envoi.** `flowHandler.ts` crée la commande puis attend la confirmation WhatsApp avant de vider la session. Si l'envoi échoue, la commande existe mais le panier reste actif. Une nouvelle validation présente donc un risque de doublon et de deuxième mouvement de stock. Utiliser une clé de validation unique et une file durable de notifications à envoyer ; une panne de messagerie ne doit pas rejouer l'achat.

**B6 · P1 · C : mémoire courte utilisée comme historique commercial.** `sessionService.ts` limite l'historique enregistré à vingt messages ; certaines listes/audiences ne partent que des sessions récentes sur vingt-quatre heures. Séparer le journal des échanges de la mémoire courte transmise au modèle. Paginer par commerçant, conserver l'état de lecture et éviter les écrasements entre réponse automatique, reprise manuelle et relance.

### C. Vente, catalogue et négociation

**C1 · P1 · R : modification de produit sans liste blanche suffisante.** `dbService.updateProduct` transmet des propriétés arbitraires dont `tenant_id`. Le test montre qu'une requête sur un produit du vendeur peut transporter un changement de propriétaire. Une contrainte distante pourrait le bloquer, mais n'a pas été vérifiée. Autoriser seulement les champs métier attendus, refuser les identifiants et filtrer chaque opération par commerçant. La clé service_role peut contourner RLS : les contrôles serveur restent indispensables. [Documentation Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

**C2 · P1 · R/C : stock et commande non atomiques.** Une erreur d'écriture de stock peut retourner `ok: true`. Les changements de statut et mouvements de stock se font séparément, avec des compensations qui ne garantissent pas une transaction globale. Unifier création, réservation, libération et transitions autorisées. Tester deux clients sur le dernier article, une panne au deuxième article et deux annulations concurrentes. Une annulation après expédition ne signifie pas que l'article est physiquement revenu.

**C3 · P1 · R : compréhension ambiguë transformée en action.** `salesEngine.ts` choisit la première robe parmi plusieurs et interprète `12.5k` comme 125000. Les garde-fous de prix limitent certains effets mais ne corrigent pas l'intention. Demander une précision quand l'article n'est pas unique ; utiliser des montants structurés validés. Préserver les réponses aux messages cités, photos et statuts pour traiter « celui-là » sans deviner.

**C4 · P2 · C : catalogue et variantes incohérents entre écrans.** Le prix minimum existe dans le moteur sans champ marchand simple. Les chemins de lecture ne restituent pas tous `manageStock` de la même façon. Deux éditeurs produits divergent ; le formulaire détaillé retransmet des données issues de la lecture qui ne sont pas nécessairement des colonnes modifiables. Le stock additionné entre tailles et couleurs peut compter plusieurs fois la même unité. Un seul contrat produit, un seul éditeur et des combinaisons réellement vendables sont préférables.

**C5 · P1 · C : exemples fictifs susceptibles de devenir des règles réelles.** `frontend/src/pages/Settings.tsx:102` contient des exemples commerciaux par défaut. Quand le serveur renvoie une liste vide, ils sont conservés, puis peuvent être sauvegardés avec la configuration. Le bot risque alors de recevoir des tarifs ou renseignements que le vendeur n'a pas fournis. Distinguer exemples d'aide et données actives ; bloquer une sauvegarde de configuration non chargée. Le simulateur doit annoncer s'il teste la version sauvegardée ou les changements en cours.

**C6 · P2 · C : stratégie commerciale à formaliser.** Le prompt, les balises textuelles et les heuristiques font encore trop de travail métier. La correction antérieure d'une contradiction de prix est utile mais ne complète pas la négociation. Définir une offre mémorisée par article/panier, un prix plancher explicite, les concessions autorisées et une confirmation du total livré. Séparer objection de prix, demande de lot, frais de livraison et manque de confiance. Ne pas supposer qu'une formule de langage locale suffit à conclure une vente.

**C7 · P1 · C : simulateur insuffisamment séparé du réel.** `routes/aiRoutes.ts` utilise les services de session réels, même avec un mode sans création de commande. Isoler le stockage et imposer des identifiants de simulation ; aucune simulation ne doit apparaître dans les relances ou écraser une vraie discussion. Sans clé IA, une réponse de démonstration ne doit jamais tenir lieu de réponse de production.

### D. Paiement, livraison et après-vente

**D1 · P1 · C : confirmation Paystack insuffisamment rapprochée.** Les routes acceptent des montants et métadonnées sans toujours recalculer depuis la commande ; le traitement de confirmation doit comparer commerçant, référence, montant, devise et état attendu. Ajouter unicité des références et répétition sans effet supplémentaire. Les retours navigateur doivent correspondre à des pages existantes et vérifier côté serveur ; une redirection n'est pas une preuve de paiement.

**D2 · P1 · C/D : promesse d'abonnement Mobile Money à revoir.** L'interface annonce Wave, Orange Money et MTN, mais le chemin utilise un plan récurrent Paystack. La documentation décrit les abonnements récurrents par carte et prélèvement bancaire au Nigeria, pas un abonnement récurrent Mobile Money général. Décision proposée : renouvellement manuel Mobile Money d'un côté, renouvellement automatique par carte de l'autre, si disponibles pour le compte ivoirien. Ne pas changer ce modèle sans Alex. [Abonnements Paystack](https://paystack.com/docs/payments/subscriptions/), [canaux de paiement](https://paystack.com/docs/payments/payment-channels/).

**D3 · P1 · C : droits payés et forfait affiché peuvent diverger.** Le webhook crée un abonnement, tandis que certaines limites lisent encore le forfait porté par le commerçant. Les notifications répétées, échéances, annulations et renouvellements ne forment pas un mécanisme unique. Éliminer aussi le repli `user@example.com` pour les comptes sans email. Définir une source unique de droits ; conserver l'accès aux anciennes commandes lorsque l'automatisation est suspendue.

**D4 · P1 · C : paiement et livraison confondus.** `Orders.tsx:18` présente SHIPPING comme PAID. À `:159`, le partage livreur n'est proposé que pour l'état payé. Cela contraint inutilement une commande à encaisser à la livraison. Séparer paiement et exécution logistique, avec des actions autorisées selon chacun des deux états. Le lien de paiement existant côté serveur ne constitue pas à lui seul un parcours client intégré.

**D5 · P1 · C : deux fiches livreur, aucune source unique.** Le récapitulatif backend et le partage frontend sont générés séparément. L'un peut demander le total sans tenir compte de ce qui est déjà payé ; l'autre réutilise un identifiant WhatsApp technique. Une livraison gratuite peut aussi être présentée comme non incluse faute de ligne de frais. Générer une fiche depuis la commande persistée, pas depuis le texte du bot.

Contenu minimal proposé : référence ; nom et téléphone joignable ; commune/quartier, repère et position si fournie ; articles/variantes/quantités ; créneau convenu ; frais de livraison ; déjà payé ; **reste exact à encaisser** ; contact du vendeur. Montrer les informations manquantes avant le partage. N'inclure ni prix plancher, ni historique privé, ni capture de paiement inutile. Prévoir Copier et Partager, sans envoi automatique à un livreur non choisi.

**D6 · P1 · C : exceptions après commande insuffisamment organisées.** Un reçu non rapproché peut annoncer une vérification sans créer une tâche marchande durable. Livraison échouée, client absent, annulation après paiement, retour physique et remboursement ne disposent pas d'un parcours complet. Une capture ne prouve pas l'encaissement ; garder une vérification explicite et un registre des références utilisées. Ajouter une petite file « À vérifier » plutôt qu'un système logistique complexe : motif, responsable, prochaine action, historique et montant concerné.

### E. Exploitation, données et qualité

**E1 · P1 · D : dépendances à traiter avant remise en ligne publique.** L'instantané d'audit signale notamment Baileys directement utilisé par le backend. L'avis officiel décrit une vulnérabilité critique et les versions corrigées. Planifier une mise à jour ciblée avec tests de connexion et de compatibilité, pas une mise à jour forcée globale. Aucune exploitation sur DjassaBot n'a été démontrée. [Avis du mainteneur](https://github.com/WhiskeySockets/Baileys/security/advisories/GHSA-qvv5-jq5g-4cgg).

**E2 · P1 · C : installation de base non reproductible de façon démontrée.** Les schémas et migrations fournis divergent : valeurs autorisées d'abonnement, tables d'authentification, champs de paiement et types de journaux. Le type `campaign` utilisé pour les statistiques n'est pas accepté dans le schéma complet fourni. La migration RLS supprime largement des politiques existantes : ne pas l'appliquer sans inventaire, surtout si le projet Supabase contient d'autres applications. Construire une base vide de test à partir d'un ordre de migrations vérifié, puis comparer au réel en lecture seule.

**E3 · P1 · C/D : sauvegarde et panne totale insuffisamment garanties.** Un backup WhatsApp sur le même VPS ne couvre pas sa perte. Une alerte exécutée sur un serveur éteint ne peut pas signaler son arrêt. La checklist historique affirme à tort sept jours de sauvegarde sur Supabase gratuit : les sauvegardes quotidiennes documentées concernent les offres payantes, le gratuit nécessite notamment des exports organisés. Les sauvegardes de base ne sauvegardent pas les fichiers Storage. Prévoir copies hors serveur, restauration testée et surveillance extérieure. [Sauvegardes Supabase](https://supabase.com/docs/guides/platform/backups).

**E4 · P1 · R/C : statistiques et erreurs peuvent rassurer à tort.** `overviewMetrics.ts` inclut une commande annulée dans les revenus, reproduit avec une commande de 10 000 F. Des lectures défaillantes deviennent aussi des listes vides. Distinguer montant des commandes, montant encaissé, livraison et remboursements ; utiliser la date de l'événement adéquat. Afficher « indisponible » plutôt que zéro quand la source échoue.

**E5 · P2 · C : coûts et performances non mesurés par vendeur.** Un message image peut entraîner plusieurs appels IA, un vocal une transcription puis une réponse. Pas de budget fiable par commerçant ni de mesure du coût complet. Les lectures périodiques, scans de sessions et médias non optimisés augmentent la charge. Instrumenter appels, volumes, latence, erreurs, files et coût ; paginer avant d'ajouter du matériel. Les anciennes estimations de capacité VPS et de coût Gemini ne sont pas des mesures.

**E6 · P1 · C : frontière test/production à rendre explicite.** Une configuration frontend de secours peut viser l'API réelle, et démarrer le backend peut lancer connexions et tâches automatiques. Fournir un mode local sans identifiants réels et un environnement de recette séparé. Ne pas compter sur le simple mot « preview » pour empêcher les effets réels.

**E7 · P2 · C : promesses de support et conservation à aligner.** Les pages légales promettent des capacités de suppression/conservation qui ne correspondent pas encore à un parcours complet identifié. Vérifier l'adresse de support, la procédure d'export/suppression et les tâches de purge avant de les promettre. C'est une incohérence produit à résoudre ; ce rapport n'est pas une validation juridique.

## 4. Interface : simplifier avant de redécorer

Contexte : commerçant peu technicien, surtout sur téléphone, parfois pressé et sur connexion instable. La priorité est de comprendre l'état du travail et l'action suivante. La charte noire et verte demandée par Alex reste la référence ; cet audit ne propose pas de la remplacer.

### Diagnostic de qualité, provisoire et fondé sur le code

Le verdict visuel « ressemble à une interface générée » reste non évalué sans recette des écrans. Les risques identifiés sont plus concrets : composants et formulaires redondants, couleurs codées en dur, contrôles qui ne donnent pas le résultat attendu. La nouvelle landing ne prouve pas la qualité de l'application authentifiée.

| Dimension | Note provisoire /4 | Élément déterminant |
|---|---:|---|
| Accessibilité | 1 | Formulaires sans association systématique label/champ, fenêtres sans gestion complète de focus, actions portées par des éléments non clavier |
| Performance | 2 | Découpage des pages acquis ; pré-cache d'environ 1 Mio, médias et lectures répétées à optimiser |
| Responsive | 2 | Navigation mobile présente ; petites cibles, actions dépendant du survol, saisie du code de connexion à éprouver à 320 px |
| Cohérence des styles | 2 | Variables présentes mais beaucoup de valeurs locales et composants divergents |
| Anti-patterns | 2 | Duplication de formulaires et densité de réglages ; appréciation graphique complète non réalisée |
| Total indicatif | **9/20** | Lacunes importantes ; score heuristique, pas résultat Lighthouse ni certification WCAG |

**UI1 · P1 · Inbox.tsx:125 : envoi refusé silencieusement.** Le toast d'erreur est dans le `catch`, mais une réponse HTTP non réussie n'y entre pas : seul `if (res.ok)` est testé. Corriger l'affirmation précédente « erreur d'envoi visible » : c'est vrai pour une exception réseau, pas pour tout refus HTTP. Garder le texte, afficher l'échec et proposer une nouvelle tentative. Les lectures périodiques doivent aussi empêcher une réponse ancienne d'un chat de remplacer le chat nouvellement sélectionné.

**UI2 · P1 · UserProfileModal.tsx, Orders.tsx, formulaires : interaction accessible incomplète.** Associer labels et champs, rendre les cartes/actions activables au clavier, fournir nom des boutons icônes et gestion de focus/Escape des fenêtres. Contrôler les contrastes des petits textes et états désactivés. Tester au clavier et au lecteur d'écran avant toute affirmation WCAG.

**UI3 · P2 · Réglages/produits/connexion : mobile à éprouver.** Agrandir les petites cibles tactiles, ne pas cacher une suppression derrière le survol, tester clavier virtuel, zoom texte et écrans de 320 à 430 px. Vérifier particulièrement la rangée de caractères du code WhatsApp. Il s'agit d'un risque de mise en page identifié dans le code, pas d'un débordement observé sur un appareil.

**UI4 · P2 · index.css et écrans : composants et états communs.** Centraliser boutons, champs, erreurs, confirmations et couleurs sémantiques. Harmoniser le nouveau style sans ajouter d'animations décoratives qui ralentissent la gestion quotidienne. Respecter la réduction des animations au-delà des seules classes personnalisées.

### Organisation cible proposée, pas encore implémentée

| Destination | Question à laquelle elle répond | Changement principal |
|---|---|---|
| Accueil | « Mon bot fonctionne ? Que dois-je faire ? » | État réel, actions urgentes, prochaine étape ; chiffres ensuite |
| Messages | « Qui répond et où en est cette vente ? » | Conversation, article/panier/commande liés, reprise fiable et erreurs visibles |
| Commandes | « Que dois-je encaisser, préparer ou livrer ? » | Paiement distinct de livraison ; fiche partageable et traitement des problèmes |
| Produits | « Qu'est-ce que mon bot sait vendre ? » | Un seul éditeur, photo d'abord, minimum utile, variantes et prix plancher progressifs |
| Réglages | « Quelles règles ma boutique applique ? » | Boutique/livraison/paiement ; assistant ; connexion ; compte/abonnement |

Ne pas multiplier les nouvelles rubriques. Le marketing avancé peut attendre que l'historique, les audiences et le suivi des envois soient fiables. Les réglages de personnalité détaillés restent disponibles mais secondaires. Un vendeur doit pouvoir commencer sans rédiger un prompt ou remplir trente-cinq questions.

Onboarding proposé : identité et contact valides → connexion WhatsApp vérifiée → premier produit exploitable → règles communes livraison/paiement → test clairement séparé → activation explicite. Sauvegarder la progression ; ne pas annoncer « prêt » si une dépendance essentielle manque.

Acquis à préserver : navigation mobile déjà présente, chargement différé des pages, photo d'abord, contrôles métier serveur, reprise manuelle, pause par défaut et précaution récente sur les captures de paiement. La méthode Impeccable a guidé la distinction entre qualité visuelle, compréhension et fiabilité des interactions. Pour l'étape de refonte : `impeccable clarify` et `distill`, puis `harden`, `adapt`, `optimize`, enfin `polish`. Réexécuter l'audit après les modifications ; ces étapes peuvent être demandées séparément ou ensemble après validation du périmètre.

## 5. OpenRouter et stratégie IA

**OpenRouter mérite d'être testé, pas adopté par principe.** C'est une passerelle vers des modèles, pas un modèle qui remplace Gemini. On peut donc comparer Gemini direct, Gemini via une passerelle et d'autres modèles sur les mêmes cas. La passerelle peut simplifier le changement de fournisseur et le secours, mais ajoute une dépendance et des conditions de traitement des données.

La proposition est un adaptateur IA derrière une interface stable, avec délais maximums, journal des usages sans contenu sensible inutile, sorties structurées validées côté serveur et un modèle de secours explicitement testé. Le serveur reste responsable des prix, du stock, des droits, des paiements et des commandes. Si le fournisseur échoue, aucune vente inventée ni réponse de démonstration.

OpenRouter documente le routage, les paramètres requis et les restrictions de fournisseurs. Le secours ne garantit pas qu'un autre modèle comprend aussi bien les variantes, les reçus ou le français utilisé par les clients. Comparer également les coûts annexes et politiques de données, pas seulement un tarif par jeton. [Routage](https://openrouter.ai/docs/guides/routing/provider-selection), [secours](https://openrouter.ai/docs/guides/routing/model-fallbacks), [sorties structurées](https://openrouter.ai/docs/guides/features/structured-outputs), [tarification](https://openrouter.ai/pricing), [FAQ](https://openrouter.ai/docs/faq).

Jeu d'évaluation proposé : demandes courtes et répétitives, références ambiguës, notes vocales, photo inconnue, négociation de lot, refus de frais, changement de panier, rupture, paiement incertain et reprise après interruption. Utiliser des discussions réelles partagées avec autorisation, anonymisées. Les scénarios de livraison à domicile, repères de quartier et paiement à réception sont à valider avec les vendeurs ciblés ; ne pas les présenter comme des habitudes universelles de Côte d'Ivoire.

Mesures : exactitude article/variante/quantité ; aucune concession hors règle ; nombre de questions répétées ; commandes exploitables sans ressaisie ; interventions du vendeur ; latence ; coût total de la conversation incluant médias et reprises. Pas de budget ou de migration automatique sans accord d'Alex. Changer d'IA ne remplace pas le VPS qui héberge la connexion WhatsApp.

## 6. Plan de travail réaliste avec le budget actuel

### Lot 1 : sans VPS, rendre les défauts vérifiables puis corrigeables

Après autorisation de développer : réparer la normalisation du téléphone et les faux succès ; limiter les champs produits ; corriger reconnexion/groupes/pause ; isoler simulation et réel ; créer les tests de doublons et de concurrence. Mettre à niveau les dépendances à risque dans un changement dédié et testé. Aucun achat nécessaire pour la lecture et les tests isolés.

### Lot 2 : stabiliser le modèle commercial

Définir puis implémenter commande persistée, panier modifiable, confirmation du total, séparation paiement/livraison, références de paiement uniques et file de notifications. Unifier les droits d'abonnement et clarifier les moyens de renouvellement. Valider avec Alex les règles de réservation du stock, retour/remboursement et conservation des données.

### Lot 3 : simplifier la prise en main, puis refondre le style

Valider les cinq destinations et quelques parcours sur maquettes avant de refaire tous les écrans. Réutiliser des composants accessibles et les codes visuels appréciés sur la landing. Pas de statistiques fictives. Tester compréhension, erreur réseau, données vides, abonnement expiré et utilisation au téléphone.

### Lot 4 : remise en ligne contrôlée, quand le budget le permet

Vérifier les sauvegardes et réussir une restauration isolée ; inventorier les migrations et politiques RLS ; vérifier les secrets sans les exposer ; configurer la surveillance extérieure. Réactiver sur un périmètre de test explicitement choisi, avec une puce et des comptes autorisés. Un test de paiement réel reste une action à autoriser, pas une conséquence automatique de cet audit.

### Conditions avant clients payants

- Une inscription puis récupération de compte réussissent sans aide et sans fausse confirmation.
- Une coupure WhatsApp se rétablit ; aucun message n'est traité deux fois ; le vendeur voit l'état réel.
- Une validation répétée crée une seule commande et un seul mouvement de stock.
- Un refus d'écriture ou d'envoi reste visible et récupérable ; pas de succès fictif.
- Paiement incomplet, capture suspecte, webhook répété et annulation ne créent ni faux encaissement ni stock artificiel.
- Le vendeur peut partager une fiche correcte avec reste à encaisser, y compris pour paiement à réception.
- Deux comptes de test ne peuvent consulter ou déplacer les données l'un de l'autre.
- Sauvegarde restaurée, contrôle des dépendances et installation de base reproductible documentés.
- Un commerçant non guidé ajoute un produit, active le bot, traite une commande et retrouve une erreur. Mesurer ses difficultés plutôt que déclarer une durée cible atteinte sans observation.

## 7. État de livraison de cet audit

Rapport consolidé, tests diagnostiques et instantanés de dépendances disponibles localement. Le TODO officiel est mis à jour pour ne plus présenter les anciennes cases cochées comme une preuve actuelle. **Aucun correctif applicatif, commit ou push effectué dans cette étape.** Le serveur arrêté empêche la validation réelle des intégrations, pas l'identification des défauts ci-dessus. L'ouverture commerciale reste conditionnée aux corrections et à la recette, pas à la seule remise sous tension du VPS.
