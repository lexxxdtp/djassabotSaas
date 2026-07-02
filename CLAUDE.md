# DjassaBot — Briefing IA (Claude, Gemini/Antigravity, Cursor…)

> Document de mise au courant rapide pour toute session IA future.
> Donne le contexte produit, technique et l'historique des décisions clés
> sans qu'il soit nécessaire de relire tout le code ou les anciens docs.

**Dernière mise à jour :** 1er juillet 2026 — MOTEUR DE VENTE DURCI (voir §0bis)

---

## 0bis. ⚡ MISE À JOUR 1ER JUILLET 2026 — LE MOTEUR DE VENTE (lire avant de toucher au flux WhatsApp)

**Principe cardinal : L'IA PROPOSE, LE SERVEUR DISPOSE.** Un méga-audit a révélé
que la négociation IA n'était pas câblée aux commandes (prix public toujours facturé),
que le stock n'était JAMAIS décrémenté, que la livraison n'entrait pas dans les totaux,
et que l'état WAITING_FOR_ADDRESS aspirait n'importe quel texte comme adresse.
Tout est corrigé via un moteur central :

- **`backend/src/services/whatsapp/salesEngine.ts`** — logique PURE testée (30 tests,
  `npm test` dans backend/) : contexte inventaire unique (avec `id:` produit),
  parsing des tags `[ADD_TO_CART: productId | qty | prix_unitaire]` émis par l'IA,
  `validateDeal` (plancher = minPrice sinon marge, clamp au prix public, stock,
  quantités bornées), zones de livraison depuis l'adresse, heuristiques
  annulation/question/adresse.
- **Protocole IA** (aiService) : quand le client confirme l'achat, l'IA émet le tag
  ADD_TO_CART avec le PRIX NÉGOCIÉ. Le serveur revalide TOUT ; si l'IA promet sous
  le plancher → message correctif automatique + activity log warning.
  `detectPurchaseIntent` supprimé → **1 seul appel Gemini par message** (au lieu de 2).
- **flowHandler** : échappatoires d'état ("annuler" partout ; une question pendant
  l'attente d'adresse est répondue par l'IA au lieu de devenir l'adresse) ;
  à l'adresse → zone matched → **livraison incluse dans le total** (ligne d'article
  `_delivery` visible dans le dashboard) ; l'historique n'est PLUS effacé après commande.
- **Stock atomique** : `database/migrations/add_adjust_stock_rpc.sql` (fonction
  plpgsql `adjust_stock`, verrou FOR UPDATE, gère le stock par option de variation).
  ⚠️ **À APPLIQUER dans Supabase SQL Editor** — en attendant, fallback JS non-atomique
  loggé. Décrément à la commande, restock à l'annulation (updateOrderStatus).
- **File par conversation** (messageHandler) : messages d'un même client sérialisés,
  réponse polie en cas de crash.
