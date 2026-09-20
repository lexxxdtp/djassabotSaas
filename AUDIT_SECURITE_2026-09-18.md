# Audit de sécurité — DjassaBot SaaS
**Date :** 18 septembre 2026
**Périmètre :** `backend/src`, `frontend/src`, `database/`, historique git (252 commits), dépendances npm
**Méthode :** revue statique du code, analyse de l'historique git, décodage des métadonnées de configuration, `npm audit`

---

## Verdict global

Le projet est **nettement mieux sécurisé que la moyenne d'un SaaS à ce stade**. Aucun secret n'a fuité, le webhook de paiement est correctement signé, les mots de passe sont hachés, les champs sont whitelistés, il n'y a pas de SQL brut donc pas d'injection SQL possible.

**Aucune vulnérabilité critique exploitable à distance n'a été trouvée.**

Les points listés ci-dessous sont, par ordre : deux risques élevés liés à la configuration et à l'architecture, puis des durcissements.

---

## 🔴 Risques élevés

### E1 — `NODE_ENV` est vide dans `backend/.env`

`backend/.env` contient `NODE_ENV=` (vide). Trois garde-fous du code testent `process.env.NODE_ENV === 'production'` et sont donc **désactivés** si la variable n'est pas définie sur le serveur :

| Garde-fou | Fichier | Conséquence si NODE_ENV n'est pas `production` |
|---|---|---|
| Blocage des origines localhost | `index.ts` (CORS) | N'importe quelle page servie en local peut appeler l'API |
| Désactivation de `/api/debug/seed` | `index.ts` | Tout tenant authentifié peut injecter 40 fausses commandes dans sa base |
| Logs `pino-pretty` | `utils/logger.ts` | Logs non structurés, plus lourds, en production |

`backend/.env.example` contient bien `NODE_ENV=production` — c'est donc le `.env` local qui est vide. **Reste à vérifier que Railway définit bien la variable.**

**Correctif — à vérifier dans le dashboard Railway :**
```
Variables → NODE_ENV = production
```
Puis, pour ne plus jamais dépendre de ça, ajouter un garde-fou au démarrage dans `index.ts` :
```ts
if (!process.env.NODE_ENV) {
    logger.error('NODE_ENV non défini — refus de démarrer');
    process.exit(1);
}
```
*Pourquoi :* un serveur qui démarre dans un mode indéterminé est pire qu'un serveur qui refuse de démarrer. On préfère une panne visible à une faille silencieuse.

---

### E2 — L'isolation entre boutiques repose entièrement sur le code applicatif

Le backend utilise la clé Supabase **`service_role`** (vérifié en décodant le rôle du JWT dans `.env`). Cette clé **contourne toutes les règles RLS** de Postgres. Les policies sont d'ailleurs volontairement absentes (`-- 10. OPEN ACCESS POLICIES REMOVED FOR SECURITY (SEC-01)`), ce qui est cohérent : RLS est activé sur les 10 tables et aucune policy n'existe → tout accès `anon`/`authenticated` est refusé par défaut. **C'est le bon choix d'architecture.**

Mais la conséquence est que **la seule chose qui empêche la boutique A de lire les données de la boutique B, c'est la présence de `.eq('tenant_id', tenantId)` dans chaque requête**. Il n'y a aucun filet de sécurité en dessous.

J'ai audité les **31 requêtes Supabase** de `dbService.ts` une par une. Résultat : **toutes filtrent correctement par tenant.** Les 5 qui semblaient manquer à l'analyse automatique sont des faux positifs vérifiés :

- `createOrder` (L477, L487) → `tenant_id` est dans l'objet inséré
- `saveVariationTemplate` (L1321) → l'`update` cible `existing.id`, déjà scopé par tenant juste au-dessus
- `auth_tokens` (L1401, L1427, L1465) → table globale par nature (OTP/reset), pas de tenant

**Le code est correct aujourd'hui. Le risque est dans le futur :** une seule requête ajoutée sans `.eq('tenant_id', …)` expose les commandes, produits ou conversations de **toutes** les boutiques, et rien ne le signalera.

**Correctif recommandé — un test d'isolation automatisé :**
```ts
// backend/src/services/__tests__/tenantIsolation.test.ts
// Crée 2 tenants, un produit + une commande dans chacun,
// puis vérifie que chaque méthode de db ne renvoie QUE les données du bon tenant.
test('aucune méthode db ne fuit entre tenants', async () => {
    const a = await createTestTenant(); const b = await createTestTenant();
    await db.createProduct(a.id, { name: 'Produit A', price: 1000, stock: 1 });
    const produitsDeB = await db.getProducts(b.id);
    assert.equal(produitsDeB.length, 0);
});
```
*Pourquoi ça vaut le coup :* ce test tourne en quelques secondes et casse le build le jour où un `.eq('tenant_id')` est oublié. C'est exactement le genre de bug qu'on ne voit jamais en testant à la main, parce qu'on teste toujours avec un seul compte.

