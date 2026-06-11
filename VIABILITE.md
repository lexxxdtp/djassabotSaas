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
- [ ] ❌ **Le vendeur est-il PRÉVENU quand son bot tombe ?** Non — il y a un warning dans le dashboard, mais pas de notification push/SMS/email. Un bot mort 2 jours sans que le vendeur le sache = client perdu + churn. → Notifications push (PWA) ou email Resend.
- [ ] 🔍 **Que se passe-t-il si le téléphone du vendeur est éteint 14 jours ?** WhatsApp délie les appareils → il faut rescanner. Documenter ça dans l'onboarding ("garde ton téléphone connecté au moins une fois par semaine").
- [ ] ⚠️ **Le VPS tient-il combien de tenants ?** KVM 2 / 8 GB RAM. Chaque session Baileys ≈ 60-120 MB. Estimation : ~40-60 bots simultanés confortables. À monitorer (`pm2 monit`) à partir de 20 vendeurs. Prévoir upgrade VPS à 50+.
- [ ] ❌ **Y a-t-il un monitoring/alerting du serveur ?** Non. Si le VPS tombe à 3h du matin, personne ne le sait. → Minimum : UptimeRobot (gratuit) sur `https://187-77-171-44.nip.io/` qui t'envoie un email/SMS si down. **10 min.**
- [ ] ⚠️ **Le tenant orphelin** `3b7d4665-...` qui bouclait en reconnexion — le watchdog limite la casse, mais vérifier dans les logs PM2 qu'il ne pollue plus.

## 2. 🔐 Sécurité — "Est-ce qu'on peut me voler ou voler mes vendeurs ?"

- [x] ✅ **Un reçu Wave peut-il valider 2 commandes ?** Non — anti-réutilisation par référence de transaction (commit `5f8230c`).
- [x] ✅ **Un client peut-il faire envoyer n'importe quelle image par le bot ?** Non — seules les URLs de l'inventaire du tenant sont autorisées.
- [x] ✅ **OTP téléphone vérifié côté serveur ?** Oui — Firebase Admin SDK, le backend vérifie le token.
- [x] ✅ **Rate limiting sur l'auth ?** Oui — 20 req/15min auth, 5 req/10min OTP.
- [ ] ❌ **RLS Supabase** : toutes les policies sont `using (true)` — si la clé anon fuite, toute la base est lisible. Le backend filtre par tenantId mais zéro défense en profondeur. → Réécrire les policies. **~2h, important avant 50+ vendeurs.**
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

- [ ] ❌ **CGU / CGV** : aucune page conditions d'utilisation. Tu encaisses des abonnements → il en faut (responsabilité en cas de ban WhatsApp du vendeur, de perte de données, remboursements...).
- [ ] ❌ **Politique de confidentialité** : tu stockes les conversations WhatsApp des CLIENTS des vendeurs (qui n'ont rien signé). Minimum : page de confidentialité + mention dans les CGU vendeur.
- [ ] ⚠️ **Risque WhatsApp ToS** : Baileys viole les CGU WhatsApp. Risque réel = ban du numéro du vendeur (pas de poursuite). À assumer en connaissance de cause + le dire honnêtement dans les CGU ("nous utilisons WhatsApp Web, risque de suspension du numéro en cas d'usage abusif").
- [ ] ⚠️ **Mention reCAPTCHA** : badge masquable mais mention textuelle obligatoire dans le footer (CG Google). Petit fix CSS + une ligne de texte.
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

- [ ] ❌ **Canal de support** : aucun. Minimum viable : un numéro WhatsApp support affiché dans Réglages → Compte (ironique mais parfait : tu utilises ton propre produit).
- [ ] ❌ **FAQ / aide** : rien. 5 questions suffisent pour commencer (Comment connecter ? Pourquoi le bot ne répond pas ? Comment marquer payé ? C'est quoi la pause ? Comment changer mes prix ?).
- [ ] ⚠️ **Toi, tu vois quoi ?** Pas de vue admin multi-tenants. Pour 10 testeurs, Supabase Table Editor suffit. À 50+, il faudra un mini-admin.

## 9. 💾 Données — "Et si tout brûle ?"

- [ ] 🔍 **Backups Supabase** : le plan gratuit garde 7 jours. Vérifier que c'est actif. Au plan Pro : backups quotidiens + PITR.
- [ ] ⚠️ **Sessions WhatsApp (auth Baileys)** : stockées UNIQUEMENT sur le disque du VPS (`/home/alex/djassabotSaas/backend/auth_info_baileys/`). Si le VPS meurt, TOUS les vendeurs doivent rescanner leur QR. Acceptable au début, mais prévoir un backup périodique de ce dossier (cron + rclone vers un storage).
- [ ] ❌ **`wipe_db.ts` traîne sur ta machine** : script de suppression totale non commité — le supprimer ou le déplacer hors du repo pour éviter un drame.

## 10. 🎯 Produit — ce qui reste pour la vision complète

- [x] ✅ Bot envoie les photos produits + négocie avec prix plancher + consignes spéciales (commit `45887b1` — c'était cassé avant).
- [x] ✅ Validation auto des reçus Wave/OM (Screenshot Validator) + anti-fraude.
- [x] ✅ Diffusion de campagnes WhatsApp avec audiences réelles + anti-ban.
- [x] ✅ Relance paniers abandonnés (cron 30 min).
- [ ] ❌ Codes promo (retirés de l'UI car non fonctionnels — à coder backend si demandé par les testeurs).
- [ ] ❌ Statistiques de campagnes (envoyées/échecs) dans la page Marketing — les données existent dans activity_logs, il manque juste l'affichage.
- [ ] ❌ Notifications push (commande reçue, bot déconnecté).
- [ ] ⚠️ Table `customers` créée mais inutilisée — l'exploiter (CRM léger) ou la supprimer.

---

## 📋 Ordre d'attaque suggéré pour demain

| # | Action | Durée | Impact |
|---|--------|-------|--------|
| 1 | `pm2 startup` + `pm2 save` sur le VPS | 5 min | Survit aux reboots |
| 2 | UptimeRobot sur l'API | 10 min | Tu sais quand c'est down |
| 3 | Acheter un domaine + config Resend | 30 min | Les testeurs peuvent s'inscrire |
| 4 | Vérifier JWT_SECRET prod + backup auth_info cron | 20 min | Sécurité/données |
| 5 | Paystack clés live + plans réels + test paiement | 45 min | L'argent peut rentrer |
| 6 | Test end-to-end avec ta 2e puce (vente complète) | 30 min | Validation du cœur du produit |
| 7 | CGU + confidentialité (je peux les rédiger) | 1 h | Protection légale |
| 8 | Numéro WhatsApp support + mini-FAQ | 30 min | Les testeurs ne sont pas perdus |

*Après ça : recruter les 10 testeurs. Le produit est prêt.*