- **Reçus** : matching tolérant (total exact OU articles+zone configurée si la zone
  était inconnue au checkout — jamais un sous-paiement) + extraction du DESTINATAIRE
  du reçu, remontée au vendeur (« vérifiez que c'est bien VOTRE compte »).
- **Simulateur** (Réglages → Mon Bot, `/api/ai/simulate`) : passe désormais par le
  VRAI `handleFlow` en mode `dryRun` (faux socket) — aucune divergence possible
  entre le bot testé et le bot déployé, mais aucune commande/stock réels touchés.

---

## 0. ⚡ MISE À JOUR 11 JUIN 2026 — LIRE EN PREMIER (remplace les infos périmées plus bas)

**Les 3 documents de référence, dans l'ordre :**
1. CE fichier (contexte général + conventions)
2. **`VIABILITE.md`** ← l'état réel du produit, case par case, et le plan d'action. C'EST LE TODO OFFICIEL.
3. `CLAUDE_ROADMAP.md` (journal détaillé des sessions)

**Corrections aux sections plus bas (devenues fausses) :**
- §5.E2 "Screenshot Validator pas implémenté" → **FAUX, il est implémenté ET durci** : `paymentValidationService.ts` (auto-PAID sur reçu Wave/OM + anti-réutilisation de reçu par transactionId).
- §6bis.7 "tenant orphelin en boucle" → max-retries + watchdog implémentés dans `sessionManager.ts`.
- §6bis.4 "PM2 startup pas confirmé" → **FAIT** le 11/06 (`pm2-alex.service` systemd actif + `pm2 save`).
- "Marketing UI mockée" → **la Diffusion est RÉELLE** (`marketingRoutes.ts` : broadcast Baileys avec délai anti-ban 2-5s, audiences all/vip/recent, stats). Codes promo retirés de l'UI (toujours pas codés backend).
- Pricing Business = **15 000 FCFA** (tranché par Alex, landing corrigée).
- La base Supabase a été **vidée puis recréée** : le tenant actuel d'Alex est `ad3339d0-882d-4fe2-924d-4c6b90648f2f` (boutique "oubinshop", compte anadorbreak@gmail.com). L'ancien tenant du §roadmap n'existe plus.

**Nouveautés majeures du 11/06 (toutes en prod) :**
- **Interrupteur global du bot** : `settings.bot_active` (défaut FALSE — un nouveau compte doit activer son bot). En pause : messages enregistrés (Inbox) mais AUCUNE réponse, ni relance panier, ni validation de reçu. Toggle sur la page Aujourd'hui.
- **Le bot envoie les photos produits** : contexte inventaire enrichi (minPrice/stock/images/consignes) + parsing des tags `[IMAGE: url]` dans `flowHandler.ts`. Sécurité : URLs limitées à l'inventaire du tenant.
- **"Photo d'abord"** : POST `/api/ai/analyze-product-photo` (Gemini Vision) pré-remplit nom+description dans ProductFormModal. Galerie placée EN PREMIER dans le formulaire.
- **Pagination** `?page=&limit=` sur /api/orders et /api/products (sans params = legacy).
- **Limite plan Starter : 50 produits** (403 PLAN_LIMIT_REACHED au-delà) — la raison d'upgrader.
- **Watchdog reconnexion WhatsApp** : après 5 échecs rapides, retente toutes les 5 min + **alerte email au owner** (`sendBotDownAlert`, max 1/h).
- **Pages légales** : `/conditions` + `/confidentialite` (`pages/Legal.tsx`) + mention reCAPTCHA footer.
- **FAQ in-app** : Réglages → Compte → Aide & support.
- **Checklist nouveau vendeur** sur Aujourd'hui (WhatsApp → produit → activer le bot).
- **Capacitor iOS + Android** : `frontend/ios/`, `frontend/android/`, scripts `ios:sync`/`ios:open`/`android:sync`/`android:open`, guide `IOS_SETUP.md`. apiConfig détecte Capacitor → API prod. CORS autorise `capacitor://localhost`.
- **Backup nocturne des sessions WhatsApp** : cron 3h sur le VPS (`scripts/backup_wa_auth.sh`, rotation 7j, vers `/home/alex/backups/`).
- **`wipe_db.ts`** exige `WIPE_CONFIRM=OUI_TOUT_EFFACER` (il a déjà vidé la prod une fois).
- **Migration RLS prête mais PAS appliquée** : `database/migrations/enable_rls_defense_in_depth.sql` — lire ses prérequis AVANT d'appliquer (vérifier que le .env VPS utilise la clé service_role), tester le dashboard immédiatement après.

**Bloquants connus (voir VIABILITE.md pour le détail) :**
- Resend sans domaine → les emails de vérification ne partent QUE vers anadorbreak@gmail.com. Bloquant n°1 pour les testeurs.
- Paystack en clés TEST → personne ne peut payer d'abonnement.
- SMS Firebase cassé (`auth/error-code:-39`, config projet AI Studio) — pistes en §6bis.0.
- `support@djassabot.com` affiché dans la FAQ/CGU n'existe pas encore (à créer avec le domaine).

---

## 1. Le produit en une phrase

**DjassaBot** est un SaaS qui transforme le numéro WhatsApp d'un vendeur ivoirien
en machine de vente automatique. Une IA (Gemini) reçoit les messages des clients,
présente les produits, négocie, prend les commandes, valide les paiements Wave/OM,
puis le vendeur livre. *"Encaisse pendant que tu dors."*

**Cible** : commerçants de Côte d'Ivoire (vendeurs de bazin, mèches, sneakers,
restos, friperies). Mobile-first. Pas tech-savvy. Vendent déjà via WhatsApp.

**Pricing** (cf. `docs/PRICING_STRATEGY.md`) :
- Starter 5 000 FCFA/mois — 500 conv IA / 50 produits
- Pro 10 000 FCFA — 2 000 conv / produits illimités
- Business 15 000 FCFA — illimité, multi-agents

---

## 2. Stack & architecture

