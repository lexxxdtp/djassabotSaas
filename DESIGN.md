# DjassaBot — Direction de design pour la refonte produit

> Référence officielle pour étendre à toute l'application l'identité appliquée à la page de garde. À lire avec `PRODUCT.md`, `PASSATION_AGENT.md` et `VIABILITE.md`. Ce document décrit une direction et un ordre de travail, pas une validation des parcours métier encore ouverts.

## 1. Intention

DjassaBot doit donner l'impression d'un **outil de commerce ivoirien solide, vivant et très simple**, pas d'un tableau de bord SaaS générique. La page de garde a installé une identité « commerce éditorial » : noir franc, vert-signature, typographie très contrastée, détails inspirés du téléphone et de la vente, messages directs. L'espace vendeur doit appartenir au même monde sans reprendre toute la mise en scène publicitaire.

**Scène d'usage :** une vendeuse consulte rapidement son téléphone dans une boutique ou un marché lumineux, entre deux clients. Elle veut savoir si son bot travaille, ce qui demande son attention et quoi faire ensuite. Le thème sombre est conservé parce qu'il constitue déjà l'identité choisie, mais textes, états et cibles tactiles doivent rester lisibles en plein jour.

La promesse visuelle à tenir : **« mon commerce continue, et je garde la main »**.

## 2. Deux registres, une seule marque

### Site public : éditorial et expressif

- Grandes accroches serrées, composition asymétrique, illustration téléphone, tickets et éléments de commerce.
- Vert utilisé en grandes surfaces à des moments précis : disque du hero, bandeau, appel final.
- Georgia italique uniquement pour une phrase émotionnelle ou une bascule de sens dans un grand titre.
- Animations lentes et décoratives possibles si elles sont désactivables et respectent `prefers-reduced-motion`.
- Source actuelle : `frontend/src/pages/LandingPage.tsx` et `frontend/src/styles/landing.css`.

### Application connectée : opérationnelle et calme

- Même noir, vert, vocabulaire, marque et caractère typographique.
- Hiérarchie nette, disposition prévisible, peu d'éléments décoratifs. L'information métier est prioritaire.
- Sans-serif uniquement dans boutons, formulaires, listes, chiffres et navigation. Georgia peut apparaître exceptionnellement dans un écran de bienvenue ou de réussite, jamais dans les données.
- Le vert sert l'action principale, l'élément sélectionné et l'état positif. Une page ne doit généralement avoir qu'une action primaire verte visible à la fois.
- Animations courtes uniquement pour expliquer un changement d'état. Pas de chorégraphie au chargement de chaque page.

## 3. Fondations visuelles

Les valeurs historiques imposées restent compatibles avec la landing. Centraliser ces valeurs dans des tokens avant la refonte, puis remplacer progressivement les couleurs dispersées. Ne pas changer l'identité sans accord d'Alex.

```css
:root {
  --color-canvas: #000000;
  --color-canvas-soft: #050605;
  --color-nav: #090a09;
  --color-surface: #111111;
  --color-surface-raised: #151816;
  --color-surface-active: #202420;
  --color-border: #1a1a1a;
  --color-border-strong: #343434;

  --color-text: #f6f5ef;
  --color-text-secondary: #c7cdc8;
  --color-text-muted: #888888;
  --color-text-faint: #666666;

  --color-accent: #00d97e;
  --color-accent-ink: #031c11;
  --color-accent-soft: rgba(0, 217, 126, 0.10);

  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-info: #60a5fa;

  --font-ui: "Avenir Next", "Helvetica Neue", Helvetica, system-ui, sans-serif;
  --font-editorial: Georgia, "Times New Roman", serif;

  --radius-control: 8px;
  --radius-panel: 13px;
  --radius-sheet: 24px;

  --duration-fast: 160ms;
  --duration-normal: 220ms;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
}
```

### Couleurs

- Fond principal `#000`; surfaces métier `#111`; séparation d'abord par espace et bordure, pas par ombres empilées.
- Vert `#00D97E` solide. **Aucun dégradé**, texte en dégradé ou halo vert permanent derrière les données.
- Les oranges/jaunes/rouges/bleus sont sémantiques uniquement. Éliminer les variantes décoratives non cohérentes, notamment les accents orange de certains réglages.
- Ne jamais coder la couleur seule : ajouter libellé, icône ou forme pour les statuts.
- Texte secondaire au moins `#888` sur noir ; éviter `#555` pour une information nécessaire, car il devient difficile à lire en extérieur.

### Typographie

