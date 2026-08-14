from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

IS_VERCEL = os.environ.get("VERCEL") == "1"

app = FastAPI(
    title="LINHOKING Trading Journal API",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def vercel_route_fixer(request, call_next):
    if IS_VERCEL:
        forwarded_uri = request.headers.get("x-forwarded-uri")
        matched_path = request.headers.get("x-matched-path")
        
        target_path = None
        if forwarded_uri:
            target_path = forwarded_uri.split("?")[0]
        elif matched_path:
            target_path = matched_path.split("?")[0]
            
        if target_path and target_path not in ("/api/main.py", "/api/index.py", "/api"):
            request.scope["path"] = target_path
        elif request.url.path in ("/api/main.py", "/api/index.py", "/api"):
            request.scope["path"] = "/"
    return await call_next(request)

from pathlib import Path
from fastapi import Response
from fastapi.responses import HTMLResponse, JSONResponse
import mimetypes

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

@app.get("/assets/{file_name:path}")
async def serve_assets(file_name: str):
    if (file_name.endswith(".js") or file_name == JS_FILENAME) and JS_CONTENT:
        return Response(content=JS_CONTENT.encode("utf-8"), media_type="application/javascript")
    elif (file_name.endswith(".css") or file_name == CSS_FILENAME) and CSS_CONTENT:
        return Response(content=CSS_CONTENT.encode("utf-8"), media_type="text/css")

    rel_path = f"assets/{file_name}"
    for d in STATIC_DIRS:
        file_path = d / rel_path
        if file_path.exists() and file_path.is_file():
            content = file_path.read_bytes()
            if file_name.endswith(".js"):
                media_type = "application/javascript"
            elif file_name.endswith(".css"):
                media_type = "text/css"
            else:
                media_type, _ = mimetypes.guess_type(str(file_path))
            return Response(content=content, media_type=media_type)
    return JSONResponse(status_code=404, content={"detail": f"Asset {file_name} not found"})

INDEX_HTML = """<!doctype html>
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
    <script type="module" crossorigin src="/assets/index-B5Mr9YoW.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-BazwQA1c.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>"""

@app.get("/", response_class=HTMLResponse)
@app.get("/index.html", response_class=HTMLResponse)
def root():
    return HTMLResponse(content=INDEX_HTML)

# ---- DB init (safe) ----
try:
    from app.database import Base, engine, SessionLocal
    Base.metadata.create_all(bind=engine)
    try:
        db = SessionLocal()
        from app.services.risk_engine import seed_risk_levels
        seed_risk_levels(db)
        db.close()
    except Exception:
        pass
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

# ---- WebSocket (local only) ----
if not IS_VERCEL:
    try:
        from app.routers import ws
        app.include_router(ws.router)
        from fastapi.staticfiles import StaticFiles
        os.makedirs("uploads", exist_ok=True)
        app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
    except Exception:
        pass

@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "0.2.0",
        "env": "vercel" if IS_VERCEL else "local",
        "router_error": _router_error,
    }

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return {}