```
┌─ frontend/ ────────────────────────────────────────┐
│  React 19 + Vite 7 + TailwindCSS v4                │
│  React Router 7 — lazy-loaded routes               │
│  PWA déjà configurée (vite-plugin-pwa)             │
│  Déployé sur Vercel — push to main = redeploy auto │
└────────────────────────────────────────────────────┘
┌─ backend/ ─────────────────────────────────────────┐
│  Node.js + Express + TypeScript                    │
│  Baileys → WhatsApp Web (pas d'API Meta payante)   │
│  Gemini 2.5 Flash (cerveau IA + Vision)            │
│  firebase-admin → vérification serveur des OTP     │
│  Supabase (Postgres + Auth + RLS)                  │
│  Paystack (paiements abonnements SaaS)             │
│  Resend (emails transactionnels)                   │
│  Déployé sur VPS Hostinger Ubuntu via PM2          │
└────────────────────────────────────────────────────┘
```

### Détails infra VPS (mai 2026)

- **Host** : `187.77.171.44` (alias Hostinger : `srv1679088.hstgr.cloud`)
- **OS** : Ubuntu (Linux 6.8.0-111)
- **User backend** : `alex` (PAS root)
- **Path backend** : `/home/alex/djassabotSaas/`
- **Process manager** : **PM2** installé sous le user `alex` (pas visible si tu fais `pm2 list` en root)
- **App PM2** : `djassabot-backend` (id 0, fork mode)
- **Logs PM2** : `/home/alex/.pm2/logs/djassabot-backend-{out,error}.log`
- **Port** : 3000
- **Auto-restart** : oui (PM2 redémarre si crash)
- **Auto-start au reboot** : ⚠️ pas confirmé — `pm2 startup` peut-être pas activé

### Comment se connecter au VPS depuis le Mac d'Alex

```bash
ssh alex@187.77.171.44   # clé SSH déjà configurée, passwordless
```

### Comment redéployer le backend après un push git

```bash
ssh alex@187.77.171.44
cd /home/alex/djassabotSaas
git pull origin main
cd backend && npm install && npm run build
pm2 restart djassabot-backend
pm2 logs djassabot-backend --lines 30  # vérifier
```

### Aussi sur le VPS

- **n8n** tourne en Docker (`n8n` container) sur le même VPS
- Probablement utilisé pour des automatisations marketing/CRM

**Auth utilisateurs vendeurs** : email + password OU téléphone + OTP (Firebase Phone Auth).
**Auth des clients du vendeur** : aucune — ils discutent juste sur WhatsApp.

**Important** : on est *multi-tenant*. Chaque vendeur = un tenant. Les commandes,
produits, settings sont scopés par `tenantId`. Les rôles `OrderStatus`, `Order`,
etc. vivent dans `backend/src/types/index.ts`.

---

## 3. Structure frontend (après refonte)

```
/dashboard               → Today (page d'accueil opérationnelle)
/dashboard/analytics     → Overview (graphes détaillés, ex-home)
/dashboard/inbox         → Conversations WhatsApp live
/dashboard/orders        → Commandes (avec filtres ?filter=new|paid|done|cancelled)
/dashboard/products      → Catalogue
/dashboard/settings      → 4 onglets : Mon Bot · Ma Boutique · WhatsApp · Compte

/dashboard/marketing     → Caché du menu (route conservée, à réactiver plus tard)
/dashboard/whatsapp      → Route conservée pour les liens directs, mais
                           accessible via Settings → WhatsApp
/dashboard/subscription  → Idem, accessible via Settings → Compte
```

**Navigation latérale (5 items)** : Aujourd'hui · Conversations · Commandes · Produits · Réglages.
**Bottom-nav mobile** : 5 items pareil. Indicateur `🟢 Bot actif` toujours visible.

---

## 4. Design system (très important)

**Aligné sur la landing page**, style Vercel/minimal :

| Élément | Valeur |
|---|---|
| Fond global | `bg-black` (`#000000` pur, jamais de teinte navy) |
| Cartes / surfaces élevées | `bg-[#111]` |
| Bordures | `border-[#1a1a1a]` |
| Texte primaire | `text-white` |
| Texte muted | `text-[#888]` |
| Texte plus muted | `text-[#555]` |
| Texte très muted | `text-[#444]` |
| Accent principal | `#00D97E` (vert solide — **jamais en gradient**) |
| Accent secondaire info | `#0EA5E9` (utilisé avec parcimonie) |
| Hover bg | `hover:bg-[#1a1a1a]` ou `hover:bg-[#111]` |