- Police UI : Avenir Next si disponible, puis Helvetica Neue et système. Ne pas charger une police distante tant que poids, performance et droits ne sont pas décidés.
- Titre de page produit : 28 px bureau, 24 px mobile, poids 700, interlettrage serré entre `-0.02em` et `-0.04em`.
- Titre de section : 18 à 20 px, poids 650/700.
- Corps : 14 à 16 px, interligne 1.5 à 1.65. Aide : 12 à 13 px, jamais 8 à 10 px pour une information métier indispensable.
- Chiffres monétaires : chiffres tabulaires, `FCFA` toujours visible, séparateurs français. Distinguer « montant des commandes », « déjà payé » et « reste à encaisser ».
- Les petits labels en capitales espacées de la landing deviennent des **repères rares** dans l'app, par exemple `À FAIRE` ou `BOT WHATSAPP`, pas tous les titres.

### Espacement et structure

- Unité de base 4 px. Suite principale : 4, 8, 12, 16, 24, 32, 48.
- Mobile : marge latérale 16 px ; bureau : contenu 32 à 40 px, largeur maximale actuelle 1 440 px conservée seulement quand elle sert les listes.
- Utiliser l'espace libre, les séparateurs et la hiérarchie avant d'ajouter une carte. Éviter les cartes imbriquées.
- Cibles tactiles de 48 px recommandées, minimum absolu 44 px. Barre mobile compatible avec `safe-area-inset-bottom`.
- Rayons : 8 px pour boutons/segments, 12 à 14 px pour panneaux, 24 px uniquement pour bottom sheets. Réduire la coexistence actuelle de nombreux `rounded-xl`, `2xl`, `3xl` sans logique.

### Icônes et illustration

- Lucide reste la bibliothèque unique, trait 1.75 par défaut, 2.25 actif. Une icône d'action importante garde un libellé.
- La forme-logo est le carré vert avec coin inférieur gauche plus court, comme la landing. Employer le même `d.` ou `D` après décision, pas deux signatures concurrentes.
- Les tickets, bulles et visuels de téléphone sont des motifs de marque pour le marketing, l'onboarding, les confirmations de commande et les états vides. Ne pas les répéter dans chaque carte.

## 4. Composants communs obligatoires

Avant de refaire tous les écrans, construire une petite couche de composants partagés. Ne pas créer une bibliothèque abstraite énorme.

### Boutons

- **Primaire** : fond vert, texte `--color-accent-ink`, hauteur 48 à 52 px, rayon 8 px, libellé d'action précis : « Ajouter un produit », « Confirmer la commande ».
- **Secondaire** : fond transparent ou surface, bordure forte, texte clair.
- **Discret** : texte + icône, sans faux fond de carte.
- **Destructif** : rouge seulement pour l'action finale, confirmation explicite.
- États obligatoires : repos, survol si souris, focus visible 2 px vert, pressé `scale(.97)`, chargement avec libellé stable, désactivé lisible et non cliquable.
- Une seule action primaire dominante par zone. Boutons icône seuls réservés aux actions universelles, avec nom accessible.

### Champs

- Hauteur 48 à 52 px, fond noir, bordure `#343434` au repos, focus vert avec anneau discret.
- Libellé persistant au-dessus. Placeholder = exemple, jamais seul intitulé.
- Aide et erreur sous le champ sans déplacement brutal. Erreur simple : « Entrez les 10 chiffres du numéro ».
- Préfixes `+225`, suffixes `FCFA` et unités intégrés visuellement mais non confondus avec la valeur.

### Panneaux, listes et lignes d'action

- Carte uniquement pour regrouper un objet ou une décision. Une liste de commandes est une liste structurée, pas une grille de cartes identiques sur bureau.
- Ligne d'action : icône, titre, explication courte, valeur/état, chevron. Toute la ligne peut être tactile si son rôle est explicite.
- Utiliser bordures horizontales pour rythmer les réglages au lieu d'enfermer chaque option dans une nouvelle carte.

### États et retours

- **Chargement** : squelette qui reprend la forme finale, pas un spinner isolé au milieu.
- **Vide** : expliquer le bénéfice et proposer une seule prochaine action réelle.
- **Indisponible** : dire que les données n'ont pas pu être chargées, garder la dernière valeur seulement si elle est datée comme telle, bouton « Réessayer ».
- **Succès** : confirmation près de l'action ; toast seulement pour une action légère. Une étape critique reste visible dans l'écran.
- **Erreur** : message humain, conséquence et moyen de reprendre. Conserver les saisies.
- **Statut bot** : quatre états minimum, `Actif`, `En pause`, `Connexion en cours`, `Déconnecté`. Ne jamais afficher vert/« prêt » avant confirmation réelle.

