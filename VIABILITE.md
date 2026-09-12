# ✅ DjassaBot — Checklist de viabilité produit

> **Passation actualisée le 12 septembre :** [PASSATION_AGENT.md](PASSATION_AGENT.md) donne les branches et validations exactes. Lire aussi [DESIGN.md](DESIGN.md) pour la future refonte. La base `aedd5ef` est sur `main`; les compléments restent à intégrer depuis `claude/dois-commiter-3h9adk` puis `codex/secure-payments`. Les grandes cases restent ouvertes tant que les migrations et la recette réelle n'ont pas été validées.

> **Mise à jour du 11 septembre 2026 : les cases historiques ci-dessous ne constituent pas une validation actuelle.** L'audit hors ligne sur `308ed0e` reproduit dix défauts, dont la reconnexion bloquée et un succès de stock malgré une erreur. Le VPS est arrêté selon Alex. La référence actuelle est [l'audit consolidé](AUDIT_VIABILITE_2026-09-11.md), avec preuves, limites et ordre proposé. Pas de feu vert pour des clients payants à ce stade.

## Priorités actuelles issues de l'audit du 11 septembre 2026

### Cinquième lot local : simulateur isolé

- [x] Historique et panier de simulation dans une mémoire séparée, jamais persistés dans les sessions clients ni retournés aux listes de relance. Identifiant de test imposé par le serveur ; `sessionId` fourni par le navigateur ignoré, y compris au reset.
- [x] Même moteur commercial et lecture des réglages/catalogue enregistrés, sans création de commande, décrément de stock, notification vendeur ou journal métier lors des chemins simulés testés.
- [x] Une seule action de simulation à la fois par boutique ; chevauchement refusé en 409. Mémoire temporaire expirant après 30 minutes d'inactivité lors du prochain accès, plafond de 1 000 boutiques en mémoire. Redémarrage du processus = perte volontaire des tests.
- [x] Reset côté écran seulement après succès HTTP ; boutons bloqués pendant l'action, erreurs distinctes des réponses IA, texte conservé après refus et limite de 4 000 caractères. Libellé précisant les réglages enregistrés et l'absence de commande réelle.
- [x] **83 tests backend réussis**, TypeScript backend et build frontend réussis. Tests : collision avec identifiant client, séparation boutiques, chevauchement, achat simulé complet, reset et validation de requête. Aucun appel IA/WhatsApp réel pour ces vérifications.

Les anciennes sessions de simulation déjà enregistrées en production ne sont pas supprimées automatiquement : il faudra les identifier avant nettoyage. Cette isolation ne remplace ni les quotas IA, ni les tests de panne réelle. Aucun commit, push, changement distant ou migration. Les principes de clarté Impeccable sont conservés pour les erreurs et libellés ; aucune refonte visuelle effectuée.

### Quatrième lot local : statistiques honnêtes et lecture des commandes

- [x] Accueil et Analytics : même calcul, commandes annulées/statuts inconnus/montants invalides exclus. Affichage nommé « Montant des commandes », livraison incluse, sans prétendre mesurer un encaissement. Les commandes en attente restent incluses en tant que commandes, pas en tant que paiements.
- [x] Sept journées calendaires d'Abidjan, total cohérent avec le graphique ; dates futures et invalides exclues. Panier moyen calculé sur le même ensemble de commandes.
- [x] Une panne de lecture Supabase ne revient plus à une liste locale vide, y compris en pagination. La route répond HTTP 503 ; Accueil/Analytics affichent l'indisponibilité au lieu de zéro, et l'accueil n'annonce pas « rien à faire » sans commandes chargées.
- [x] **79 tests réussis**, TypeScript backend et build frontend réussis. Huit tests supplémentaires couvrent calculs et erreurs de lecture/route. Pas de recette visuelle complète ni de requête sur une base réelle.

Les dix reproductions initiales ont désormais chacune des tests du comportement corrigé. Cela ne ferme pas l'audit : paiement/livraison séparés, historique d'encaissement, remboursements, agrégats serveur pour dépasser les limites de lecture et transaction/idempotence restent ouverts. Impeccable a guidé les libellés et états d'erreur ; les consignes Supabase ont guidé la propagation des erreurs sans faux résultat. Aucun commit, push ou déploiement.