**À NE PAS faire** :
- ❌ Dégradés `from-[#00D97E] to-[#0EA5E9]` (style "startup tech" — banni)
- ❌ Fond navy `#020B18`, `#0D1117`, `#05070a` (legacy, retiré partout)
- ❌ `text-slate-*`, `text-zinc-400/500`, `text-gray-400/500` (utiliser `#888`)
- ❌ Bordures `border-white/5` (invisibles sur noir, utiliser `#1a1a1a`)
- ❌ Apostrophes typographiques dans les strings JS (utiliser `\'` ou `"`)

**À faire** :
- ✅ `bg-[#00D97E] text-black` pour les CTAs (vert solide sur fond noir = signature)
- ✅ Logo : carré vert avec **D** noir, à côté de `DJASSA<span class="text-[#00D97E]">BOT</span>`
- ✅ Cartes au repos : `bg-[#111] border border-[#1a1a1a]`, hover : `border-[#00D97E]/20`
- ✅ Status badges colorés avec opacité 10/20 : `bg-amber-500/10 text-amber-500 border-amber-500/20`

---

## 5. Décisions produit prises pendant la session de refonte

### A. Restructuration nav : MODULES → TÂCHES

L'ancien menu listait des modules (Produits, Marketing, Settings...) façon Shopify.
Mais le vendeur ne se réveille pas avec un "module" à ouvrir. Il a 3 questions :
- *"Y a quoi à faire MAINTENANT ?"*
- *"Mon bot bosse bien ?"*
- *"Où en est ma boutique ?"*

→ Nouvelle home **"Aujourd'hui"** = centre d'opérations avec 3 sections :
1. **À faire maintenant** (task cards cliquables vers commandes filtrées)
2. **Le bot travaille** (logs + dernière vente)
3. **Aujourd'hui en chiffres** (CA, commandes, delta vs hier)

Plus alerte rouge si bot WhatsApp déconnecté.

### B. Settings : 6 sous-pages → 4 onglets

| Avant | Après |
|---|---|
| Mon Profil | **Compte** (profil + abonnement intégré) |
| Identité, Personality, Toggles, Advanced | **Mon Bot** (+ test bot inline collapsible) |
| Business, Logistics | **Ma Boutique** |
| WhatsApp Connect (top-level) | **WhatsApp** (sous Settings) |
| Subscription (top-level) | *(intégré dans Compte)* |
| Test & Simulation (onglet séparé) | *(intégré dans Mon Bot)* |

### C. Commandes : 6 statuts → 4 statuts (workflow réel)

**Décision produit clé.** Les vendeurs ciblés ont un livreur dans le quartier
qui livre en 30 min. Pas besoin de tracker un "shipping en cours".
La distinction PENDING/CONFIRMED n'apporte rien : tant que pas payée, c'est
juste *"une commande qui attend"*.

**Workflow exposé** :
```
🟡 NOUVELLE ──► 🟢 PAYÉE ──► ✅ LIVRÉE
       │
       └──► ❌ ANNULÉE
```

**Backend conservé** (6 statuts pour rétrocompat) avec mapping UI :
- `PENDING` + `CONFIRMED` → **NOUVELLE**
- `PAID` + `SHIPPING` → **PAYÉE**
- `DELIVERED` → **LIVRÉE**
- `CANCELLED` → **ANNULÉE**

Cf. `frontend/src/pages/Orders.tsx` fonction `toUIStatus()`.

**Actions vendeur** (seulement 2 transitions) :
- Sur NOUVELLE → bouton *"Marquer payée"* ou *"Annuler"*
- Sur PAYÉE → *"Envoyer au livreur"* (copie message formaté) + *"Marquer livrée"*

### D. Marketing : UI cachée, mais backend partiellement actif ⚠

**Important nuance** (corrigée après audit de mai 2026) :

La page UI Marketing (`frontend/src/pages/Marketing.tsx`) est mockée — les
forms broadcast/coupons n'envoient rien et les compteurs sont à 0.

**MAIS** côté backend, le service paniers abandonnés fonctionne réellement :
- `backend/src/services/abandonedCartService.ts`
- `backend/src/jobs/abandonedCart.ts` (cron lancé au startup)
- Détecte les sessions WAITING_FOR_ADDRESS > 30 min
- Envoie un message de relance automatique via WhatsApp/Baileys

Donc les paniers abandonnés SONT relancés. Le vendeur ne le voit juste pas
dans son dashboard.

