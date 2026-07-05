# 🚀 DjassaBot — Analyse d'optimisation (5 juillet 2026)

> Audit **en lecture seule** sur 3 axes demandés par Alex : **Vitesse/perf**, **UX/conversion**,
> **Qualité/robustesse**. Objectif : améliorer sans casser. Chaque item a une priorité, un effort
> estimé, et un niveau de risque. Rien ici n'est appliqué sans validation, SAUF les 2 gains
> "déjà faits" ci-dessous (non destructifs).
>
> Données mesurées réellement : build de prod (tailles gzip), index Supabase, chemins de code du bot.

---

## ✅ Déjà appliqué dans cette passe (sûr, non destructif)

- **Index `activity_logs (tenant_id, created_at desc)`** ajouté en prod. Cette table n'avait
  QUE sa clé primaire, alors que le dashboard "pulse" et les stats marketing la lisent par
  `tenant_id` triée par date, et chaque message/commande y écrit. Sans index = scan complet qui
  ralentit à mesure que les logs s'accumulent. Corrigé.
- *(Vérifié au passage : `orders`, `products`, `settings`, `subscriptions`, `users`, `carts` ont
  déjà leur index `tenant_id`. La table `sessions` est lue par clé primaire → déjà rapide, pas
  d'index à ajouter.)*

---

## ⚡ AXE 1 — Vitesse / performance

### ✅ P1 — RÉGLÉ : requêtes redondantes du bot à chaque message (backend)
`db.getSettings(tenantId)` était appelé 2 fois par message (`messageHandler` PUIS `flowHandler`),
et `getProducts` était re-fetché sur les messages image alors que `messageHandler` l'avait déjà lu
pour l'analyse de vision. Corrigé (commit `e8c5176`, déployé) : `handleFlow` accepte un paramètre
optionnel `preloaded` (settings/products), rétrocompatible avec les 2 appelants existants. Zéro
changement de comportement, juste moins d'allers-retours Supabase par message.

### 🟠 P2 — Cache court des données quasi-statiques (backend, risque faible)
`settings`, `products`, `subscription` d'un tenant changent **rarement** mais sont relus à chaque
message. Un cache mémoire par tenant avec TTL court (ex. 30–60 s), invalidé à la sauvegarde,
supprimerait la majorité des lectures répétées (dont le nouveau check d'abonnement que je viens
d'ajouter). Effort : moyen. Gain : latence + coût. À faire après P1.

### 🟠 P2 — Recharts = 99 kB gzip sur la page Analytics (frontend)
`vendor-charts` pèse **328 kB (99 kB gzip)** — le plus gros chunk de loin. Bonne nouvelle : il est
**lazy**, chargé UNIQUEMENT sur `/dashboard/analytics` (la page d'accueil `Today` et la landing ne
le paient pas — vérifié). Mais 99 kB pour un seul graphe, sur réseau CI, c'est lourd quand le
vendeur ouvre l'analyse. **Options** : (a) remplacer Recharts par une lib légère (ex. uPlot ~40 kB,
ou un graphe SVG maison ~5 kB), ou (b) l'accepter puisque c'est une page secondaire. Effort :
moyen. Gain : -90 kB gzip sur la page analytics.

### 🟢 P3 — Entrée principale `index` = 60 kB gzip
Le chunk d'entrée partagé fait 60 kB gzip (raisonnable mais pas léger). À investiguer avec un
visualiseur de bundle (`rollup-plugin-visualizer`) pour voir ce qui pourrait être encore
code-splitté. Effort : faible (diagnostic). Gain : incertain.

---

## 🎯 AXE 2 — UX / conversion

### 🔴 P1 — Le vendeur n'est PAS prévenu que son abonnement va expirer / a expiré
Aujourd'hui l'expiration se voit seulement en ouvrant le dashboard (402 → écran de renouvellement),
et le bot devient muet côté client. Un vendeur qui n'ouvre pas son dashboard ne comprend pas
pourquoi ses ventes s'arrêtent. **Fix** : email de relance J-3 et J-0 (Resend est déjà branché et
fonctionnel), + éventuellement un message WhatsApp au numéro du vendeur. Effort : faible. Gain :
rétention / réduction du churn involontaire.

### 🟠 P2 — L'écran "abonnement expiré" mène à un paiement non configuré
Le bouton "Choisir ce plan" appelle Paystack, dont les clés/plans sont **vides sur le VPS** → il
affichera une erreur. C'est honnête (on montre aussi le contact support), mais tant que Paystack
n'est pas configuré, le renouvellement self-service ne marche pas. **Fix** : configurer Paystack
(clés live + 3 plans + webhook), OU afficher explicitement "contactez-nous pour renouveler" tant
que ce n'est pas prêt. Lié à la monétisation. Effort : dépend de Paystack.