### Bottom sheets et confirmations

- Mobile : feuille depuis le bas, poignée, titre fixe, corps défilable, action principale au-dessus de la zone sûre.
- Bureau : panneau latéral ou dialogue compact selon la tâche. Une page dédiée est préférable pour une édition longue.
- Focus piégé, fermeture Échap, retour du focus, nom accessible. Une action irréversible exige une confirmation, mais une modification normale ne mérite pas une modale.

## 5. Architecture de l'espace vendeur

Navigation principale recommandée, cinq destinations maximum sur mobile :

1. **Accueil** : ce qui demande l'attention maintenant.
2. **Conversations** : clients et reprise manuelle.
3. **Commandes** : paiement, préparation, livraison et incidents.
4. **Produits** : catalogue, prix, variantes et stock.
5. **Réglages** : bot, boutique, livraison, paiement, abonnement, compte.

Le bureau conserve une barre latérale. Le téléphone conserve la barre basse, avec libellés complets lisibles : éviter « Conv ». WhatsApp et abonnement restent dans Réglages, sauf alerte critique présentée sur Accueil. Analytics devient une vue secondaire accessible depuis Accueil, pas nécessairement un sixième onglet.

Chaque page doit répondre dans cet ordre :

1. Où suis-je ?
2. Qu'est-ce qui demande mon attention ?
3. Quelle est la prochaine action ?
4. Que s'est-il passé si quelque chose échoue ?

## 6. Refonte écran par écran

### Accueil

- En tête : salutation courte, date, état réel du bot et bouton contextuel unique.
- Première zone : **À faire maintenant**, avec nouvelles commandes, reçus à vérifier, informations de livraison manquantes, conversations reprises ou problème WhatsApp. Ne pas commencer par de grands chiffres décoratifs.
- Résumé du jour : nombre de commandes, montant des commandes clairement nommé, dernière vente. Ne pas appeler cela revenu/encaissement sans journal de paiements.
- Installation PWA et onboarding incomplet deviennent des bandeaux contextuels dismissibles, pas des cartes concurrentes.
- État vide : « Votre boutique est prête à recevoir sa première demande » seulement si activation et connexion sont réellement confirmées.

### Conversations

- Mobile : liste puis conversation plein écran ; retour explicite. Bureau : liste à gauche, conversation à droite.
- Chaque ligne : nom/téléphone, dernier message, heure, non-lu réel, état `Bot répond` ou `Vous répondez`.
- Dans la conversation, bannière persistante indiquant qui a la main, avec action sûre « Reprendre » / « Rendre au bot » et confirmation du résultat serveur.
- Composer conservé après erreur avec bouton Réessayer. Les médias et commandes associées deviennent des pièces visibles, pas du texte technique.

### Commandes

- Séparer visuellement **Paiement** et **Livraison**. Ne jamais utiliser un seul statut pour les deux.
- Vue par files d'action simples : `À confirmer`, `À préparer`, `À livrer`, `Terminées`, `Incidents`. Sur petit écran, segments horizontaux accessibles plutôt qu'un tableau.
- Fiche commande : client, articles/variantes, adresse, total, déjà payé, reste à encaisser, historique des étapes.
- Action phare : « Préparer pour le livreur ». Génère la fiche partageable définie dans `PASSATION_AGENT.md`, avec informations manquantes signalées avant partage.
- Annulation, retour et remboursement sont des flux séparés. Ne pas présenter une remise en stock comme synonyme de remboursement.

### Produits

- Conserver la grille visuelle sur mobile, mais prix, disponibilité et variante dominante doivent être immédiatement lisibles.
- Ajouter depuis une photo est l'entrée principale. Demander ensuite le minimum : nom, prix, disponibilité ; options avancées progressivement.
- Un seul éditeur produit partagé entre création et détail. Prix minimum présenté comme « Dernier prix que le bot peut accepter », jamais exposé au client.
- Variantes regroupées clairement par type, avec stock explicite. Les contrôles de quantité ont une zone tactile de 44 à 48 px.
- État vide reprend l'énergie de la landing avec un motif produit discret et une action unique, sans fausse promesse que l'IA remplira toujours tout.

### Réglages