→ Route UI conservée (`/dashboard/marketing`) mais retirée du menu nav.
→ Pour rétablir, soit :
  (a) brancher la UI sur le backend existant (afficher relances exécutées + permettre config délai/message)
  (b) implémenter en plus broadcast + coupons (manquants côté backend)

Broadcast et coupons sont 100% à coder backend si on les veut.

### E1. Firebase Phone OTP — sécurisation serveur + setup réel (session mai 2026)

**Contexte projet Firebase** :
- Projet Firebase : `gen-lang-client-0191931206` (nom interne `fresh api kay` / "kay")
- Web app : `DjassabotWeb`, appId `1:699530305094:web:54b857307688df7f2ff447`
- Plan : **Blaze** (pay-as-you-go) — requis pour les vrais SMS en prod
- Phone provider : activé
- Régions SMS autorisées : Côte d'Ivoire, Burkina, Mali, France
- Quota SMS : 1000/jour (limite par défaut sur compte Blaze récent)

**Faille colmatée** :
Le backend faisait confiance aveugle au flag `{ phoneVerified: true }` envoyé
par le client. Un attaquant pouvait créer un compte pour n'importe quel
numéro sans recevoir de SMS.

**Fix** :
- `backend/src/services/firebaseAdminService.ts` créé
- Endpoint `/auth/signup` et `/auth/forgot-password-phone` exigent maintenant
  un `phoneIdToken` (Firebase ID token obtenu après `confirmationResult.confirm()`)
- Le backend appelle `admin.auth().verifyIdToken(idToken)` et vérifie que le
  `phone_number` du token décodé match exactement le `phone` envoyé
- Sans ces conditions → 401 (token invalide) ou 503 (Firebase Admin pas configuré)

**Service account côté VPS** :
- Fichier : `/home/alex/djassabotSaas/backend/firebase-admin-key.json`
- Permissions : `chmod 600`, owner `alex:alex`
- Ajouté à `.gitignore` (ne JAMAIS commit)
- Référencé dans `.env` via : `FIREBASE_SERVICE_ACCOUNT_PATH=/home/alex/djassabotSaas/backend/firebase-admin-key.json`
- Le service backend supporte aussi `FIREBASE_SERVICE_ACCOUNT_JSON` (inline) pour les PaaS

**Côté frontend** :
- 7 variables `VITE_FIREBASE_*` sur Vercel (Production + Preview)
- ⚠️ Les variables Vercel **NE sont PAS marquées "Sensitive"** (sinon impossibles à vérifier après création)
- Le `apiKey` Firebase web n'est pas un secret au sens admin — c'est un identifiant client public, OK de le partager
- reCAPTCHA en mode **invisible** (cohérent Signup + ForgotPassword)
- Domaine `djassabot-saas.vercel.app` ajouté dans **Authorized domains** (Firebase Auth → Settings)

**Important pour le multi-tenant Firebase** :
Le `projectId` côté frontend (`VITE_FIREBASE_PROJECT_ID`) **DOIT être identique** au
`project_id` dans la service account JSON côté backend. Sinon : le client génère
un token pour le projet X, le backend essaie de le vérifier avec les credentials
du projet Y → fail. C'est `gen-lang-client-0191931206` des deux côtés.

**État opérationnel à la fin de session** :
- Backend Firebase Admin : ✅ initialisé (vu dans les logs `[FirebaseAdmin] Initialized`)
- Frontend config : ✅ déployé sur Vercel avec les bonnes valeurs
- Vrais SMS : ⚠️ **NON validé end-to-end**. Dernier test → erreur `auth/error-code:-39`
  hypothèse rate limit anti-abus Firebase (suite à plusieurs tentatives en série
  avec le numéro `+225 0777225277` qui était whitelist test précédemment).
  Test à reprendre après 15+ min sans tentative.

**Numéro test à éviter** :
Le numéro `+225 0777225277` a été retiré de la liste "Phone numbers for testing"
mais peut rester suspect côté anti-abus Firebase pendant quelques heures.
Pour tester proprement : utiliser **un autre numéro CI** au premier essai propre.

### E2. Screenshot Validator (ARME #1 vision stratégique)

État réel : **pas implémenté en backend**. Le code dans `aiService.ts` mentionne
*"IF IT'S A PAYMENT RECEIPT: Extract amount and Transaction ID"* mais c'est juste
l'IA qui le dit dans la conv — aucune mise à jour automatique de `Order.status`
vers `PAID` après validation d'un screenshot Wave/OM.