### Troisième lot local : compréhension des achats

- [x] Montants abrégés décimaux (`12.5k`, `12,5K`) correctement interprétés, séparateurs de milliers contrôlés et nombres hors limites refusés.
- [x] Quantités fractionnaires refusées plutôt qu'arrondies. Balises d'achat mal formées retirées du message et suivies d'une demande de précision, sans mutation du panier.
- [x] Recherche produit : identifiant exact prioritaire, nom exact unique sinon correspondance de tous les mots (accents/pluriels simples tolérés). Pas de premier résultat arbitraire sur ambiguïté, ni de couleur/modèle ignoré.
- [x] Article introuvable/ambigu ou quantité invalide : clarification explicite au lieu de transmettre la promesse IA. Une demande mixte contenant une ligne refusée n'est pas partiellement ajoutée.
- [x] **71 tests backend réussis**, TypeScript backend réussi. La dernière reproduction historique encore active concerne les revenus incluant une commande annulée ; cela ne signifie pas que tous les autres chantiers de l'audit sont terminés.

Pas de modification des règles de prix, migration, appel IA réel, commit ou push. Le contexte des photos/messages cités et les changements de panier en cours de conversation restent ouverts. La recherche plus prudente peut demander davantage de précisions ; à évaluer sur les conversations réelles autorisées.

### Deuxième lot local : produits, stock et confirmation

- [x] Modification produit limitée aux champs métier attendus ; identifiants/propriétaire/colonnes arbitraires ignorés, filtres produit + commerçant conservés. Les erreurs de base remontent ; restitution de `manageStock` alignée sur les lectures unitaires et la modification.
- [x] Stock : plus de succès sur réponse RPC vide, exception ou rejet technique. Secours historique réservé au code explicite de fonction absente ; une sauvegarde nulle échoue. Compensation tentée pour les mouvements précédents confirmés, échec de remise en stock signalé.
- [x] Panier fermé avant confirmation WhatsApp ; un échec d'envoi client ne bloque plus la tentative de notification vendeur et ne remonte plus comme une invitation à revalider. Effacement du panier écrit avec `null` explicite en base. Promesse trompeuse de validation automatique du reçu remplacée par vérification du vendeur.
- [x] **63 tests backend réussis**, TypeScript backend réussi. Les trois reproductions historiques restantes portent sur montant abrégé, produit ambigu et revenus annulés. Les nouveaux tests utilisent des dépendances remplacées, pas une base réelle.
- [ ] **Toujours ouvert : transaction et idempotence durables.** Le lot supprime le chemin de doublon causé par le seul échec d'envoi après une sauvegarde de session réussie. Il ne garantit pas l'absence de doublons si la sauvegarde de session échoue, si le processus s'arrête entre deux écritures ou si une réponse de base est perdue. Le secours stock sans RPC reste non atomique ; les notifications n'ont pas encore de file de reprise durable. Prévoir migration et tests sur base isolée avant production.

Aucune migration appliquée, aucun accès production, aucun commit ni push. Les consignes Supabase ont guidé le filtrage des écritures et la distinction entre panne et refus métier ; la vérification d'intégration réelle reste à effectuer.

### Premier lot local

Alex a autorisé le passage à l'action après l'audit. Premier lot implémenté localement, sans commit, push ni déploiement :

- [x] Conservation du zéro initial pour l'inscription et les deux écrans de connexion WhatsApp ivoiriens ; validation des dix chiffres dans les écrans de connexion.
- [x] Rejets explicites, réponses vides et exceptions du service email retournés comme échecs pour les quatre fonctions d'envoi. Acceptation par le prestataire ne signifie pas livraison en boîte de réception.
- [x] Groupes, broadcasts et chaînes exclus avant le traitement métier.
- [x] Pause globale/individuelle, expiration et historique : pas de téléchargement ni analyse IA des médias ; trace conservée. Le traitement actif des images/vocaux reste testé.
- [x] Fermeture WhatsApp : état local déconnecté avant nouvelle tentative, ancien socket ignoré, fermeture répétée sans deuxième minuteur. Nettoyage invalidant la session locale. Code de jumelage retiré des logs.
- [x] 17 tests supplémentaires isolés, soit **52 tests réussis** ; TypeScript backend et build frontend réussis. Les quatre anciennes reproductions corrigées sont remplacées par ces tests ; six autres défauts restent reproduits par le diagnostic.