---

## 🟠 Risques moyens

### M1 — `checkSubscription` laisse passer en cas de panne base de données

`middleware/auth.ts`, fin du middleware :
```ts
} catch (error) {
    logger.error(...);
    next();   // ← on laisse passer
}
```
Une panne Supabase ouvre l'accès à **tout le monde**, y compris aux comptes `suspended` et aux abonnements expirés. Le choix est documenté (« éviter de bloquer l'usage ») et défendable commercialement, mais il crée une fenêtre où la suspension d'un compte abusif ne s'applique plus.

**Correctif :** distinguer les deux cas. On peut tolérer de laisser passer un abonnement expiré (perte de revenu, faible), mais pas un compte suspendu (risque de sécurité) :
```ts
} catch (error) {
    logger.error({ err: error, tenantId: req.tenantId }, 'checkSubscription DB error');
    // Un compte suspendu ne doit jamais passer, même en cas de panne.
    // On refuse seulement si on ne peut pas confirmer son état.
    res.status(503).json({ error: 'Vérification impossible. Réessayez dans un instant.' });
}
```
Ou, moins strict : garder `next()` mais mettre en cache le dernier statut connu de chaque tenant, et refuser si le dernier statut connu était `suspended`.

### M2 — OTP et jetons de réinitialisation stockés en clair

Table `auth_tokens` : `token_value` contient l'OTP à 6 chiffres ou le jeton de reset **tel quel**. Quiconque obtient un accès en lecture à la base (fuite, sauvegarde mal protégée, clé `service_role` compromise) peut réinitialiser n'importe quel mot de passe.

De plus, sur le chemin Supabase, `storeAuthToken` **n'efface pas les jetons précédents** du même identifiant (l'effacement n'existe que sur le chemin local). Un utilisateur qui demande 5 codes a 5 codes valides en même temps → la fenêtre de force brute est multipliée par 5.

**Correctif :**
```ts
// 1. Hacher avant stockage
const hashed = crypto.createHash('sha256').update(tokenValue).digest('hex');
// puis comparer le hash à la vérification, jamais la valeur brute

// 2. Supprimer les anciens jetons avant d'insérer (chemin Supabase aussi)
await supabase.from('auth_tokens').delete()
    .eq('identifier', identifier).eq('token_type', tokenType);
```
*Note :* le point positif, c'est que les codes sont générés avec `crypto.randomInt()` et non `Math.random()` — c'est le bon réflexe, `Math.random()` est prédictible.

### M3 — Aucune limite sur `/api/marketing/broadcast`

La route répond immédiatement puis lance l'envoi en arrière-plan. Rien n'empêche de poster **deux campagnes simultanées** : deux boucles tournent en parallèle sur la même audience → les clients reçoivent des doublons, et le délai anti-ban de 2 à 5 secondes est divisé par deux. C'est le scénario typique qui fait **bannir un numéro WhatsApp**.

Il n'y a pas non plus de plafond de campagnes par jour.

**Correctif :** un verrou par tenant + un rate limiter dédié :
```ts
const campagnesEnCours = new Set<string>();
// dans le handler, avant de répondre :
if (campagnesEnCours.has(tenantId))
    return res.status(409).json({ error: 'Une campagne est déjà en cours.' });
campagnesEnCours.add(tenantId);
// et campagnesEnCours.delete(tenantId) à la fin du bloc async, dans un finally
```

### M4 — Les quotas IA sont en mémoire du processus

`services/aiUsage.ts` compte les appels Gemini dans une `Map` en mémoire, remise à zéro à chaque redémarrage — et le commentaire du fichier le dit franchement. Railway redémarre le conteneur à chaque déploiement et sur incident. Le plafond de 300 appels/boutique et 2000/serveur est donc **contournable par de simples redémarrages**, et serait multiplié par le nombre d'instances si vous passez à plus d'une.

C'est un risque de **facture**, pas de sécurité, mais sur un plan à 5 000 F/mois une facture Gemini qui dérape mange la marge.

**Correctif :** déplacer le compteur en base (une table `ai_usage_daily` avec `tenant_id`, `day`, `count` et un `upsert` atomique), ou dans Redis si vous en ajoutez un.

---

## 🟡 Durcissements (faibles)

