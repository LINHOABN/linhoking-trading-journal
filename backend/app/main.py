from fastapi import FastAPI, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import os
import mimetypes

IS_VERCEL = os.environ.get("VERCEL") == "1"

app = FastAPI(
    title="LINHOKING Trading Journal",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Load in-memory bundled assets ----
try:
    from app.static_bundle import JS_CONTENT, CSS_CONTENT, JS_FILENAME, CSS_FILENAME
except Exception:
    JS_CONTENT = None
    CSS_CONTENT = None
    JS_FILENAME = "index-B5Mr9YoW.js"
    CSS_FILENAME = "index-BazwQA1c.css"

STATIC_DIRS = [
    Path(__file__).resolve().parent.parent.parent / "api" / "static",
    Path(__file__).resolve().parent / "static",
    Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
]

CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}

INDEX_HTML = f"""<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LINHOKING — Trading Journal</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <script type="module" crossorigin src="/assets/{JS_FILENAME}?v=0.2.1"></script>
    <link rel="stylesheet" crossorigin href="/assets/{CSS_FILENAME}?v=0.2.1">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>"""

# ---- Asset Serving ----
@app.get("/assets/{file_name:path}")
async def serve_assets(file_name: str):
    clean_name = file_name.split("?")[0]
    if (clean_name.endswith(".js") or clean_name == JS_FILENAME) and JS_CONTENT:
        return Response(content=JS_CONTENT.encode("utf-8"), media_type="application/javascript", headers=CACHE_HEADERS)
    elif (clean_name.endswith(".css") or clean_name == CSS_FILENAME) and CSS_CONTENT:
        return Response(content=CSS_CONTENT.encode("utf-8"), media_type="text/css", headers=CACHE_HEADERS)

    rel_path = f"assets/{clean_name}"
    for d in STATIC_DIRS:
        file_path = d / rel_path
        if file_path.exists() and file_path.is_file():
            content = file_path.read_bytes()
            if clean_name.endswith(".js"):
                media_type = "application/javascript"
            elif clean_name.endswith(".css"):
                media_type = "text/css"
            else:
                media_type, _ = mimetypes.guess_type(str(file_path))
            return Response(content=content, media_type=media_type, headers=CACHE_HEADERS)
    return JSONResponse(status_code=404, content={"detail": f"Asset {file_name} not found"})

# ---- DB init (safe) ----
try:
    from app.database import Base, engine, SessionLocal
    from app import models
    from app.security import hash_password
    Base.metadata.create_all(bind=engine)
    try:
        db = SessionLocal()
        from app.services.risk_engine import seed_risk_levels
        seed_risk_levels(db)

        # Seed default user if empty
        if not db.query(models.User).filter(models.User.email == "bob@linhoking.com").first():
            demo_user = models.User(
                email="bob@linhoking.com",
                hashed_password=hash_password("password123"),
                mt5_api_key=models.gen_deterministic_api_key("bob@linhoking.com"),
                mt5_balance=58.18,
                mt5_account_number="161610872",
                mt5_broker="Exness Technologies Ltd",
            )
            db.add(demo_user)
            db.flush()
            demo_tier = models.TierConfig(
                user_id=demo_user.id,
                starting_capital=58.18,
                current_capital=58.18,
            )
            db.add(demo_tier)
            db.commit()

        # Always ensure trades are seeded for the user if table is empty
        user_for_trades = db.query(models.User).filter(models.User.email == "bob@linhoking.com").first()
        if user_for_trades and db.query(models.Trade).filter(models.Trade.user_id == user_for_trades.id).count() == 0:
            from pathlib import Path
            import json
            from datetime import date, time
            seed_file = Path(__file__).parent / "seed_trades.json"
            if seed_file.exists():
                with open(seed_file, "r", encoding="utf-8") as sf:
                    raw_trades = json.load(sf)
                for tr in raw_trades:
                    t_d = date.fromisoformat(tr["trade_date"])
                    o_t = time.fromisoformat(tr["open_time"])
                    c_t = time.fromisoformat(tr["close_time"])
                    db.add(
                        models.Trade(
                            user_id=user_for_trades.id,
                            trade_date=t_d,
                            open_time=o_t,
                            close_time=c_t,
                            symbol=tr.get("symbol", "XAUUSD"),
                            direction=tr.get("direction", "BUY"),
                            volume=tr.get("volume", 0.01),
                            entry_price=tr.get("entry_price", 0.0),
                            exit_price=tr.get("exit_price", 0.0),
                            stop_loss=tr.get("stop_loss", 0.0),
                            take_profit=tr.get("take_profit", 0.0),
                            pnl=tr.get("pnl", 0.0),
                            session=tr.get("session"),
                            mt5_ticket=tr.get("mt5_ticket"),
                            source=tr.get("source", "mt5"),
                        )
                    )
                db.commit()

        db.close()
    except Exception as _seed_err:
        print(f"[SEED WARNING] {_seed_err}")
except Exception as _db_err:
    _db_err_msg = str(_db_err)

# ---- Routers (safe) ----
_router_error = None
try:
    from app.routers import auth, trades, tiers, stats, mt5, risk, deposits
    app.include_router(auth.router)
    app.include_router(trades.router)
    app.include_router(tiers.router)
    app.include_router(stats.router)
    app.include_router(mt5.router)
    app.include_router(risk.router)
    app.include_router(deposits.router)
except Exception as e:
    _router_error = str(e)

# ---- Health & Debug ----
@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "0.2.0",
        "env": "vercel" if IS_VERCEL else "local",
        "router_error": _router_error,
        "has_js": bool(JS_CONTENT),
        "has_css": bool(CSS_CONTENT),
    }

@app.get("/debug")
def debug(request: Request):
    return {
        "url_path": request.url.path,
        "headers": dict(request.headers),
        "query_params": dict(request.query_params)
    }

# ---- SPA Catch-All Route ----
@app.get("/{full_path:path}", response_class=HTMLResponse)
def spa_catch_all(full_path: str = ""):
    return HTMLResponse(content=INDEX_HTML, headers=CACHE_HEADERS)