Ce lot ne règle pas encore les transactions commande/stock, les champs produits, les paiements, les dépendances vulnérables, l'isolation du simulateur, les erreurs Inbox ou la refonte. La récupération de compte reste à durcir ; la reconnexion concurrente, le watchdog et le redémarrage réel restent à compléter/tester. Les grandes cases ci-dessous restent donc ouvertes.

- [ ] **Accès fiable** : conserver les dix chiffres locaux du téléphone à l'inscription/connexion ; traiter les rejets Resend et les échecs de réinitialisation sans annoncer un succès.
- [ ] **Connexion fiable** : corriger la reprise après fermeture, exclure les groupes, dédupliquer les messages, vérifier la pause avant toute analyse payante.
- [ ] **Intégrité des données** : liste blanche des champs produits, tests à deux commerçants, transaction commande/stock et validation unique même si l'envoi WhatsApp échoue.
- [ ] **Sécurité des dépendances** : traiter les alertes, notamment Baileys, par mises à jour ciblées et tests ; aucune exploitation en production n'a été démontrée.
- [ ] **Paiements et droits** : rapprocher référence/montant/devise/commande ; rendre les webhooks idempotents ; unifier le forfait effectif. Décider avec Alex du renouvellement Mobile Money manuel et de l'automatique par carte.
- [ ] **Livraison exploitable** : paiement et livraison séparés, fiche partageable avec reste à encaisser même à réception, informations manquantes visibles, suivi des échecs/retours/remboursements.
- [ ] **Conversation commerciale** : article ambigu, variantes, panier modifiable, total confirmé, offre négociée mémorisée ; supprimer les exemples fictifs des données actives.
- [ ] **Historique et simulation** : journal commercial distinct de la mémoire courte IA ; simulation sans effet réel ; notifications et reçus à vérifier dans une file durable.
- [ ] **Prise en main** : cinq destinations cohérentes, accueil orienté actions, éditeur produit unique, compte sans formulaire inerte, erreurs HTTP visibles, accessibilité et mobile. Refonte graphique après validation des parcours.
- [ ] **Coûts et IA** : mesurer consommation et latence par vendeur ; évaluer OpenRouter et les modèles avec le même jeu de conversations, sans migration ni dépense automatique.
- [ ] **Exploitation** : migrations reproductibles, inventaire RLS avant application, sauvegardes hors VPS incluant les médias et restauration testée, surveillance extérieure, séparation recette/production.
- [ ] **Recette réelle après remise en service autorisée** : inscription, reprise WhatsApp, vente complète, paiement, livraison, deux comptes isolés et observation de commerçants non guidés.

Corrections de lecture de l'ancien état : la reconnexion n'est pas garantie ; l'anti-réutilisation des reçus doit être revalidée avec le nouveau traitement manuel ; les revenus incluent actuellement des commandes annulées ; les audiences et statistiques marketing ne sont pas entièrement fiables. L'erreur d'envoi Inbox est visible sur exception réseau, mais pas sur tous les refus HTTP. La mention antérieure « non déployées » doit être distinguée du commit local `308ed0e` ; aucun déploiement backend actuel n'est attesté ici.

**Sauvegardes :** l'affirmation historique « le plan gratuit garde 7 jours » est erronée. Organiser des exports et copies externes selon l'offre réelle ; les sauvegardes de base n'incluent pas les fichiers Storage. Voir la [documentation officielle](https://supabase.com/docs/guides/platform/backups). Les estimations historiques de prix, capacité VPS et coûts IA ci-dessous ne sont pas des mesures ni des tarifs revérifiés.

## Historique de la checklist (à ne pas confondre avec une recette actuelle)

> Les questions qu'il faut se poser AVANT de mettre l'app entre les mains de
> vendeurs qui paient 5 000 F/mois. Chaque case non cochée = un risque réel.
>
> **Légende** : ✅ réglé · ⚠️ partiel / à vérifier · ❌ à faire · 🔍 à tester
>
> *Créé le 11 juin 2026 — audit complet de session. À cocher ensemble.*