| # | Point | Détail | Correctif |
|---|---|---|---|
| F1 | JWT valable 7 jours sans révocation | Un token volé reste valide 7 jours. Bien atténué par `checkSubscription` qui revérifie le statut du compte à **chaque** requête. | Invalider les tokens au changement de mot de passe (ajouter un `tokenVersion` au tenant, comparé dans le middleware) |
| F2 | JWT dans `localStorage` | Une XSS permettrait de voler la session. Aucun `dangerouslySetInnerHTML` dans le frontend et React échappe par défaut → risque réel faible aujourd'hui. | Ne rien changer pour l'instant ; éviter à l'avenir toute injection HTML brute |
| F3 | CORS : `if (!origin) return callback(null, true)` | Autorise toute requête sans en-tête Origin (Postman, scripts). L'auth étant par Bearer token et non par cookie, il n'y a pas de CSRF exploitable. | Acceptable. À resserrer seulement si vous passez un jour aux cookies de session |
| F4 | Origine codée en dur | `https://187-77-171-44.nip.io` en dur dans `index.ts` | La déplacer dans `ALLOWED_ORIGINS` |
| F5 | 9 vulnérabilités npm modérées | Toutes le même paquet : `uuid < 11.1.1` (dépendance transitive de `google-gax`, `node-cron`, `gaxios`). Faille de bornes de buffer sur v3/v5/v6, non utilisées ici. Frontend : **0 vulnérabilité**. | `npm audit fix` ; ne pas forcer avec `--force` (casserait des versions majeures) |
| F6 | Logger sans redaction | `pino` n'a pas d'option `redact`. Aucune fuite constatée (les logs ne contiennent que `tenantId` et des objets d'erreur), mais rien n'empêche un futur `logger.info(req.body)` de logger un mot de passe. | Ajouter `redact: ['req.headers.authorization', '*.password', '*.token_value']` |

---

## ✅ Ce qui est bien fait

À dire clairement, parce que c'est ce qui explique l'absence de faille critique :

- **Aucun secret dans le code ni dans les 252 commits.** Recherche de clés Stripe/Paystack/Google/Supabase/JWT/clés privées PEM dans tout le code source : zéro résultat. Recherche des fichiers `.env`, `firebase-admin-key.json` et `*.pem` dans **tout l'historique git** (`--diff-filter=A` sur toutes les branches) : seul `.env.example` a jamais été commité.
- **`.gitignore` complet et réfléchi** — il couvre les clés Firebase avec trois motifs différents, les sessions Baileys, et même les `.zip` (avec le commentaire expliquant pourquoi).
- **Webhook Paystack : impeccable.** HMAC SHA512 sur le `rawBody` (et pas sur un `JSON.stringify` reconstruit, qui est l'erreur classique), comparaison en **temps constant** via `crypto.timingSafeEqual`, et refus explicite en 503 si le secret est absent plutôt qu'un HMAC à clé vide. C'est du niveau production.
- **Mots de passe : `bcrypt` avec 10 tours.** Standard correct.
- **OTP générés avec `crypto.randomInt()`**, pas `Math.random()`.
- **Rate limiting** sur `login`, `signup` (20/15 min) et toutes les routes OTP (5/10 min).
- **`helmet`** activé.
- **Whitelist explicite des champs** dans `updateSettings` (34 champs listés un par un), `createProduct` et `updateMe` → aucune vulnérabilité de mass-assignment.
- **Uploads verrouillés** : type MIME **et** extension validés, 5 Mo max, fichiers rangés sous `${tenantId}/`, `upsert: false` pour qu'un nom déjà pris échoue au lieu d'écraser la photo d'un autre.
- **Aucune fuite de stack trace** vers le client : toutes les erreurs renvoient un message générique et loguent le détail côté serveur.
- **`minPrice` retiré de toutes les réponses API** — le prix plancher de négociation n'est jamais exposé au frontend.
- **Pas une seule requête SQL brute** → l'injection SQL est structurellement impossible.
- **RLS activé sur les 10 tables avec zéro policy** = refus par défaut pour `anon` et `authenticated`. Bon choix pour une architecture backend-only.
- **`checkSubscription` revérifie le statut du compte à chaque requête** au lieu de se fier au token émis 7 jours plus tôt — le commentaire du code montre que le problème avait été identifié et corrigé.

---

## Plan d'action proposé

**Cette semaine (30 minutes)**
1. Vérifier `NODE_ENV=production` sur Railway **(E1)** ← le plus rentable, c'est un clic
2. `npm audit fix` sur le backend **(F5)**
3. Déplacer l'origine `nip.io` dans `ALLOWED_ORIGINS` **(F4)**

**Ce mois-ci**
4. Test automatisé d'isolation multi-tenant **(E2)** ← le plus important pour la suite
5. Verrou sur les campagnes broadcast **(M3)** ← protège votre numéro WhatsApp d'un ban
6. Hacher les OTP + supprimer les anciens jetons **(M2)**

**Quand le produit se stabilise**
7. Quotas IA en base **(M4)**
8. Durcir `checkSubscription` **(M1)**
9. `tokenVersion` pour révoquer les JWT **(F1)**
10. Redaction sur le logger **(F6)**
