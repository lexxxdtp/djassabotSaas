# DjassaBot — Briefing Claude

> Document de mise au courant rapide pour toute session Claude future.
> Donne le contexte produit, technique et l'historique des décisions clés
> sans qu'il soit nécessaire de relire tout le code ou les anciens docs.

**Dernière mise à jour :** mai 2026 — fin session refonte UX vendeur

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
│  Supabase (Postgres + Auth + RLS)                  │
│  Paystack (paiements abonnements SaaS)             │
│  Resend (emails transactionnels)                   │
│  Déployé sur Railway                               │
└────────────────────────────────────────────────────┘
```

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

### D. Marketing : caché du menu (vaporware)

La page Marketing existait avec broadcast/coupons/paniers abandonnés mais
**100% mockée** côté backend (forms qui n'envoient rien, compteurs à 0,
badge "ACTIF" sur du non-fonctionnel). Danger réel : le vendeur croit que
ses paniers abandonnés sont relancés, mais non.

→ Route conservée (`/dashboard/marketing`) mais retirée du menu nav.
À ressortir le jour où c'est vraiment implémenté en backend.

### E. Screenshot Validator (ARME #1 vision stratégique)

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
⏳ ÉTAPE 4 — PWA install (manifest custom + icônes branded + prompt)
```

**Reste backlog connu** :
- PWA polish (icônes 192/512, splash screen, install prompt UI)
- Screenshot Validator backend (auto-update vers PAID)
- Marketing réel (broadcast + paniers abandonnés en backend)
- Notifications push (PWA + service worker, le bot déconnecté devrait notifier)
- Domaine pour Resend (emails actuellement limités à anadorbreak@gmail.com)
- Test complet flow signup Firebase Phone OTP

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

## 10. Fichiers à lire si besoin d'approfondir

- `docs/PROJECT_BRIEF.md` — résumé exécutif initial
- `docs/PRICING_STRATEGY.md` — modèle économique détaillé
- `docs/STRATEGIC_VISION_2026.md` — les 3 "armes secrètes" produit
- `docs/ARCHITECTURE_SAAS.md` — détail technique multi-tenant
- `frontend/src/pages/Today.tsx` — référence du design system unifié
- `frontend/src/pages/Orders.tsx` — référence du workflow simplifié
- `frontend/src/pages/LandingPage.tsx` — référence visuelle du style attendu
- `backend/src/types/index.ts` — types canoniques (Order, User, Tenant…)

---

*Ce document est volontairement court et opérationnel. Si tu reprends ce projet
dans une autre session, lis CECI en priorité avant d'aller fouiller le code.*