---

## 1. 🔌 Fiabilité — "Est-ce que ça tourne tout seul, tout le temps ?"

- [x] ✅ **Le bot survit-il à un redémarrage du serveur ?** Oui — sessions Baileys persistées sur disque + relance auto de tous les tenants au boot.
- [x] ✅ **Le bot se reconnecte-t-il après une coupure ?** Oui — 5 tentatives rapides + watchdog toutes les 5 min (commit `1ace67c`).
- [x] ✅ **PM2 redémarre-t-il après un reboot du VPS ?** OUI — `pm2-alex.service` créé et activé (systemd), liste de process sauvegardée (`pm2 save`). Fait le 11/06/2026.
- [x] ✅ **Le vendeur est-il PRÉVENU quand son bot tombe ?** Oui — alerte EMAIL automatique au propriétaire quand le watchdog échoue (1 max/heure), avec lien direct vers la reconnexion. ⚠️ Effectif pour tous les vendeurs seulement après config du domaine Resend.
- [ ] 🔍 **Que se passe-t-il si le téléphone du vendeur est éteint 14 jours ?** WhatsApp délie les appareils → il faut rescanner. Documenter ça dans l'onboarding ("garde ton téléphone connecté au moins une fois par semaine").
- [ ] ⚠️ **Le VPS tient-il combien de tenants ?** KVM 2 / 8 GB RAM. Chaque session Baileys ≈ 60-120 MB. Estimation : ~40-60 bots simultanés confortables. À monitorer (`pm2 monit`) à partir de 20 vendeurs. Prévoir upgrade VPS à 50+.
- [ ] ❌ **Y a-t-il un monitoring/alerting du serveur ?** Non. Si le VPS tombe à 3h du matin, personne ne le sait. → Minimum : UptimeRobot (gratuit) sur `https://187-77-171-44.nip.io/` qui t'envoie un email/SMS si down. **10 min.**
- [ ] ⚠️ **Le tenant orphelin** `3b7d4665-...` qui bouclait en reconnexion — le watchdog limite la casse, mais vérifier dans les logs PM2 qu'il ne pollue plus.

## 2. 🔐 Sécurité — "Est-ce qu'on peut me voler ou voler mes vendeurs ?"

- [x] ✅ **Un reçu Wave peut-il valider 2 commandes ?** Non — anti-réutilisation par référence de transaction (commit `5f8230c`).
- [x] ✅ **Un client peut-il faire envoyer n'importe quelle image par le bot ?** Non — seules les URLs de l'inventaire du tenant sont autorisées.
- [x] ✅ **OTP téléphone vérifié côté serveur ?** Oui — Firebase Admin SDK, le backend vérifie le token.
- [x] ✅ **Rate limiting sur l'auth ?** Oui — 20 req/15min auth, 5 req/10min OTP.
- [ ] ⚠️ **RLS Supabase** : migration PRÊTE (`database/migrations/enable_rls_defense_in_depth.sql`) avec prérequis de vérification et rollback. À appliquer ENSEMBLE demain : vérifier que le .env VPS utilise la clé service_role, appliquer, tester le dashboard immédiatement.
- [ ] ⚠️ **JWT_SECRET fort en prod ?** Un secret fort a été généré (session mai) — VÉRIFIER que le `.env` du VPS l'utilise bien et pas le défaut `tdjaasa-super-secret...`.
- [ ] ⚠️ **CORS `.vercel.app` wildcard** : n'importe quel site hébergé sur vercel.app peut appeler l'API. Risque limité (le token est en localStorage, pas en cookie) mais à restreindre au domaine exact quand tu auras un domaine.
- [ ] 🔍 **Un vendeur peut-il accéder aux données d'un autre ?** Le code filtre par tenantId partout (vérifié sur orders/products/chats/settings) — mais un test manuel à deux comptes serait sain.
- [ ] ❌ **Mot de passe d'Alex partagé en clair dans des chats** → le changer. 😉

## 3. 💳 Monétisation — "Est-ce que l'argent peut VRAIMENT rentrer ?"

