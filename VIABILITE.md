# ✅ DjassaBot — Checklist de viabilité produit

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
- [ ] ⚠️ **PM2 redémarre-t-il après un reboot du VPS ?** NON CONFIRMÉ. À faire une fois sur le VPS : `pm2 startup` puis suivre l'instruction affichée, puis `pm2 save`. **5 min, critique.**
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
- [ ] ⚠️ **Sessions WhatsApp (auth Baileys)** : script de backup PRÊT (`scripts/backup_wa_auth.sh`, rotation 7 jours). Reste à l'installer sur le VPS : `chmod +x` + la ligne crontab indiquée dans le script. **5 min.**
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
