# 📱 DjassaBot — App iOS (Capacitor)

L'app iOS embarque le frontend React dans une app native via Capacitor.
Elle appelle directement l'API de production (VPS) — voir `frontend/src/utils/apiConfig.ts`.

## Prérequis (sur ton Mac)

- Xcode installé (App Store, gratuit)
- Un compte Apple (gratuit pour tester sur ton iPhone, payant 99$/an pour l'App Store)

## Lancer l'app sur ton iPhone

```bash
cd ~/djassabotSaas/frontend

# 1. Installer les dépendances (une seule fois après le git pull)
npm install

# 2. Builder le frontend et synchroniser vers iOS
npm run ios:sync

# 3. Ouvrir le projet dans Xcode
npm run ios:open
```

Dans Xcode :
1. Branche ton iPhone en USB (ou même réseau Wi-Fi).
2. En haut, sélectionne ton iPhone comme destination (à la place du simulateur).
3. Onglet **Signing & Capabilities** du target `App` → coche *Automatically manage signing* → choisis ton équipe (ton Apple ID).
4. Clique sur ▶︎ (Run). L'app s'installe sur ton téléphone.
5. Premier lancement : sur l'iPhone, va dans **Réglages → Général → VPN et gestion d'appareils** et fais confiance à ton certificat développeur.

## Après chaque modification du frontend

```bash
cd ~/djassabotSaas/frontend
npm run ios:sync   # rebuild + copie dans l'app iOS
# puis Run dans Xcode
```

## Notes techniques

- `appId` : `com.djassabot.app` — `appName` : DjassaBot
- Le backend autorise déjà l'origine `capacitor://localhost` (CORS, voir `backend/src/index.ts`).
- En mode Capacitor, `apiConfig.ts` détecte l'app native et utilise l'URL API de prod automatiquement.
- Pour publier sur l'App Store plus tard : compte Apple Developer (99$/an), puis dans Xcode → Product → Archive → Distribute.

## Distribution sans App Store (bêta)

TestFlight est la voie simple pour faire tester l'app à tes premiers commerçants :
compte Apple Developer requis, puis Archive → TestFlight → invite par email/lien.