- [ ] ❌ **Paystack est en clés TEST.** Personne ne peut réellement payer un abonnement aujourd'hui. → Passer en clés live + créer les vrais plans (5 000 / 10 000 / 15 000) dans le dashboard Paystack. **Bloquant pour encaisser.**
- [ ] 🔍 **Le webhook Paystack fonctionne-t-il en prod ?** Le bug de signature a été corrigé (mai), mais jamais testé avec un vrai paiement. Tester avec un petit montant réel.
- [ ] ⚠️ **Que se passe-t-il quand l'abonnement expire ?** Vérifier le comportement : le bot s'arrête ? Le vendeur est prévenu avant ? Période de grâce ? (À auditer dans `tenantService` / middleware — un vendeur coupé sans préavis = churn garanti.)
- [x] ✅ **Y a-t-il une raison d'upgrader ?** Oui — limite 50 produits sur Starter (commit `e74f5a1`). À étendre plus tard : limite de conversations IA/mois (cf. stratégie pricing).
- [ ] ❌ **Limite de conversations IA par plan** (500/2000/illimité selon la doc pricing) : non implémentée. Sans ça, un Starter peut consommer autant de Gemini qu'un Business.
- [ ] ⚠️ **Trial 30 jours** : à l'inscription le tenant est en trial — vérifier ce qui se passe au jour 31 (blocage ? email de relance ?).

## 4. 📈 Coûts & scaling — "Est-ce que je gagne de l'argent à chaque vendeur ?"

- [ ] 🔍 **Coût Gemini par vendeur actif/mois ?** Flash ≈ centimes pour des milliers de messages. Pour 10 testeurs : négligeable. À mesurer réellement (Google Cloud Console → facturation) après 2 semaines de test pour valider la marge.
- [ ] ⚠️ **Quota Gemini** : clé sur projet AI Studio — vérifier les limites de requêtes/min en cas de pic (plusieurs bots qui répondent en même temps).
- [ ] 🔍 **Supabase plan gratuit ?** Limites : 500 MB DB, pause après 7 jours d'inactivité (la pause ne touchera pas un projet actif). OK pour le test, passer au plan Pro (~25$/mois) avant le lancement public.
- [ ] ⚠️ **Stockage images produits** : uploads via Supabase Storage — 1 GB gratuit. 50 vendeurs × 50 produits × 2 photos ≈ ça passe, mais à surveiller.
- [x] ✅ **VPS mutualisé** : 7,99€/mois pour DjassaBot + n8n — coût fixe sain.

## 5. ⚖️ Légal & conformité — "Est-ce que je peux me faire attaquer ?"

- [x] ✅ **CGU** : page `/conditions` en ligne (abonnement, responsabilités, résiliation). ⚠️ À faire relire par un avocat ivoirien avant la croissance.
- [x] ✅ **Politique de confidentialité** : page `/confidentialite` (couvre les commerçants ET leurs clients finaux, IA, prestataires, droits).
- [x] ✅ **Risque WhatsApp ToS** : assumé et écrit noir sur blanc dans les CGU (§3) avec les bonnes pratiques anti-ban.
- [x] ✅ **Mention reCAPTCHA** : ajoutée dans le footer de la landing avec liens vers les politiques Google.
- [ ] 🔍 **Facturation** : un commerçant qui paie 10 000 F voudra un reçu. Paystack envoie-t-il un reçu email automatique ? Sinon, prévoir.

## 6. 🚀 Activation — "Un vendeur lambda y arrive-t-il SEUL ?"

