# Instructions pour tout agent IA travaillant sur ce repo

Bienvenue. Ce projet est **DjassaBot**, un SaaS de vente automatisée sur WhatsApp
pour les commerçants de Côte d'Ivoire. Le propriétaire est Alex (dev solo,
mobile-first, français — parfois en transcription vocale, le fond est toujours clair).

## Ordre de lecture obligatoire avant de coder

1. **`CLAUDE.md`** — briefing complet : produit, stack, design system, conventions,
   infra VPS, historique des décisions. La section §0 (11 juin 2026) corrige les
   parties périmées du reste du document.
2. **`VIABILITE.md`** — la checklist de viabilité : état réel case par case et
   plan d'action priorisé. **C'est le TODO officiel du projet.**
3. `CLAUDE_ROADMAP.md` — journal détaillé des sessions précédentes.

## Règles essentielles (résumé — détail dans CLAUDE.md)

- **Stack** : React 19 + Vite + Tailwind v4 (Vercel, push main = deploy auto) /
  Node + Express + TS (VPS Hostinger, PM2 sous l'utilisateur `alex`, PAS root) /
  Supabase Postgres / Baileys (WhatsApp) / Gemini 2.5 Flash / Paystack / Resend.
- **Design system strict** : fond `#000`, cartes `#111`, bordures `#1a1a1a`,
  accent `#00D97E` en SOLIDE (jamais de dégradés), muted `#888`. Cible = vendeurs
  non tech-savvy sur mobile : wording français simple, pas de jargon.
- **Déploiement backend** :
  `ssh alex@187.77.171.44` puis
  `cd /home/alex/djassabotSaas && git pull && cd backend && npm install && npm run build && pm2 restart djassabot-backend`
- **Avant tout commit** : `cd backend && npx tsc --noEmit` ET `cd frontend && npm run build` doivent passer.
- **Commits en français** avec un corps qui explique le POURQUOI. Push direct sur main.
- **Demander l'avis d'Alex avant les décisions produit stratégiques**, exécuter vite après.
- **Multi-tenant** : toute requête DB doit filtrer par `tenantId`. Le backend utilise
  la clé service_role Supabase ; le frontend ne touche jamais les tables directement.
- **Ne jamais** : exécuter `wipe_db.ts` (il a déjà détruit la prod une fois),
  committer `firebase-admin-key.json` ou un `.env`, mettre de fausses données/stats
  dans l'UI (tout ce qui s'affiche doit être réel), envoyer des messages WhatsApp
  sans délai anti-ban.
- **Settings** : mapping snake_case (DB) ↔ camelCase (code) dans `dbService.ts` —
  tout nouveau champ doit être ajouté aux DEUX endroits (getSettings + updateSettings)
  ET en colonne SQL.

## État au 11 juin 2026

Le produit est fonctionnel de bout en bout (inscription email → onboarding →
connexion WhatsApp → bot qui vend, négocie, envoie les photos, valide les reçus
Wave/OM, relance les paniers). Les bloquants pour les premiers testeurs payants
sont listés en bas de `VIABILITE.md` : domaine + Resend, Paystack clés live,
RLS à appliquer, test end-to-end avec une vraie puce.
