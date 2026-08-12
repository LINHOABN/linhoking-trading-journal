# LINHOKING — Trading Journal (Frontend)

Dashboard React + TypeScript + Tailwind + Recharts pour un trader XAU/USD intraday.
Ce frontend est maintenant **branché sur le backend `linhoking-backend`** — plus de données mock par défaut.

## Lancer le projet en local

1. Démarre d'abord le backend (voir `linhoking-backend/README.md`) — il doit tourner sur `http://localhost:8000`
2. Puis :

```bash
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:8000 par défaut
npm run dev
```

Ouvre `http://localhost:5173`. Tu arrives sur l'écran de connexion — crée un compte, tu es redirigé vers le dashboard (vide au départ, il se remplit au fil des trades enregistrés).

## Comment ça se branche

- `src/lib/api.ts` — client HTTP unique, centralise tous les appels au backend et convertit le snake_case de l'API en camelCase pour les composants
- `src/context/AuthContext.tsx` — connexion/inscription, JWT stocké en `localStorage`, revalidé au chargement via `/auth/me`
- `src/hooks/useDashboardData.ts` — charge trades, palier, courbe de capital, historique des lots et stats en parallèle
- `src/hooks/useLiveSocket.ts` — ouvre `wss://.../ws/live` ; dès qu'un trade arrive (saisie manuelle ou sync MT5), le dashboard se rafraîchit automatiquement, sans repasser par un clic
- `src/components/LoginScreen.tsx` — écran de connexion/inscription dans le même langage visuel que le dashboard

## Ce qui est inclus

- Dashboard complet branché sur de vraies données : capital, indicateur émotionnel (vert/orange/rouge), moteur de paliers
- Rafraîchissement en temps réel via WebSocket dès qu'un trade est synchronisé depuis MT5
- Journal des trades, calendrier mensuel, 3 graphiques, panneau de statistiques — tous alimentés par l'API
- Authentification complète (inscription, connexion, déconnexion)
- Mode sombre / clair (bouton en haut à droite)
- `src/data/mockData.ts` reste dans le repo à titre de référence mais n'est plus utilisé par `App.tsx`

## Ce qui n'est PAS encore inclus

1. **Upload de captures d'écran** — stockage (S3/Supabase Storage) + affichage dans le journal
2. **Formulaire de saisie manuelle de trade** dans l'UI — pour l'instant `POST /trades` se fait via `/docs` ou un client HTTP ; ajouter un formulaire est la suite logique
3. **App mobile React Native**
4. **Déploiement** (Vercel pour le frontend, Railway/Render pour le backend, Neon/Supabase pour Postgres) — voir la section déploiement du backend

Dis-moi si tu veux qu'on ajoute le formulaire de saisie manuelle, l'upload de captures, ou qu'on passe au déploiement.