→ Pour l'instant, vendeur clique *manuellement* "Marquer payée".
→ Pas de page UI dédiée nécessaire : le statut paiement vit sur la commande
   (décision du user : "si l'IA fait son taf, le vendeur n'a rien à faire").
→ **Dette technique** : coder en backend la détection screenshot + auto-update
   du statut quand l'IA valide à 100%. À discuter quand on attaque cette feature.

---

## 6. Roadmap session (état actuel)

```
✅ ÉTAPE 1 — Page Aujourd'hui + nav 5 items + Marketing caché
✅ ÉTAPE 2 — Settings 5→4 onglets, Abonnement intégré
✅ ÉTAPE 3 — Orders simplifiée 6→4 statuts, filtres URL
✅ FIX     — Login + Signup + autres : retrait dégradés legacy bleu/vert
✅ AUDIT   — Code mort backend supprimé, lint clean, pipeline IA validé
✅ SÉCU    — Firebase Admin SDK + vérification serveur des OTP
✅ INFRA   — Backend migré sur VPS Hostinger via PM2 (n'est plus sur Railway)
✅ LANDING — Animations Emil Kowalski (stagger, scroll reveal, micro-interactions)
✅ UX      — reCAPTCHA passé en mode invisible (UX cohérente)
⏳ TEST    — Validation end-to-end signup SMS réel (rate limit Firebase à attendre)
⏳ ÉTAPE 4 — PWA install (manifest custom + icônes branded + prompt)
```

**Reste backlog connu** :
- PWA polish (icônes 192/512, splash screen, install prompt UI)
- Screenshot Validator backend (auto-update vers PAID après validation Gemini Vision)
- Marketing UI : brancher sur abandoned cart backend + coder broadcast/coupons
- Notifications push (PWA + service worker, le bot déconnecté devrait notifier)
- Domaine pour Resend (emails actuellement limités à anadorbreak@gmail.com)
- Test complet flow signup Firebase Phone OTP

---

## 6bis. Audit technique (mai 2026) — dette identifiée

**Faits avant la PWA** :
- ✅ Suppression 5 fichiers backend morts (Cloud API Meta abandonnée) :
  `webhookController.ts`, `webhookRoutes.ts`, `whatsappService.ts` (racine),
  `notificationService.ts` (racine), `paymentService.ts`
- ✅ Fix lint Signup.tsx (ternaires en statement → if/else)
- ✅ Fix warnings hooks Today.tsx (deps useMemo)

**Reste à faire (par priorité)** :

0. **🚨 BLOQUANT — `auth/error-code:-39` persistant sur signup phone**

   **État** : 2h+ après dernière tentative, l'erreur persiste même en
   navigation privée avec le bon code (reCAPTCHA invisible déployé,
   confirmé visuellement par le badge "protection par reCAPTCHA").
   Donc ce n'est PAS un rate limit transitoire ni un cache. C'est
   structurel à la config Firebase du projet.

   **Indice clé** : le projet Firebase s'appelle `gen-lang-client-0191931206`
   — nom auto-généré par Google AI Studio. Ces projets sont créés pour
   Gemini API et peuvent avoir des configurations Firebase Auth
   différentes des projets Firebase classiques (App Check obligatoire,
   reCAPTCHA Enterprise requis, Identity Platform mode activé, etc.).

   **2 pistes à explorer demain** (dans l'ordre) :

   **Piste A — Diagnostic via Google Cloud Logging** (10 min, rapide)
   1. Google Cloud Console → Logging → Logs Explorer
   2. Filtre : `resource.type="identitytoolkit_tenant"` ou
      `protoPayload.serviceName="identitytoolkit.googleapis.com"`
   3. Time range : dernière heure
   4. Trouver les logs liés à `sendVerificationCode` ou `verifyPhoneNumber`
   5. Voir l'erreur EXACTE (le `-39` est juste un code interne, le vrai
      message est dans le payload Cloud)
   6. Adapter en fonction

   **Piste B — Configurer reCAPTCHA Enterprise** (15 min, fix probable)
   1. Firebase Console → Authentication → Settings → reCAPTCHA
   2. Cliquer "Gérer reCAPTCHA" (redirige vers Google Cloud Console)
   3. Créer une clé reCAPTCHA Enterprise pour le domaine
      `djassabot-saas.vercel.app`
   4. Mode "Audit" d'abord (log mais ne bloque pas) puis "Enforce"
   5. Revenir dans Firebase Auth Settings → activer la défense reCAPTCHA
   6. Retester signup

   **Piste C nuclear option — Créer un nouveau projet Firebase propre**
   Si A et B échouent, c'est probablement que `gen-lang-client-0191931206`
   est trop bridé. Créer un projet `djassabot-prod` depuis Firebase Console
   directement (PAS depuis Google AI Studio), refaire le service account,
   les vars Vercel, le `.env` VPS. ~30 min mais propre.

   **Numéro suspect** : `+225 0777225277` était dans la liste de test
   précédemment. Tester avec un AUTRE numéro CI au premier essai propre.

   **Note** : tout le code (frontend + backend) est correct et déployé.
   Le blocage est uniquement côté config Firebase Console.

