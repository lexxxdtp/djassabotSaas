# DjassaBot — audit de viabilité du 14 septembre 2026

**Verdict : une véritable application existe, avec une base technique solide. Une bêta privée sur téléphone est envisageable dans trois jours sous conditions. Une ouverture payante avec ventes autonomes n'est pas prête aujourd'hui.** Réactiver le VPS est nécessaire, mais ne corrige pas les défauts de commande, de stock, de paiement et de stockage constatés ci-dessous.

L'objectif conseillé pour le 17 septembre est une expérimentation accompagnée avec 3 à 5 commerçants consentants. Si les corrections sur les commandes ne sont pas validées à temps, limiter l'essai aux réponses et à la préparation de ventes, avec validation humaine effective. Cela demande aussi un mode réellement imposé par le serveur : une simple consigne donnée à l'IA ne suffit pas.

## 1. Périmètre, preuves et limites

Audit de l'arbre de travail local autour du commit `a23d0d0`, incluant les modifications locales déjà présentes. Lecture du briefing et des documents de passation, puis des parcours React, routes Express, services métier, authentification, WhatsApp, IA, paiements, migrations et configuration mobile. Inspection Supabase **en lecture seule**, recherches dans les documentations officielles et exécution locale de contrôles isolés.

| Vérification | Résultat du jour | Ce que cela prouve |
|---|---|---|
| Tests backend existants | **127 réussis, 0 échoué, 0 ignoré** | Les scénarios couverts passent ; la couverture ne garantit pas les parcours réels |
| Vérification TypeScript backend | Réussie | Cohérence des types, pas disponibilité du serveur |
| Compilation frontend | Réussie | Une version web distribuable est produite |
| Lint frontend | Réussi | Contrôles statiques de l'interface |
| Reproductions supplémentaires | **12 défauts reproduits** | Comportements métier actuels avec dépendances simulées, sans clients réels |
| Audit npm des dépendances de production | Backend : **9 alertes modérées**, 0 élevée/critique ; frontend : **0** | État des avis npm pour les versions résolues au moment du contrôle |
| Interface locale | Connexion à 390 et 320 px ; première étape d'inscription à 320 px | Pas de débordement horizontal sur ces écrans ; champs observés à 16 px |
| Retour d'abonnement | `/dashboard/subscription/callback` mène à l'accueil | Le parcours de retour après paiement manque réellement dans le routeur |
| Base distante | Métadonnées, politiques et contraintes inspectées | État de la base active, sans modifier ses données |