- Page d'entrée composée de lignes d'action : `Mon bot`, `Ma boutique`, `Livraison`, `Paiements`, `WhatsApp`, `Abonnement`, `Mon compte`.
- Chaque sous-écran montre un résumé réel : « Awa, ton chaleureux », « Connecté », « 2 zones », plutôt qu'un simple chevron.
- Une sauvegarde unique, claire et réellement fonctionnelle par sous-écran. Signaler les modifications non enregistrées.
- Regrouper ton, négociation et consignes sous « Comment mon bot vend ». Le simulateur affiche clairement qu'il utilise les réglages enregistrés et consomme potentiellement de l'IA.
- Supprimer exemples/adresses/téléphones fictifs des états réels. Ne pas colorer chaque catégorie différemment.

### Connexion WhatsApp

- Parcours en trois états : `Pas connecté`, `Connexion en cours`, `Connecté`. Une étape = une consigne + une action.
- Code de jumelage recommandé sur téléphone ; QR disponible comme alternative. Numéro ivoirien en dix chiffres avec préfixe visible.
- État connecté : heure de dernière vérification, conséquence réelle (« Le bot peut répondre » seulement si actif), actions Pause et Déconnecter distinctes.
- Erreur : raison compréhensible, tentative suivante possible, aucune animation infinie si le serveur est indisponible.

### Onboarding

- Progression reprenable : Boutique → premier produit → règles essentielles → WhatsApp → test → activation.
- Montrer « 3 étapes sur 6 », conserver les données et permettre de quitter. Ne jamais conclure « C'est prêt » avant un test réussi et une activation explicite.
- Préremplir le moins possible ; aucune donnée fictive susceptible d'être sauvegardée.
- Une illustration forte ou un ticket de progression peut reprendre le langage de la landing. Le contenu de la tâche reste premier.

### Authentification et abonnement

- Pages auth plus proches du site public : marque, phrase éditoriale courte, formulaire très sobre. Sur mobile, formulaire immédiatement visible.
- Afficher exactement le canal de vérification utilisé. Conserver numéro/email en cas d'échec.
- Abonnement expiré : expliquer que le bot est suspendu, mais laisser accéder aux commandes existantes conformément à la décision produit prévue. Action principale liée au mode de renouvellement réellement supporté.

### Analytics

- Le titre indique la définition : « Activité des commandes », pas « Revenus » si ce n'est pas de l'argent encaissé.
- Une question par graphique. Valeur, période et comparaison utilisent le même ensemble de données.
- L'absence de données, l'indisponibilité et zéro sont trois états différents.

## 7. Motion et personnalité

- Application : transitions 160 à 220 ms, uniquement `transform` et `opacity` quand possible, easing `--ease-out`. Pression tactile courte à `.97` ou `.98`.
- Révélation d'une ligne ajoutée, ouverture d'une feuille, changement d'état et squelette sont utiles. Pas de flottement permanent des cartes, compteur animé ou délai en cascade à chaque navigation.
- Landing : conserver son ticker, téléphone flottant et reveals, avec bouton Pause et réduction de mouvement déjà présents.
- Le petit détail « djassa » peut vivre dans les mots, tickets, confirmations et états vides. Il ne doit jamais ralentir une action urgente.

## 8. Ton rédactionnel

- Français direct, phrases courtes, verbes d'action. Employer des mots compris sans explication : `Commande`, `Reste à encaisser`, `Le bot répond`, `Réessayer`.
- Nouchi seulement quand il apporte de la chaleur dans le marketing ou la personnalité configurée par le vendeur. Pas dans une erreur de paiement, une suppression ou une règle juridique.
- Ne pas appeler l'utilisateur « user », le bot « agent », une panne « exception », un JID « numéro » ni un montant de commandes « revenu ».
- Éviter les promesses absolues : pas de « toujours », « automatique » ou « sécurisé » sans preuve correspondante.

Exemples :

- Mauvais : `Error 500` → Bon : `La commande n'a pas pu être chargée. Réessayez.`
- Mauvais : `Bot online` → Bon : `Le bot répond aux clients.`
- Mauvais : `Revenue aujourd'hui` → Bon : `Montant des commandes aujourd'hui.`
- Mauvais : `Take over` → Bon : `Répondre moi-même.`

## 9. Accessibilité et adaptation

- Navigation complète au clavier, focus visible, ordre logique, titres hiérarchiques, `label` lié à chaque champ.
- Contraste vérifié pour texte et états. Les informations essentielles ne descendent pas au gris `#555`.
- Dialogues et feuilles correctement nommés ; icônes décoratives cachées ; boutons icône seuls avec nom accessible.
- Tester 320, 360, 390, 768 et 1 280 px, zoom 200 %, clavier virtuel, textes longs, prix à sept chiffres, noms/adresses longs.
- Pas de survol indispensable. Pas de double défilement. Conserver la position de lecture lors des rafraîchissements.
- Tous les mouvements respectent `prefers-reduced-motion`; les animations décoratives publiques restent pausables.