1. **🔴 RLS Supabase désactivée de fait** — toutes les policies sont
   `using (true) with check (true)` dans `supabase_full_schema.sql`.
   Fonctionnel car backend filtre `tenantId` à la main, mais zéro
   defense-in-depth. À refaire avec `auth.uid()` ou JWT claims.

2. **🟡 Incohérence `apiClient`** — seul `Orders.tsx` utilise
   `utils/apiClient.ts` (qui gère 401 → logout global via custom event
   `auth:unauthorized`). Les 14 autres pages utilisent `fetch` direct.
   Migrer toutes les pages vers `apiClient` (~2h).

3. **🟡 Bundle frontend lourd sur 3G CI** — 287 KB gzip total dont 169 KB
   pour `@supabase/supabase-js` utilisé seulement pour `supabase.storage`
   (uploads images). Solution : upload via backend (POST /products/upload
   → backend utilise service role → return URL) → drop le client Supabase
   du bundle frontend.

4. **🟡 PM2 startup au reboot VPS** — vérifier que `pm2 startup` + `pm2 save`
   sont activés, sinon le backend ne redémarre pas après un reboot serveur.

5. **🟢 Table `customers` créée dans schéma mais jamais utilisée**.
   Soit on l'exploite (CRM léger : nb commandes par client, panier moyen,
   utile pour broadcast ciblé), soit on la drop.

6. **🟢 Console.log à nettoyer** — ProductDetail 8x, Settings 5x, Inbox 5x.
   Plugin `vite-plugin-strip` pour build prod.

7. **🟢 Tenant orphelin** `3b7d4665-0e25-48a3-bd7e-f1a0c8585b56` — boucle
   de reconnexion WhatsApp permanente dans les logs PM2 (raison 408,
   reconnect en boucle). Soit nettoyer ce tenant, soit ajouter un
   max-retry dans baileysManager.