- [x] ✅ **Inscription email** fonctionne (testée par Alex aujourd'hui).
- [ ] ❌ **Inscription email pour les AUTRES** : Resend sans domaine vérifié → les emails ne partent que vers anadorbreak@gmail.com. **BLOQUANT n°1 pour les 10 testeurs.** → Acheter un domaine (~7 000 F/an) + 10 min de config DNS.
- [ ] ❌ **Inscription téléphone (SMS)** : bloquée par le bug Firebase `auth/error-code:-39` (config projet AI Studio trop bridé). Pistes documentées dans CLAUDE.md §6bis. Plan B : nouveau projet Firebase propre (~30 min).
- [x] ✅ **Onboarding 3 étapes** avec skip (welcome → WhatsApp → produit → personnalité).
- [x] ✅ **Checklist de démarrage** sur la page Aujourd'hui pour ceux qui sautent l'onboarding (commit `06e1240`).
- [x] ✅ **Ajout produit "photo d'abord"** : l'IA pré-remplit nom + description.
- [x] ✅ **Bot en pause par défaut** : connexion WhatsApp sans risque, activation explicite.
- [ ] 🔍 **Test utilisateur réel** : faire inscrire UN vrai commerçant (pas toi) sans l'aider, chronomètre en main. Objectif : bot actif en < 10 min. C'est LE test de viabilité.
- [ ] 🔍 **Parcours complet de vente** : client écrit → bot répond → photo → négociation → commande → reçu Wave → auto-PAID → livraison. Jamais testé de bout en bout en réel. À faire avec ta 2e puce.

## 7. 📱 Distribution — "Comment les vendeurs l'installent ?"

- [x] ✅ **PWA** installable depuis le navigateur (bannière discrète en bas de l'accueil).
- [x] ✅ **iOS Capacitor** prêt (`frontend/ios/`, guide IOS_SETUP.md). Reste : compiler dans Xcode + compte Apple Developer (99$/an) pour TestFlight/App Store.
- [x] ✅ **Android Capacitor** prêt (`frontend/android/`). Reste : Android Studio + compte Play Console (25$ une fois).
- [ ] ⚠️ **Stratégie recommandée pour les 10 testeurs : la PWA** (zéro friction, zéro compte développeur). Les stores viendront après la validation du produit.
- [ ] ❌ **Icônes branded** PWA/app (192/512) — toujours les icônes par défaut.

## 8. 🛟 Support — "Que se passe-t-il quand un vendeur a un problème ?"

- [x] ✅ **FAQ / aide** : section Aide & support dans Réglages → Compte avec les 5 questions clés + email de contact.
- [ ] ⚠️ **Canal de support réel** : l'email support@djassabot.com affiché n'existe pas encore — à créer avec le domaine, ou remplacer par ton numéro WhatsApp support.
- [ ] ⚠️ **Toi, tu vois quoi ?** Pas de vue admin multi-tenants. Pour 10 testeurs, Supabase Table Editor suffit. À 50+, il faudra un mini-admin.

## 9. 💾 Données — "Et si tout brûle ?"

- [ ] 🔍 **Backups Supabase** : le plan gratuit garde 7 jours. Vérifier que c'est actif. Au plan Pro : backups quotidiens + PITR.
- [x] ✅ **Sessions WhatsApp (auth Baileys)** : backup nocturne installé (cron 3h, rotation 7 jours, `/home/alex/backups/`). Fait le 11/06/2026.
- [x] ✅ **`wipe_db.ts` sécurisé** : garde-fou ajouté — le script refuse de s'exécuter sans `WIPE_CONFIRM=OUI_TOUT_EFFACER`. Plus de drame possible par accident.

## 10. 🎯 Produit — ce qui reste pour la vision complète

- [x] ✅ Bot envoie les photos produits + négocie avec prix plancher + consignes spéciales (commit `45887b1` — c'était cassé avant).
- [x] ✅ Validation auto des reçus Wave/OM (Screenshot Validator) + anti-fraude.
- [x] ✅ Diffusion de campagnes WhatsApp avec audiences réelles + anti-ban.
- [x] ✅ Relance paniers abandonnés (cron 30 min).
- [ ] ❌ Codes promo (retirés de l'UI car non fonctionnels — à coder backend si demandé par les testeurs).
- [x] ✅ Statistiques de campagnes réelles dans Marketing (`GET /api/marketing/stats` depuis activity_logs : nombre de campagnes + messages envoyés).
- [ ] ❌ Notifications push (commande reçue, bot déconnecté).
- [ ] ⚠️ Table `customers` créée mais inutilisée — l'exploiter (CRM léger) ou la supprimer.

---

## 📋 Ordre d'attaque suggéré pour demain

| # | Action | Durée | Impact |
|---|--------|-------|--------|
| 1 | `pm2 startup` + `pm2 save` sur le VPS | 5 min | Survit aux reboots |
| 2 | Installer le cron de backup (`scripts/backup_wa_auth.sh`) | 5 min | Sessions WhatsApp sauvegardées |
| 3 | UptimeRobot sur l'API | 10 min | Tu sais quand c'est down |
| 4 | Acheter un domaine + config Resend + créer support@ | 30 min | Les testeurs peuvent s'inscrire |
| 5 | Vérifier JWT_SECRET prod + appliquer la migration RLS ensemble | 30 min | Sécurité en profondeur |
| 6 | Paystack clés live + plans réels + test paiement | 45 min | L'argent peut rentrer |
| 7 | Test end-to-end avec ta 2e puce (vente complète) | 30 min | Validation du cœur du produit |

~~CGU + confidentialité~~ ✅ fait · ~~FAQ/support in-app~~ ✅ fait · ~~alerte bot down~~ ✅ fait · ~~stats campagnes~~ ✅ fait · ~~garde-fou wipe_db~~ ✅ fait

*Après ça : recruter les 10 testeurs. Le produit est prêt.*

## Note produit — 9 septembre 2026 : efficacité du parcours de vente

Points à planifier, consignés à la demande d’Alex. Aucune implémentation ni publication autorisée par cette prise de notes.

**Besoin central :** éviter au vendeur de répéter les mêmes informations aux clients, y compris à ceux qui n’achètent pas. Le bot répond de manière autonome à partir du catalogue et des règles renseignées. La reprise manuelle reste possible ; son déclenchement n’est pas le problème prioritaire de cette réflexion.

**Orientation proposée :** conserver l’architecture actuelle (conversation IA, vérifications métier côté serveur), assouplir le parcours et rendre la conclusion de vente explicite. L’efficacité réelle reste à valider par des essais représentatifs.

- [ ] **Identifier le produit concerné rapidement** : vérifier les demandes ambiguës comme « celui-là », les photos et les réponses à un message ou à un statut ; demander une précision seulement quand nécessaire, sans inventer l’article.
- [ ] **Permettre les changements en cours de commande** : modifier quantité ou variante, ajouter ou retirer un article, puis reprendre le parcours sans perdre le panier. Vérifier que les changements sont réellement appliqués, pas seulement annoncés dans une réponse. Revalider prix, disponibilité et total.
- [ ] **Faire confirmer le total complet** : présenter articles, quantités, livraison et montant final, puis recueillir un accord explicite avant de considérer la commande comme confirmée. Définir lors de la conception le moment de création du brouillon et de réservation du stock.
- [ ] **Tester les conversations non linéaires** : questions répétées, hésitations, produit ambigu, changement d’article ou de quantité pendant la collecte d’adresse, interruption puis reprise, refus des frais de livraison et annulation. Observer les répétitions inutiles, les erreurs de panier et les interventions nécessaires du vendeur. Distinguer gain de temps et augmentation des ventes, qui n’est pas garantie.

Ces points sont des axes de conception et de validation, pas une affirmation que chaque scénario échoue actuellement. Les constats de code ne remplacent pas un test de vente de bout en bout.

## Corrections locales — 10 septembre 2026 (non déployées)

- Reçus : une image ne passe plus automatiquement la commande à PAID ; avertissement et notification de vérification au vendeur. Les mentions historiques d'auto-validation ci-dessus décrivent l'ancien comportement.
- Pause individuelle : appliquée avant le traitement des reçus et aux relances.
- Relances : restitution de `reminder_sent` lors des deux lectures de sessions, exclusion des conversations manuelles, vérification avant envoi et protection contre deux scans simultanés dans le même processus.
- Intentions : annulation plus stricte et adresse exigeant un indice de lieu ou une zone configurée ; les messages ambigus demandent une précision. Ce filtre reste une heuristique, pas une compréhension universelle des adresses.
- Négociation : marge de secours alignée sur le serveur, suppression de la règle contradictoire de prix fixe et conservation de la souplesse zéro.
- Inbox : erreur d'envoi visible et changement de pause affiché seulement après succès HTTP.
- Tests isolés ajoutés, sans API réelle. VPS toujours arrêté : recette WhatsApp et persistance réelle à vérifier après restauration.
- Restent à concevoir/implémenter : panier modifiable, confirmation finale livraison comprise, contexte des messages cités, parcours d'accueil indisponible/onboarding et consultation après expiration. Ces corrections ne constituent pas la refonte complète.