## 10. Performance

- Ne pas ajouter de framework d'animation pour des effets réalisables en CSS.
- Images produits compressées, tailles adaptées, chargement différé hors écran, dimensions réservées pour éviter les sauts.
- Éviter flous et ombres lourdes sur mobile. La texture de grille et les orbes sont facultatifs dans l'app et doivent rester quasi invisibles.
- Charger les pages à la demande comme actuellement, annuler les requêtes obsolètes, ne pas multiplier les interrogations serveur pour animer l'interface.
- Un squelette ne doit pas masquer indéfiniment une erreur ; réseau lent et hors-ligne doivent conduire à un état explicite.

## 11. Anti-modèles à refuser

- Dégradés, verre flouté partout, texte en dégradé, grosses ombres néon.
- Grille répétitive de cartes icône + titre + texte pour chaque réglage.
- Carte dans carte dans carte, rayon différent à chaque niveau.
- Vert sur tous les titres, icônes et badges ; il perdrait son rôle de signal.
- Trois actions primaires concurrentes, bouton uniquement iconographique pour une action métier.
- Faux chiffres, faux messages clients ou réglages fictifs dans l'interface réelle.
- Animations de page longues, rebonds, éléments flottants dans les écrans de travail.
- Copier littéralement le hero de la landing dans le dashboard. Il faut reprendre la **grammaire**, pas le décor.
- Refaire l'apparence avant de clarifier les états paiement/livraison, l'activation du bot et les actions métier du parcours concerné.

## 12. Méthode de refonte pour Claude ou un autre agent

1. Lire `AGENTS.md`, `CLAUDE.md`, `VIABILITE.md`, `PASSATION_AGENT.md`, `PRODUCT.md`, puis ce document.
2. Inspecter le travail local. Ne pas repartir du GitHub seul : les cinq lots sont dans le commit local non pushé `aedd5ef`, et cette fiche peut encore être non commitée.
3. Avant le code, produire des wireframes textuels mobile pour Accueil, Conversations, Commandes, Produits et Réglages. Demander l'avis d'Alex sur l'architecture et les décisions stratégiques.
4. Construire les tokens et les composants communs dans un périmètre borné, puis refaire le shell de navigation.
5. Refaire par parcours complet, recommandé : onboarding/activation → accueil → commandes/livraison → conversations → produits → réglages → abonnement/auth → analytics.
6. Pour chaque écran, couvrir chargement, vide, erreur, données longues, réseau lent, action réussie et action refusée. Ne jamais injecter de données fictives pour embellir.
7. Comparer visuellement avec la landing : même marque, vert, noirs, densité typographique et ton ; application plus calme et plus opérationnelle.
8. Vérifier sur téléphone réel ou tailles équivalentes, clavier et accessibilité. Le build seul ne valide pas le design.
9. Exécuter les vérifications du projet avant commit. Documenter les écrans terminés dans `VIABILITE.md` et `CLAUDE_ROADMAP.md`.
10. Pas de push sans demande explicite : `main` déploie automatiquement le frontend. Le VPS backend est arrêté.

## 13. Critères d'acceptation de la refonte

La refonte est réussie lorsque :

- un nouveau vendeur comprend sans aide si le bot est actif et comment finir l'installation ;
- une action principale est identifiable en moins de quelques secondes sur chaque écran ;
- le vendeur distingue paiement, préparation et livraison sans connaître les statuts internes ;
- une commande prête peut être transmise au livreur avec le reste à encaisser et les informations manquantes visibles ;
- reprendre une conversation indique clairement qui répond et confirme l'échec comme le succès ;
- aucune panne de données n'est présentée comme zéro, liste vide ou réussite ;
- la navigation mobile reste utilisable à une main avec cinq destinations claires ;
- toutes les données affichées sont réelles, appartenant à la bonne boutique et correctement nommées ;
- l'app ressemble clairement à la page de garde sans devenir un site publicitaire ;
- les parcours principaux fonctionnent à 320 px, au clavier, avec mouvement réduit et réseau lent.

## 14. Ce qui n'est pas décidé

Cette fiche ne décide pas à la place d'Alex : le logo final `D` ou `d.`, l'ordre exact des écrans après tests utilisateurs, le modèle IA ou OpenRouter, les règles de paiement/récurrence, le moment de réservation du stock, les retours/remboursements et le périmètre Capacitor. La refonte doit rendre ces règles compréhensibles une fois décidées, pas les inventer.