8. **🟢 Badge "protégé par reCAPTCHA"** — Google affiche un petit badge
   en bas à droite avec reCAPTCHA invisible. Conforme aux CG mais peut
   être masqué via CSS + ajout d'une mention textuelle dans le footer
   ("Ce site est protégé par reCAPTCHA et la politique de confidentialité
   et les conditions d'utilisation de Google s'appliquent.")

---

## 7. Endpoints backend utiles

```
GET    /orders                       liste des commandes du tenant
PUT    /orders/:id/status            change le statut (PENDING/CONFIRMED/PAID/...)
GET    /chats                        liste conversations WhatsApp
GET    /dashboard/pulse              événements live (sales, warnings, actions)
GET    /dashboard/recent-orders      dernières commandes
GET    /whatsapp/status              statut bot ('disconnected'|'connecting'|'connected')
POST   /whatsapp/pair-code           génère code de jumelage par numéro
POST   /whatsapp/logout              déconnecte le bot
GET    /settings                     config bot/business du tenant
POST   /settings                     sauvegarde config
GET    /auth/me                      user + tenant info
PUT    /auth/me                      update profil utilisateur
POST   /ai/summarize-identity        synthèse IA de la config bot
POST   /paystack/create-subaccount   setup compte paiement vendeur
```

---

## 8. Conventions & gotchas

**Apostrophes typographiques** — Tailwind / JSX peut casser sur `d'une`, écrire `d\'une` ou utiliser `"`.

**StrictMode + useEffect** — `Inbox.tsx` et `WhatsAppConnect.tsx` ont une logique
de polling/cleanup déjà robuste. Ne pas casser le pattern `useEffect` avec `clearInterval` au cleanup.

**Firebase Phone Auth** — Le `RecaptchaVerifier` doit être nettoyé au unmount
(cf. `ForgotPassword.tsx` ligne 35-48). React StrictMode double-mount sinon plante.

**Onboarding** — `frontend/src/pages/Onboarding.tsx` est long (skip pendant la lecture si pas besoin).
Géré séparément du dashboard, déclenché si `tenant.onboarding_completed === false`.

**Routing protégé** — Toutes les routes `/dashboard/*` sont sous `<ProtectedRoute />`.
Si `!isAuthenticated` → redirect `/login`.

**API client** — Utiliser `apiClient` (`utils/apiClient.ts`) qui auto-injecte le token et
gère 401 → logout. NE PAS utiliser `fetch` direct sauf cas où on a besoin du contrôle bas-niveau.

**Toasts** — `react-hot-toast`, importé là où utilisé, déjà setup dans le layout.

---

## 9. Comment travailler avec le user

- Le user (Alex) parle français avec parfois transcription voix → phrases parfois
  un peu cassées syntaxiquement, mais le fond est toujours clair.
- Il préfère qu'on lui demande son avis sur les **décisions produit stratégiques**
  AVANT de coder, mais qu'on exécute vite une fois qu'il a tranché.
- Il aime les **tableaux comparatifs avant/après** et les recap visuels.
- Il dit "continue" / "vazy" / "on enchaîne" pour valider et passer à la suite.
- **Mobile-first** : il regarde toujours le résultat sur son iPhone après push Vercel.
- Quand il dit "ça marche", c'est validé, on passe à la suite.

**Bonnes pratiques observées** :
- Commits en français avec corps détaillé expliquant le *pourquoi*
- Push direct sur `main` → Vercel redéploie auto (pas de branches/PR pour le dev solo)
- `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` à la fin de chaque commit
- Pas de `git config --global --edit` (le warning sur committer mismatch est ignoré)

---

## 10. Skills installés (Claude Code agentic skills)

Alex a installé une vingtaine de skills agentic qui peuvent être invoqués via
le tool `Skill` quand pertinent. Les plus utiles pour ce projet :

| Skill | Usage |
|---|---|
| `emil-design-eng` | Animations / micro-interactions Emil Kowalski (déjà appliqué sur LandingPage) |
| `impeccable` | Critique design + polish UI |
| `minimalist-ui` | Confirme notre direction style éditorial minimal |
| `sleek-design-mobile-apps` | Pour la PWA mobile |
| `redesign-existing-projects` | Pour refonte de pages existantes |
| `frontend-design` | Composants distinctifs |
| `supabase-postgres-best-practices` | Pour le fix RLS futur |
| `security-best-practices` | Audit sécurité |
| `extract-design-system` | Si on veut documenter le DS |

**Animations LandingPage appliquées (Emil Kowalski framework)** :
- Tokens motion CSS dans `src/index.css` : `--ease-out-strong`, `--ease-in-out-strong`, `--ease-drawer`
- Hook `src/hooks/useInView.ts` pour scroll-triggered reveals
- Composant `<Reveal />` wrapper utilisé sur Stats / Features / Pricing / CTA band
- `.reveal-stagger` pour cascade au mount (Hero)
- `.stagger-child` pour cascade enfants au scroll
- `.ambient-blob` radial-gradient drift 24s opacity 0.04 (Hero + CTA band)
- Tous CTAs : `active:scale-[0.97]` + custom easing
- Cards features : `hover:-translate-y-0.5`
- `prefers-reduced-motion` respecté

---

## 11. Fichiers à lire si besoin d'approfondir

- `docs/PROJECT_BRIEF.md` — résumé exécutif initial
- `docs/PRICING_STRATEGY.md` — modèle économique détaillé
- `docs/STRATEGIC_VISION_2026.md` — les 3 "armes secrètes" produit
- `docs/ARCHITECTURE_SAAS.md` — détail technique multi-tenant
- `frontend/src/pages/Today.tsx` — référence du design system unifié
- `frontend/src/pages/Orders.tsx` — référence du workflow simplifié
- `frontend/src/pages/LandingPage.tsx` — référence visuelle du style attendu + animations Emil
- `frontend/src/index.css` — tokens motion + classes utilitaires reveal/stagger
- `frontend/src/hooks/useInView.ts` — IntersectionObserver pour scroll reveals
- `backend/src/services/firebaseAdminService.ts` — vérification serveur OTP
- `backend/src/types/index.ts` — types canoniques (Order, User, Tenant…)

---

*Ce document est volontairement court et opérationnel. Si tu reprends ce projet
dans une autre session, lis CECI en priorité avant d'aller fouiller le code.*
