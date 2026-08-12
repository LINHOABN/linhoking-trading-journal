# LINHOKING — Backend (FastAPI + PostgreSQL)

API qui stocke les trades, applique automatiquement le moteur de paliers, et
reçoit les positions fermées depuis MT5 via l'Expert Advisor `mql5/LinhokingBridge.mq5`.

## Installation locale

```bash
python -m venv venv
source venv/bin/activate   # Windows : venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # puis renseigne DATABASE_URL et SECRET_KEY
uvicorn app.main:app --reload
```

L'API tourne sur `http://localhost:8000`. Documentation interactive auto-générée : `http://localhost:8000/docs`.

Il te faut une base PostgreSQL accessible (locale, ou gratuite sur [Neon](https://neon.tech) / [Supabase](https://supabase.com)).
Les tables sont créées automatiquement au démarrage (`Base.metadata.create_all`) — pour la prod, passe à Alembic pour gérer les migrations proprement.

## Flux d'utilisation

1. `POST /auth/register` → crée l'utilisateur + sa config de palier par défaut (200 $, lot 0.01)
2. `POST /auth/login` → renvoie un JWT (`access_token`)
3. Toutes les routes `/trades`, `/tiers`, `/stats` nécessitent `Authorization: Bearer <token>`
4. `GET /auth/me` renvoie aussi `mt5_api_key` — c'est la clé à coller dans l'EA MQL5
5. Le frontend se connecte à `wss://.../ws/live?token=<jwt>` pour recevoir les événements en temps réel (nouveau trade, sync MT5)

## Moteur de paliers

La logique vit dans `app/tier_engine.py` — une table `LOT_LADDER` (capital → lot → risque) volontairement simple.
Ajuste-la à ta vraie stratégie de money management : paliers non-linéaires, risque en %, etc.
Chaque trade enregistré (manuel ou MT5) déclenche `apply_trade_to_tier()` et ajoute un point à la courbe de capital.

## Connexion MT5 (3 étapes)

1. Ouvre `mql5/LinhokingBridge.mq5` dans MetaEditor, compile-le, attache-le au graphique XAU/USD dans MT5
2. Dans MT5 : *Outils > Options > Expert Advisors* → autorise WebRequest pour l'URL de ton API déployée
3. Renseigne `ApiBaseUrl` et `ApiKey` (récupérée via `GET /auth/me`) dans les paramètres de l'EA

Chaque position fermée déclenche automatiquement `POST /mt5/webhook`.

## Prochaines étapes suggérées

- **Alembic** pour les migrations en production
- **Upload d'images** (captures d'écran) — brancher un bucket S3-compatible (Supabase Storage, Cloudflare R2) et stocker l'URL dans `screenshot_url`
- **Rate limiting** sur `/mt5/webhook` pour éviter les doublons en cas de replay
- **Déploiement** : Railway ou Render pour l'API (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`), Neon/Supabase pour Postgres
- Brancher le frontend `linhoking-frontend` sur ces endpoints (remplacer `src/data/mockData.ts` par des appels `fetch`/`axios`)