Les reproductions sont dans [le script d'audit](/Users/alexvianneykoffi/Downloads/djassabotSaas/audit/current-probes-2026-09-14.cjs). Ses assertions **constatent les défauts**, ce ne sont pas 12 tests d'acceptation réussis. Pour les rejouer : `node audit/current-probes-2026-09-14.cjs`.

Preuves conservées : [résultat des 12 reproductions](/Users/alexvianneykoffi/Downloads/djassabotSaas/audit/current-probes-2026-09-14.log), [127 tests existants](/Users/alexvianneykoffi/Downloads/djassabotSaas/audit/backend-tests-2026-09-14.log), [métadonnées Supabase sans données clients](/Users/alexvianneykoffi/Downloads/djassabotSaas/audit/live-metadata-2026-09-14.json), [audit npm backend](/Users/alexvianneykoffi/Downloads/djassabotSaas/audit/backend-dependencies-2026-09-14.json), [audit npm frontend](/Users/alexvianneykoffi/Downloads/djassabotSaas/audit/frontend-dependencies-2026-09-14.json). Les neuf alertes backend concernent des chaînes de dépendances de Firebase/Google Cloud et node-cron autour de `uuid` ; neuf paquets signalés ne signifient pas neuf failles indépendantes exploitables dans DjassaBot. Prévoir une mise à jour testée, sans appliquer automatiquement une migration majeure. Les dépendances utilisées uniquement pour développer n'entrent pas dans ce relevé `--omit=dev`.

Non validés : connexion sur une vraie puce, qualité Gemini en conversations réelles, réception d'emails, paiements réels et reversements, démarrage/reprise du VPS, restauration d'une sauvegarde, installation physique iPhone/Android, compilation/signature Xcode, interface authentifiée avec le serveur actif et charge simultanée. Le backend n'a pas été démarré pendant l'audit afin de ne pas relancer les sessions WhatsApp et les tâches planifiées de production. Les erreurs d'ouverture des URLs publiques par l'outil de recherche ne constituent pas une mesure fiable de disponibilité.

Aucun message client, paiement, déploiement, changement de politique Supabase ou correctif applicatif effectué. Les travaux locaux antérieurs sont conservés. Les nouveaux fichiers servent uniquement à documenter et reproduire l'audit.

## 2. Ce qui est déjà construit

- Dashboard, catalogue, variantes, stock, commandes, paramètres de boutique, livraison, boîte de réception et reprise humaine existent.
- Le bot utilise réellement Gemini. Il sait traiter du texte, transcrire un vocal puis répondre, analyser une photo et présenter les produits. Ce n'est pas uniquement une collection de réponses fixes.
- Le serveur vérifie une partie des actions proposées par l'IA : références produit, prix minimum, disponibilité, annulation et déduplication de paiements. Ces protections sont utiles, mais incomplètes dans les transitions entre étapes.
- Une capture de reçu ne marque plus automatiquement une commande payée. C'est une correction importante déjà acquise.
- L'application web possède un manifeste installable, des icônes, un mode autonome et un cache de fichiers. Des projets Capacitor iOS/Android existent aussi.
- Les 11 tables publiques inspectées ont **RLS activé**. Les fonctions privilégiées du registre Paystack ne sont pas exécutables par les rôles anonymes/authentifiés dans l'état inspecté. Les notes historiques disant « RLS non appliqué » ne décrivent donc plus la situation actuelle.

## 3. Défauts prioritaires avant une vente autonome

**P0** : exposition à fermer avant toute ouverture. **P1** : défaut bloquant le parcours concerné avant de le confier à des utilisateurs. **P2** : amélioration nécessaire pour une utilisation durable. Les priorités ci-dessous expriment l'impact produit, pas un score de vulnérabilité normalisé.

### A01 — P0 — Les photos peuvent être ajoutées ou modifiées anonymement

**Observé dans la base active.** Les politiques `Public Upload` et `Public Update` de `storage.objects` s'appliquent au rôle `public` avec pour seule restriction `bucket_id = 'product-images'`. Le compartiment est public, sans restriction propre de taille ou de type de fichier. Un utilisateur anonyme peut donc passer par Storage et contourner l'authentification et la limite de 5 Mo du serveur ; les chemins de photos publiées sont connaissables.

Conséquences : remplacement de photos de catalogue et consommation abusive de stockage/transfert. Le caractère public de la **lecture** des photos est cohérent avec leur envoi aux clients ; ce sont les permissions d'écriture qui posent problème. Aucun fichier n'a été altéré pour démontrer le risque.

Correction : réserver l'écriture au backend autorisé, organiser les objets par commerçant, fixer types/tailles, puis prouver qu'une tentative anonyme d'ajout et de remplacement est refusée et qu'un commerçant ne peut modifier les objets d'un autre.

### A02 — P1 — Commande et stock ne sont pas une seule opération fiable

**Deux scénarios reproduits.** Deux annulations simultanées lisent toutes deux l'ancien statut et rendent deux fois le stock. Autre cas : l'insertion de commande réussit mais sa réponse réseau se perd ; le traitement remet alors le stock malgré l'existence de la commande. L'ajustement atomique d'un article ne rend pas atomique toute la vente.

Sources : [transition de statut](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/dbService.ts:470), [finalisation](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/whatsapp/flowHandler.ts:517).

Correction : opérations transactionnelles en base pour réservation/création et annulation, avec transition conditionnelle depuis le statut attendu et clé d'idempotence. En cas de réponse incertaine, retrouver l'opération avant toute compensation. Une réactivation ne doit pas réussir quand son stock ne peut être réservé. Validation attendue : une annulation, un seul réapprovisionnement ; une vente enregistrée, un seul débit.

### A03 — P1 — L'IA promet parfois un ajout que le panier ne reçoit pas

**Reproduit.** Après le premier choix, le bot attend l'adresse. Si le client demande « ajoute aussi le sac », la réponse de l'IA peut affirmer l'avoir ajouté alors que `allowDeals: false` empêche l'ajout réel. Le client et la commande n'ont plus le même panier. Le message invitant à envoyer les articles supplémentaires après les trois premiers rencontre aussi cette limite.

Source : [attente d'adresse et actions IA](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/whatsapp/flowHandler.ts:98).

Correction : permettre explicitement ajout/retrait/changement de quantité pendant la préparation, invalider l'ancien récapitulatif, puis générer la confirmation depuis le panier effectivement enregistré. Ne pas transmettre une promesse d'action qui n'a pas été exécutée.

### A04 — P1 — Adresse et livraison peuvent engager une commande incorrecte

**Trois comportements reproduits.** L'adresse déclenche directement commande et débit de stock, sans accord explicite sur le total avec livraison ; « Je ne suis pas à Cocody » est reconnu comme adresse ; le seuil de gratuité offre la livraison même hors de toute zone couverte. Hors zone sans gratuité, la finalisation peut aussi afficher un total alors que les frais restent inconnus.

Sources : [détection et tarif](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/whatsapp/salesEngine.ts:287), [finalisation du panier](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/whatsapp/flowHandler.ts:98).

Correction : vérifier d'abord la zone, demander une adresse exploitable, calculer les frais, présenter articles + quantités + livraison + total, puis attendre une confirmation explicite. Si le tarif est inconnu, passer au vendeur et conserver une demande à confirmer.

### A05 — P1 — Des variantes valides produisent un prix final négatif

**Reproduit.** Produit à 1 000 FCFA, deux ajustements de variante à −800 : validation acceptée, prix final −600. La validation vérifie que les ajustements sont numériques, mais pas la validité du prix résultant. Un changement ultérieur des prix/planchers du catalogue peut également laisser un ancien panier à revalider.

Sources : [validation produit](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/productValidation.ts:90), [application du supplément](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/whatsapp/flowHandler.ts:164).

Correction : contrôler prix final, plancher autorisé, devise/arrondi et quantité après sélection de toutes les variantes et à la confirmation ; ajouter les contraintes appropriées en base. Le prix minimum existe côté métier, mais n'est pas exposé comme champ dédié dans les éditeurs produit inspectés : le vendeur ne maîtrise pas encore toutes les limites promises.

### A06 — P1 — Des messages récents peuvent ne recevoir aucune réponse

**Chemin de code confirmé, à mesurer sur WhatsApp réel.** Les messages âgés de plus de 60 secondes sont ignorés ; au-delà de 10 secondes ils deviennent de l'historique sans réponse. Les messages d'un lot sont traités séquentiellement : le temps passé sur le premier peut faire vieillir les suivants au-delà du seuil. Une interruption ou une IA lente devient ainsi une perte de demandes.

Source : [réception WhatsApp](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/whatsapp/sessionManager.ts:198).

Correction : distinguer synchronisation d'historique et nouveaux messages par leur origine, utiliser une file persistante avec statut traité/échoué et reprise contrôlée. Mesurer la reconnexion après coupure et redémarrage avec les sessions existantes, y compris celles marquées déconnectées. Les délais d'envoi ne garantissent ni la réception ni l'absence de suspension WhatsApp.

### A07 — P1 — Les coûts IA ne sont pas plafonnés par commerçant

**Constat statique.** Pas de comptage exploitable des tokens/coûts, de quota métier par boutique, de plafond explicite de sortie/réflexion, ni de délai maximal applicatif autour des appels IA inspectés. Une inscription délivre un accès avant vérification ; l'interface permet « Vérifier plus tard ». Les limites de connexion et d'OTP ne constituent pas un plafond de consommation IA.

Sources : [service IA](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/aiService.ts:40), [accès](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/middleware/auth.ts:40), [vérification reportable](/Users/alexvianneykoffi/Downloads/djassabotSaas/frontend/src/pages/VerifyAccount.tsx:418).

Correction : bêta sur invitations imposées côté serveur, limite par boutique et globale, budget d'essai, délai maximal, traitement clair des erreurs fournisseur et mesure des usages texte/photo/vocal. Une alerte de facturation ne remplace pas un arrêt technique effectif. Vérifier aussi le comportement d'autorisation lorsque les lectures de compte/abonnement échouent : plusieurs fonctions retournent `null` et le middleware laisse passer un abonnement absent.

## 4. Paiements et abonnement : avant de faire payer le service

### A08 — P1 — Un paiement Pro ne met pas à jour le forfait utilisé par le catalogue

**Reproduit.** Le webhook crée l'abonnement `pro`, mais ne synchronise pas `tenant.subscriptionTier`. La limite de 50 produits et certains affichages lisent ce second champ, initialisé à `starter`.

Sources : [activation d'abonnement](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/paystackService.ts:317), [limite produit](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/index.ts:297).

Correction : une source de vérité pour les droits du forfait, mise à jour cohérente et test « je paie Pro, j'ajoute le 51e produit ». Tester aussi renouvellement anticipé, expiration, rétrogradation et conservation des jours déjà payés.

### A09 — P1 — Les pages de retour de paiement n'existent pas

**Lecture et navigation locale concordantes.** Les liens pointent vers `/dashboard/subscription/callback` et `/order-confirmation`, absents du routeur. La première URL renvoie effectivement à la page de présentation. Le webhook peut avoir enregistré le paiement, mais le client n'obtient pas de confirmation exploitable.

Sources : [URL de retour](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/paystackService.ts:54), [routeur](/Users/alexvianneykoffi/Downloads/djassabotSaas/frontend/src/App.tsx:69).

Correction : écran vérifiant la référence côté serveur avec états en cours, payé, refusé et à reprendre ; jamais activer sur le seul paramètre d'URL. La colonne `tenants.paystack_subaccount_code` est aussi absente dans la base active alors que la création de sous-compte tente de l'enregistrer ; son échec peut être masqué. Corriger ce raccordement avant d'utiliser les liens de paiement des ventes.

### A10 — P1 — Un paiement tardif remplace un état de livraison

**Reproduit.** Une commande déjà livrée repasse `PAID` sur réception d'un événement de paiement. Une commande annulée peut également être réactivée par ce chemin, avec implications sur le stock.

Source : [traitement charge.success](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/paystackService.ts:340).

Correction : séparer état du paiement et état logistique ; définir les événements autorisés et orienter les paiements de commandes annulées vers un rapprochement humain/remboursement. Une référence unique évite le doublon d'événement, mais ne résout pas les transitions métier incorrectes.

### A11 — P1 — Le renouvellement Mobile Money ne correspond pas au parcours récurrent prévu

Le code utilise les plans d'abonnement Paystack. L'API Subscriptions documentée prend en charge la carte et le prélèvement bancaire au Nigeria, **pas le renouvellement automatique Mobile Money**. Ce point est déterminant pour les commerçants ivoiriens. [Documentation Paystack](https://paystack.com/docs/payments/subscriptions/).

Recommandation produit à faire valider par Alex : paiement Mobile Money ponctuel ouvrant/prolongeant un mois, avec rappel et renouvellement volontaire. Il faut adapter le paiement et l'expiration, pas seulement changer un libellé. Les clés live, plans, identité marchand et reversements restent à tester. Le code contient par ailleurs une commission de **2 %, minimum 100 FCFA**, sur les liens de paiement des ventes : décider explicitement si elle fait partie de l'offre mensuelle annoncée avant d'activer cette fonction. Elle n'est pas une preuve que des commissions ont déjà été prélevées.

### A12 — P1 — Le traitement humain des reçus n'est pas complet

La capture n'est plus une preuve automatique de paiement, ce qui est correct. Toutefois, certains cas annoncent une revue humaine sans alimenter systématiquement une alerte exploitable ; l'image est jetée après analyse et n'est pas consultable dans le dashboard. La recherche d'une référence déjà utilisée ne correspond pas au type/métadonnées des nouveaux journaux de reçu.

Source : [validation des reçus](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/paymentValidationService.ts).

Correction : file « reçu à vérifier », commande identifiée sans ambiguïté, référence normalisée, preuve consultable avec accès privé/durée limitée et décision tracée du vendeur. Une photo peut être falsifiée ; confirmer dans le compte du prestataire ou par événement vérifié. Le problème actuel ne réintroduit pas, à lui seul, un paiement automatique fondé sur l'image.

## 5. Dashboard, récupération de compte et exploitation

| Référence | Priorité et preuve | Défaut et correction attendue |
|---|---|---|
| A13 | P1, reproduit | L'envoi manuel transforme `123@lid` en `123@lid@s.whatsapp.net`. Préserver les identifiants WhatsApp valides et gérer leur correspondance avec le numéro. [chatRoutes:108](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/routes/chatRoutes.ts:108) |
| A14 | P1, reproduit | « Mot de passe oublié » annonce un email envoyé même si Resend refuse. La route `verify-phone-reset` crée un jeton mais n'envoie pas le SMS annoncé. Assurer une récupération réellement utilisable, avec réponse neutre pour éviter l'énumération, reprise et alerte interne d'échec. Les routes de demande d'email sont déjà limitées ; compléter la protection des autres routes sensibles. [authController:480](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/controllers/authController.ts:480) |
| A15 | P2, reproduit | Le 21e message supprime le premier : les 20 messages de contexte IA servent aussi d'historique vendeur. Conserver un journal de conversation paginé séparé du contexte envoyé à Gemini. [sessionService:111](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/sessionService.ts:111) |
| A16 | P2, statique | L'Inbox charge les sessions actives globalement puis filtre le commerçant en mémoire. Filtrer en base et paginer ; aucune fuite interboutique de réponse n'a été démontrée, mais la lecture globale et sa limite implicite deviennent problématiques à l'échelle. Le compteur non-lus est fixé à zéro. [chatRoutes:17](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/routes/chatRoutes.ts:17) |
| A17 | P2, base + code | Les campagnes insèrent `type='campaign'`, rejeté par la contrainte actuelle qui n'autorise que info/sale/warning/action. Le retour Supabase `error` n'est pas inspecté : statistiques incomplètes. Corriger le schéma ou le type et vérifier l'insertion ; ne pas lancer de campagnes pendant le premier pilote. [marketingRoutes:176](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/routes/marketingRoutes.ts:176) |
| A18 | P1 avant autonomie, statique | Plusieurs erreurs de lecture deviennent `null`, liste vide ou paramètres par défaut. L'utilisateur peut confondre panne et boutique vide ; une sauvegarde peut écraser ses paramètres avec des défauts. Distinguer absence de données et panne, refuser une vente quand ses règles ne sont pas fiables. [dbService:887](/Users/alexvianneykoffi/Downloads/djassabotSaas/backend/src/services/dbService.ts:887) |
| A19 | P2, statique | Progression d'onboarding non durable ; sauvegarde de personnalité ne vérifiant pas le statut HTTP ; premier produit avec stock vide ramené à zéro. Reprendre la configuration après fermeture et afficher les étapes réellement enregistrées. [Onboarding:130](/Users/alexvianneykoffi/Downloads/djassabotSaas/frontend/src/pages/Onboarding.tsx:130) |
| A20 | P2, statique | Paramètres métier insuffisamment validés côté serveur ; upload sans normalisation/compression ; formats de photos iPhone à vérifier. Ajouter un schéma de validation et un traitement des images, sans imposer au commerçant de connaître leurs formats. |
| A21 | P1 avant ouverture publique, statique | JWT valables sept jours sans révocation générale après changement de mot de passe ; vérification/consommation des jetons de récupération à rendre atomique, stockage à durcir. Signup composé d'écritures séparées pouvant laisser un compte partiel. Vérifier les pannes à chaque étape et permettre une reprise sûre. |
| A22 | P2, observé + statique | Document HTML déclaré en anglais, zoom interdit ; bouton d'affichage du mot de passe sans nom accessible sur l'écran observé. Passer en français, autoriser le zoom, nommer les contrôles. Les champs de connexion observés sont déjà à 16 px : ne pas attribuer à cet écran un défaut de police qu'il n'a pas. |
| A23 | P1 avant promesse de service, non validé distant | Le contrôle `/` indique seulement que le processus répond. Ajouter vérification de disponibilité DB/WhatsApp, supervision, journaux utiles sans secrets, rotation, reprise après redémarrage et sauvegarde/restauration testée. Le nombre de commerçants supportable par le VPS n'a pas été mesuré. |
| A24 | P2 avant offre publique, incohérence documentaire | Les pages légales promettent conservation des conversations, suppression de compte, support et fonctionnement d'abonnement qui ne sont pas tous démontrés par les parcours actuels. Aligner les textes sur les fonctions, préciser le traitement des vocaux/images et rendre le canal support réel. Ce constat porte sur la cohérence produit, pas sur une certification juridique. |

L'advisor Supabase signale aussi la découvrabilité de schémas GraphQL : cela ne prouve pas une exposition de lignes protégées. Ne pas confondre cette alerte avec les écritures anonymes Storage effectivement autorisées. L'absence de politiques sur les tables RLS peut être volontaire ici puisque le frontend utilise le backend et non un accès direct aux tables. Le backend utilisant `service_role`, les filtres de commerçant restent indispensables.

## 6. IA, abréviations, photos et vocaux

**Gemini 2.5 Flash constitue une base raisonnable pour le pilote. Sa qualité pour le nouchi, les abréviations et les vocaux bruyants de tes clients n'a pas été mesurée.** Changer de modèle ne corrigera pas le panier, le stock, les paiements ou les messages ignorés.

Le code fixe `gemini-2.5-flash` dans le service. Rendre le modèle configurable et migrer progressivement de l'ancien paquet `@google/generative-ai` vers `@google/genai`, recommandé et maintenu par Google. La bibliothèque ancienne n'est plus activement maintenue. [Bibliothèques officielles](https://ai.google.dev/gemini-api/docs/libraries).

Fonctions et limites observées :

- **Texte :** conversation générative avec catalogue/règles/contexte. Certaines instructions se contredisent : réduction de bienvenue par défaut et invitation à créer l'urgence malgré l'interdiction d'inventer des offres. Supprimer toute réduction/pénurie non validée par les données du vendeur ; produire les totaux depuis le serveur.
- **Vocal :** transcription jusqu'à 180 secondes puis réponse textuelle, soit généralement deux appels. Il n'y a pas de réponse vocale synthétisée. Le parcours demandé « comprendre un vocal et répondre » existe.
- **Photo :** classification de reçu, puis description visuelle et conversation selon le cas, jusqu'à environ trois appels. Le contexte visuel utilisé n'effectue pas une véritable comparaison avec toutes les photos du catalogue. Une robe ressemblante ne suffit pas à déterminer la bonne référence, taille ou prix : proposer des candidats et demander confirmation.
- **Contexte WhatsApp :** les messages cités, coordonnées de localisation et certaines enveloppes de médias ne sont pas normalisés dans les chemins inspectés. Tester « celui-là » en réponse à une ancienne photo et les formats réellement envoyés par les testeurs.
- **Reprise humaine :** prévoir un motif et une tâche visible quand l'IA doute, une réponse explicite au client, et un mécanisme de pause robuste même pendant une réponse en cours.

Avant de choisir Flash-Lite ou un autre modèle, constituer 50 conversations consenties/anonymisées : prix/stock, abréviations, négociation, changement d'avis, variantes, adresses, photos similaires, vocaux bruyants et fausses preuves de paiement. Comparer exactitude, demandes de clarification, latence, coût et charge de reprise vendeur. Objectif impératif du jeu de validation : aucun prix engagé hors règles, aucun paiement validé sur simple image, aucune commande engagée sans accord. Ce sont des critères proposés, pas des performances déjà atteintes.

## 7. Installation iPhone : chemin conseillé pour les trois jours

La **PWA**, application web installée depuis Safari, est le chemin le plus court avec ton budget. Le manifeste du projet ouvre `/dashboard` en mode autonome, avec icônes et cache. Sur iPhone : ouvrir l'adresse HTTPS, menu Partager, « Sur l'écran d'accueil », puis ouvrir comme application web lorsque cette option est proposée. [Guide Apple](https://support.apple.com/en-mide/guide/iphone/iphea86e5236/ios).

Cela permet une icône DjassaBot et une interface dédiée sans publication App Store. Le bot tourne sur le VPS : fermer l'application du commerçant ne doit pas arrêter ses réponses. L'interface installée a néanmoins besoin du réseau pour modifier produits et commandes ; le cache ne lui donne pas un fonctionnement métier hors ligne.

La compilation produit environ **1,04 Mio de fichiers précachés**. C'est raisonnable pour un premier chargement, mais les photos de catalogue, l'API et les mises à jour restent à mesurer en réseau mobile. Le paquet de graphiques est séparé et compressé à environ 99 Ko.

Les dossiers Capacitor ne prouvent pas qu'une application native est prête à distribuer : signature, build sur appareil, permissions, redirections de paiement et validation de distribution restent nécessaires. Android utilise une origine locale HTTPS à accorder avec CORS si cette voie est retenue. L'adhésion Apple Developer coûte **99 USD/an**, avec variations régionales ; elle n'est pas nécessaire à la PWA et n'est pas une dépense à engager pour cet essai. [Programme Apple](https://developer.apple.com/programs/enroll/).

Recette physique obligatoire : installation, reconnexion après fermeture, navigation au clavier, ajout d'une photo depuis l'appareil, code d'association WhatsApp sur le même téléphone, accès aux commandes, pause/reprise du bot, réseau coupé/rétabli et mise à jour de l'application. Les vues à 320/390 px ne remplacent pas cette recette.

## 8. Dépenses et viabilité économique

Les plans visibles sont **5 000 / 10 000 / 15 000 FCFA par mois**. Leur rentabilité n'est pas encore démontrée : aucun coût réel par commerçant ou temps de support par boutique n'a été mesuré.

| Poste | Pour le pilote | Décision conseillée |
|---|---|---|
| VPS Hostinger | Réactivation nécessaire ; montant réel du renouvellement non consulté | Réutiliser le serveur existant et mesurer sa capacité avant tout agrandissement |
| Gemini | Consommation distincte du quota Codex/ChatGPT | Définir un petit budget global accepté par Alex et un plafond technique ; mesurer les usages |
| Email Resend | Offre gratuite : 3 000 emails/mois, 100/jour | Suffisant pour quelques testeurs ; configurer un domaine expéditeur et tester réception/récupération. [Tarifs](https://resend.com/pricing) |
| Domaine | Achat seulement si aucun domaine adapté n'est déjà disponible | Réutiliser un domaine existant si possible. La vérification DNS est nécessaire pour l'expéditeur personnalisé. [Documentation Resend](https://resend.com/docs/dashboard/domains/introduction) |
| Supabase | Free : 500 Mo de base, 1 Go de stockage ; pause possible après inactivité | La base mesurée fait environ 13,4 Mo, ce qui ne mesure pas les photos ni le trafic. Pas de nécessité démontrée de passer immédiatement à Pro à 25 USD/mois. [Tarifs](https://supabase.com/pricing) |
| Hébergement frontend | Plan Vercel actuel non vérifié | Hobby est réservé à l'usage personnel non commercial. Pour le SaaS, vérifier l'offre ou servir le frontend statique sur le VPS déjà payé, avec configuration et maintenance correspondantes. [Conditions Hobby](https://vercel.com/docs/plans/hobby) |
| Encaissement Paystack CI | Mobile Money : 1,95 % hors taxes ; cartes locales : 3,2 %, internationales : 3,8 % | Frais variables à intégrer à la marge ; aucune dépense d'abonnement Paystack imposée par cette grille. [Tarification CI](https://paystack.com/ci/pricing) |
| Apple/App Store | Facultatif pour cet objectif | Reporter ; installer la PWA |
| SMS de connexion | Coût et activation dépendants de la configuration Firebase | Ne pas en faire une dépendance obligatoire du pilote tant que la récupération par email suffit réellement |

Pour Gemini 2.5 Flash, le tarif standard consulté est de **0,30 USD/million de tokens entrants texte/image/vidéo**, **1 USD pour l'audio**, et **2,50 USD/million de tokens sortants, réflexion comprise**. L'offre gratuite prévoit une utilisation des contenus pour améliorer les produits Google, contrairement à l'offre payante indiquée : en tenir compte avant d'y envoyer des conversations et reçus réels. [Tarifs et traitement des données](https://ai.google.dev/gemini-api/docs/pricing).

**Simulation, pas facture constatée :** 1 000 réponses × 5 000 tokens entrants + 300 tokens sortants facturés donnent 2,25 USD. 500 conversations de 10 réponses donnent 11,25 USD avec ces mêmes hypothèses. Davantage de réflexion, photos/vocaux, catalogue long ou relances augmente ce montant. Une conversation ne correspond donc pas à un seul message facturé. Aucun taux USD/FCFA non vérifié n'est utilisé ici.

Marge à mesurer : abonnement encaissé − frais de paiement − IA − part VPS/stockage/email − assistance − incidents. Les plans supérieurs proposent surtout catalogue et accompagnement ; ne pas annoncer une « IA plus avancée » sans différence effective. Le support VIP et la formation consomment aussi ton temps de développeur solo. Reporter le changement des prix jusqu'aux premiers relevés ; ne pas promettre un usage IA illimité sans règle commerciale et limite technique explicites.

## 9. Risque structurel WhatsApp

Baileys utilise le protocole WhatsApp Web et ne constitue pas une intégration officielle WhatsApp Business Platform. La connexion peut changer ou être restreinte ; les délais entre messages ne garantissent pas la protection du numéro. Les restrictions sur l'automatisation abusive et les envois non autorisés restent applicables. [Règles WhatsApp](https://www.whatsapp.com/legal/messaging-guidelines).

Pour le pilote : numéro dédié dont le propriétaire accepte le risque, conversations initiées par des testeurs consentants, campagnes désactivées, contrôle humain et procédure de déconnexion. Pour une activité durable : examiner l'intégration officielle, ses contraintes d'inscription, de numéro et ses tarifs réels avant de choisir une migration. Cet audit ne chiffre pas une migration Meta et ne suppose pas qu'elle soit indispensable à la démonstration dans trois jours. Le choix relève d'une décision produit à prendre avec Alex.

## 10. Plan de trois jours et décision de lancement

Ce calendrier est un ordre de travail, **pas une garantie que toutes les corrections tiendront en 72 heures**. Ne pas absorber ces trois jours dans une nouvelle refonte graphique.

| Période | Livrable concret | Condition de passage |
|---|---|---|
| Jour 1 | Fermer les écritures anonymes Storage ; préparer accès privé et plafond IA ; réactiver/configurer le VPS ; vérifier secrets, HTTPS, DB et sauvegarde ; traiter transactions de commande/stock | Photos protégées, backend réel accessible, restauration préparée ; aucun essai réel de vente avant correction des invariants |
| Jour 2 | Corriger panier modifiable, confirmation finale et livraison ; traiter prix de variantes, identifiants WhatsApp et reprise des messages ; tester texte/photo/vocal et pause humaine | Commandes, totaux et stock exacts dans les scénarios critiques ; récupération de compte fonctionnelle |
| Jour 3 | Installer la PWA sur iPhone et Android ; accompagner 3 à 5 commerçants sur catalogues simples ; relever erreurs, coût, délai et temps vendeur | Pilote privé seulement si les critères ci-dessous passent ; sinon essai de conversation sous contrôle humain sans vente autonome |

La facturation publique attend en plus A08–A12, un paiement réel autorisé et vérifié, ainsi qu'un parcours clair de renouvellement/arrêt. Une bêta gratuite permet de tester l'utilité sans demander au premier commerçant de payer pour un abonnement encore mal raccordé ; elle ne dispense pas de sécuriser ses données et ses commandes.

**Recette minimale avant ventes autonomes :**

1. Deux boutiques ne peuvent lire/modifier les produits, commandes, sessions ou photos l'une de l'autre ; un visiteur anonyme ne peut écrire de photo.
2. Le commerçant crée cinq produits avec photos, stock, variantes et règles ; ferme/réouvre l'application ; retrouve les données.
3. Une demande abrégée, un vocal et une photo obtiennent une réponse cohérente ou une clarification, jamais une référence inventée.
4. Ajout/retrait/changement de taille pendant l'adresse : panier et récapitulatif restent identiques.
5. Négociation et variantes respectent le prix minimum ; refus d'un prix négatif.
6. Zone inconnue, négation d'adresse et livraison gratuite : aucune promesse non calculée.
7. Le client approuve le total livraison comprise avant enregistrement définitif.
8. Deux clients prennent le dernier exemplaire : une seule vente acceptée ; répétition d'un message : pas de double commande.
9. Deux annulations simultanées : une seule remise en stock ; réponse réseau perdue : rapprochement sans fausse compensation.
10. Capture fausse, floue, dupliquée ou sans commande : pas de statut payé automatique et revue vendeur visible.
11. Le vendeur répond à un client identifié `@lid` et met réellement le bot en pause, y compris pendant un appel IA.
12. Coupure réseau, lenteur IA, redémarrage serveur : demandes nouvelles reprises ou incident visible, pas de silence inexpliqué.
13. Mot de passe oublié : lien reçu, utilisable une fois, reprise après erreur fournisseur.
14. Dépassement du budget pilote : arrêt contrôlé et information vendeur ; aucune facture incontrôlée.
15. Avant vente d'abonnements : paiement Starter/Pro/Business, retour vérifié, 51e produit Pro, renouvellement, doublon webhook et paiement tardif après livraison/annulation.

## 11. Décisions à prendre avec Alex après l'audit

Recommandations proposées, non appliquées : **PWA d'abord ; pilote privé accompagné ; paiements de clients supervisés ; renouvellement mensuel Mobile Money volontaire ; pas de commission sur les ventes sans décision explicite ; plafond de dépenses IA ; étude de la connexion officielle WhatsApp pour la suite.**

Le besoin métier est cohérent : diminuer les questions répétitives et organiser les commandes. La validation commerciale reste à obtenir auprès des commerçants : leur faire renseigner leur vrai catalogue, observer combien de réponses ils doivent corriger et mesurer le temps réellement gagné. Aujourd'hui, le principal travail porte sur la fiabilité entre les fonctions déjà présentes, pas sur l'ajout de nouveaux écrans.
