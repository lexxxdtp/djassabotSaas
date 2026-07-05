# 🔍 DjassaBot — Re-audit complet (v2)

> Deuxième passe d'audit, **5 juillet 2026** (Opus, niveau élevé), réalisée APRÈS avoir
> réglé les bloquants d'inscription. Contrairement à la v1, cette passe lit en profondeur
> le cœur métier (moteur de vente, stock, IA, DB) et vérifie l'état RÉEL en prod
> (VPS + Supabase + Vercel + Firebase), pas seulement les docs.
>
> **Correction importante vs v1 :** plusieurs "manques" de la v1 sont en fait déjà réglés
> (voir §2). L'enforcement d'abonnement, notamment, EXISTE désormais — mais partiellement.

Dossier audité : `/Users/alexvianneykoffi/djassabotSaas` — HEAD `e42d8bf`, working tree propre, tout pushé.

---

## 0. Verdict

**Le produit est prêt pour le test de mercredi.** Le cœur (inscription, bot IA, moteur de
vente, dashboard) est solide et vérifié. Ce qui reste n'est **pas bloquant pour un test
gratuit** : c'est de l'enforcement de monétisation et du durcissement post-test.

Note de qualité : le moteur de vente (`salesEngine` + `flowHandler` + `dbService` stock)
est **du très bon code** — stock atomique avec rollback, plancher de prix, échappatoires
d'état, file par conversation, ligne livraison exclue du stock partout. 30/30 tests passent,
lint clean. Rien à retoucher là-dedans avant le test.

---

## 1. ✅ Réglé pendant les sessions du 5 juillet (vérifié en réel)

| Point | Preuve |
|---|---|
| Emails d'inscription vers tout destinataire | Domaine `djassabot.com` vérifié sur Resend, `RESEND_FROM` posé sur le VPS, code reçu sur `lexxxdtp@gmail.com` (pas le compte owner) |
| SMS OTP (ex-bug `auth/error-code:-39`) | Projet Firebase propre `djassabot-prod` (Blaze, Téléphone activé, CI autorisée), testé avec un vrai numéro → connexion réussie |
| Email optionnel à l'inscription, téléphone obligatoire | `Signup.tsx` + backend acceptent déjà `email` absent |
| SMS prioritaire sur email à la vérification | `VerifyAccount.tsx` |
| Filet "Vérifier plus tard" | `VerifyAccount.tsx` + `ProtectedRoute.tsx` (flag `verificationSkipped`) |
| Design inscription (3 étapes) | Refonte via skills, cohérent avec le design system |
| VPS à jour + bot en ligne | `pm2` : `djassabot-backend` online, 1 tenant actif, Supabase+Firebase OK |

---

## 2. ✅ Dettes de la v1 qui étaient DÉJÀ réglées (le code a avancé)

La v1 les listait comme "à faire". Vérification faite, elles sont **résolues** :

- **Enforcement d'abonnement** : le middleware `checkSubscription` (`middleware/auth.ts`)
  existe ET est **branché sur toutes les routes du dashboard** (`index.ts` : whatsapp, chats,
  marketing, ai, orders, products, settings, dashboard…). Il renvoie **402
  `SUBSCRIPTION_EXPIRED`** si `subscription.status` = expired/cancelled OU si `expiresAt < now`.
  → Le dashboard EST donc coupé à l'expiration du trial. (Nuance importante en §3.)
- **`apiClient` partout** : 22 pages l'utilisent, **0 `fetch` direct** restant. (v1 disait "14 pages en fetch".)
- **`console.log` frontend** : **0** restant.
- **Bundle lourd** : le frontend n'importe **plus** `@supabase/supabase-js`. Les uploads
  passent par le backend (`POST /api/products/upload` → service_role). Aucune clé Supabase
  embarquée côté navigateur.
- **Migration stock atomique** `adjust_stock` : **appliquée et présente** en prod Supabase (4 params, vérifiée).
- **RLS** : n'est plus `using(true)`. Aujourd'hui **RLS activé sur 10/11 tables avec 0 policy**
  = refus par défaut pour la clé anon, et le backend en `service_role` bypasse → l'app marche
  et l'accès anon est verrouillé. C'est **plus sûr** que l'ancien état. (Reste un détail en §4.)

---

## 3. 🟠 Le vrai trou restant : enforcement d'abonnement ASYMÉTRIQUE

C'est le point le plus important de ce re-audit. L'enforcement existe **côté dashboard**
mais **pas côté bot**, et il manque le câblage UX.