### 🟠 P2 — Différenciation des formules quasi inexistante
Starter/Pro/Business ne diffèrent aujourd'hui QUE par la limite 50 produits (Starter). Le quota
de conversations (500/2000/illimité) annoncé sur la landing n'est **pas implémenté**. Donc peu de
raison de passer au plan supérieur, et un risque de promesse non tenue. **Fix** : implémenter le
compteur de conversations/mois par tenant + le blocage/relance au dépassement. Effort : moyen.
Gain : cohérence de l'offre + levier d'upgrade. (Recoupe l'axe coûts.)

### 🟢 P3 — Test d'activation réel manquant
Le parcours "vendeur lambda → bot actif en < 10 min" (onboarding → WhatsApp → 1er produit →
activer le bot) est bien construit mais **jamais chronométré avec un vrai commerçant**. C'est LE
test de conversion à faire mercredi. Pas du code — de l'observation terrain.

---

## 🛡️ AXE 3 — Qualité / robustesse

### ✅ P1 — RÉGLÉ : le fallback `store.json` ne cause plus de "split-brain" de données (backend)
Trois points corrigés (commit `375d370`, déployé) :
- **`createOrder`** ne retombe plus silencieusement sur le fichier local si Supabase est configuré
  — l'erreur est remontée, ce qui ACTIVE une logique déjà écrite mais jusque-là morte dans
  `flowHandler.finalizeOrder` (restock automatique + message d'excuse au client). Le log d'activité
  "Nouvelle commande" est isolé dans son propre try/catch pour ne plus risquer de dupliquer/annuler
  une commande déjà créée avec succès si CETTE écriture secondaire échoue.
- **`deleteProduct`** ne retombe plus sur le local en cas d'échec Supabase — renvoie `false` au lieu
  de prétendre "supprimé" alors que le produit reste réel et vendable côté Supabase.
- **`verifyAuthToken`** : vrai bug corrigé — un retour anticipé empêchait le fallback local (écrit
  par `storeAuthToken`) d'être jamais consulté, rendant cette résilience prévue inopérante.

### 🟠 P2 — Code mort `mockNegotiationLogic` (aiService)
Utilise un ancien format de contexte inventaire, ne se déclenche que sans clé Gemini (donc jamais
en prod). À supprimer pour éviter la confusion. Effort : faible. Risque : nul.

### 🟢 P3 — 114 `any` dans le backend
Concentrés dans `dbService` (20), `authController` (12), `index` (10), Paystack. Pas critique mais
resserrer le typage (surtout autour des mappings Supabase snake_case↔camelCase) réduirait les bugs
silencieux. Effort : moyen, étalé. À faire opportunément.

### 🟢 P3 — Durcissements mineurs déjà notés dans l'audit
- Migrer `@google/generative-ai` (déprécié) → `@google/genai`.
- Prompt système passé comme faux tour "user" → utiliser le champ natif `systemInstruction` de Gemini.
- RLS Supabase : policies tenant-scopées propres + activer RLS sur `carts` (aujourd'hui sûr par
  défaut, mais pas la defense-in-depth complète).

---

## 📋 Ordre recommandé (impact / risque)

| # | Action | Axe | Effort | Risque |
|---|--------|-----|--------|--------|
| ✅ | Index `activity_logs` | Perf | — | — (fait) |
| ✅ | Requêtes redondantes du bot (settings/products préchargés) | Perf | — | — (fait) |
| ✅ | `store.json` : échouer franchement en prod (createOrder, deleteProduct, verifyAuthToken) | Robustesse | — | — (fait) |
| 1 | Email de relance avant/à l'expiration (Resend) | UX/rétention | Faible | Faible |
| 2 | Cache court settings/products/subscription par tenant | Perf/coût | Moyen | Faible |
| 3 | Quota conversations/mois par formule | UX/offre + coût | Moyen | Moyen |
| 4 | Alléger la page Analytics (Recharts → lib légère) | Perf | Moyen | Faible |
| 5 | Nettoyages (mockNegotiationLogic, `any`, SDK Gemini, RLS) | Qualité | Étalé | Faible |

**Aucun de ces points ne doit être fait avant le test de mercredi** — le produit est prêt. Ce sont
des améliorations à dérouler une par une, chacune vérifiée en preview/tests avant push, après le test.

---

*Méthode : je propose, tu valides item par item. On ne touche jamais au moteur de vente sans
tests verts, et chaque changement frontend est vérifié en preview avant d'être poussé.*