1. **Le bot WhatsApp continue de vendre après expiration.** `messageHandler.ts` ne vérifie
   QUE `botActive`, jamais l'abonnement. Et `getActiveTenants()` démarre au boot tout tenant
   dont `status ∈ {active, trial}` — or **aucun cron ne bascule `tenant.status` en `expired`**.
   Donc un vendeur dont le trial a expiré : ne peut plus voir son dashboard (402), mais son
   bot répond toujours aux clients. Pour un SaaS, c'est l'inverse du levier voulu (on veut que
   le bot s'arrête pour pousser au paiement).
   → **À faire** : (a) check abonnement dans le flux bot (ou au démarrage de session), et
   (b) un cron quotidien qui passe les tenants expirés en `expired` + coupe la session Baileys.

2. **Le frontend ne gère pas le 402.** `apiClient` n'intercepte que le 401 (logout). Sur un
   402 `SUBSCRIPTION_EXPIRED`, les pages échouent en silence (état cassé) au lieu d'afficher
   un écran "Votre abonnement a expiré → renouveler". → Ajouter un handler 402 dans `apiClient`
   qui redirige vers un écran paywall.

3. **Paystack ne peut pas encaisser.** Sur le VPS, `PAYSTACK_SECRET_KEY` et les 3
   `PAYSTACK_PLAN_*` sont **VIDES** (pas juste "test" : rien). `initializeSubscription` lève
   donc une erreur (vu dans les logs : "Plan code not configured"). Et le webhook
   `subscription.disable` ne fait qu'un `console.log` (pas de propagation d'annulation).
   → **À faire pour encaisser** : clés live + créer les 3 plans (5 000/10 000/15 000) + coller
   les `PLN_...` + enregistrer le webhook + 1 vrai paiement de test. ⚠️ Vérifier aussi que
   Paystack encaisse bien en Côte d'Ivoire pour ton cas (mobile money), sinon plan B lien Wave.

**Aucun de ces 3 points ne bloque le test de mercredi** (les testeurs sont en trial gratuit,
30 jours) — mais les 3 sont à régler **avant d'ouvrir le paiement**.

---

## 4. 🟡 Important, non bloquant

- **Quota conversations/mois non implémenté** (500 Starter / 2 000 Pro / illimité). Un Starter
  peut consommer autant de Gemini qu'un Business. Seule la limite 50 produits Starter existe.
  → À coder avant le lancement payant (sinon marge non maîtrisée).
- **RLS "propre" pas en place** : les policies tenant-scopées (`auth.uid()`/JWT) ne sont pas
  écrites. État actuel sûr (default-deny + service_role) mais pas la defense-in-depth complète.
  Détail : la table **`carts` a le RLS désactivé** (exposition faible : état de panier transitoire).
- **Monitoring serveur absent** : si le VPS tombe à 3h, personne n'est alerté. Health check =
  juste `GET /` qui renvoie du texte. → UptimeRobot (gratuit) sur `https://187-77-171-44.nip.io/`, 10 min.
- **Pas de vue admin multi-tenant** pour Alex. Pour 10 testeurs, le Table Editor Supabase suffit.
- **`support@djassabot.com`** (affiché dans FAQ/CGU) : le domaine existe maintenant → l'adresse
  peut être créée (Hostinger/Resend). Toujours à faire.

---

## 5. 🟢 Dette légère / cosmétique (ignorer avant le test)

- Notifications push (commande reçue, bot déconnecté) : absentes. L'alerte **email** bot-down existe.
- `mockNegotiationLogic` (aiService) utilise un ancien format de contexte inventaire — code
  quasi-mort (ne se déclenche que sans clé Gemini, donc jamais en prod). À nettoyer un jour.
- Le prompt système IA est passé comme un faux tour "user" au lieu du champ natif
  `systemInstruction` de Gemini. Fonctionne, défenses anti-injection présentes ; durcissement mineur possible.
- `@google/generative-ai` est le SDK déprécié (remplacé par `@google/genai`). Fonctionne.
- Icônes PWA : OK (vrai logo posé). Rien à faire.

---

## 6. 📋 Plan

### Avant mercredi (test testeurs) — tout est prêt, juste à valider
1. Créer `support@djassabot.com`.
2. (Optionnel, 10 min) UptimeRobot sur l'API.
3. Test de bout en bout d'une VRAIE vente avec ta 2e puce : client écrit → bot négocie →
   commande au prix négocié → reçu Wave → statut → livraison. (Le code est prêt et testé
   unitairement ; reste à le voir tourner en conditions réelles une fois.)
4. Recruter les testeurs.

### Avant d'ouvrir le PAIEMENT (post-test)
5. Enforcement bot : couper le bot à l'expiration + cron qui passe les tenants en `expired`.
6. Handler 402 dans `apiClient` + écran paywall "renouveler l'abonnement".
7. Paystack live + 3 plans + webhook + vrai paiement (vérifier support CI mobile money).
8. Quota conversations/mois par plan.

### Durcissement (quand tu veux)
9. RLS tenant-scopé propre + activer RLS sur `carts`.
10. Nettoyage `mockNegotiationLogic`, migration `@google/genai`, prompt `systemInstruction` natif.

---

## 7. ❌ À ne pas faire

- ❌ Ne touche pas au moteur de vente / stock avant le test : c'est le code le plus solide du
  projet, chaque modif = risque de régression sur la partie qui fait rentrer l'argent.
- ❌ Ne passe pas Paystack en live dans la précipitation (testeurs = gratuit ; fais-le proprement après).
- ❌ N'écris pas les policies RLS tenant-scopées à la va-vite juste avant le test (risque de
  casser le dashboard si mal fait). L'état actuel est sûr.

---

*Résumé v2 : bien plus avancé que ne le disait la v1. Les 3 bloquants d'inscription sont
levés et vérifiés en réel. Le seul vrai chantier restant est l'enforcement d'abonnement
(bot + UX 402 + Paystack), et il n'est pas nécessaire tant que les testeurs sont en trial.
Tu peux lancer mercredi.*
