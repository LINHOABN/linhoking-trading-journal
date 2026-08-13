from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.routers import auth, trades, tiers, stats, mt5, risk, deposits

IS_VERCEL = os.environ.get("VERCEL") == "1"

# Only include WebSocket router when NOT on Vercel (serverless doesn't support WS)
if not IS_VERCEL:
    from app.routers import ws  # noqa: E402

# Create all tables on startup
Base.metadata.create_all(bind=engine)

# Seed risk levels on startup if table is empty
def _startup_seed():
    db = SessionLocal()
    try:
        from app.services.risk_engine import seed_risk_levels
        seed_risk_levels(db)
    finally:
        db.close()

_startup_seed()

app = FastAPI(
    title="LINHOKING Trading Journal API",
    description="API pour le journal de trading XAU/USD intraday LINHOKING.",
    version="0.2.0",
)

INDEX_PATH = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist" / "index.html"
INDEX_HTML = """<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LINHOKING — Trading Journal</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <script type="module" crossorigin src="/assets/index-B5Mr9YoW.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-BazwQA1c.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>"""

def get_index_response():
    if INDEX_PATH.exists():
        return FileResponse(INDEX_PATH)
    return HTMLResponse(content=INDEX_HTML)

@app.exception_handler(404)
async def custom_404_handler(request: Request, exc: StarletteHTTPException):
    path = request.url.path
    if not any(
        path.startswith(prefix)
        for prefix in [
            "/api",
            "/auth",
            "/trades",
            "/tiers",
            "/stats",
            "/risk",
            "/deposits",
            "/mt5",
            "/health",
            "/assets",
        ]
    ):
        return get_index_response()

    return JSONResponse(
        status_code=404,
        content={
            "detail": "Not Found",
            "requested_url": str(request.url),
            "requested_path": request.url.path,
            "scope_path": request.scope.get("path"),
            "method": request.method,
            "headers": dict(request.headers),
            "is_vercel": IS_VERCEL,
        },
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if IS_VERCEL else settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def vercel_route_fixer(request, call_next):
    if IS_VERCEL:
        forwarded_uri = request.headers.get("x-forwarded-uri") or request.headers.get("x-matched-path")
        if forwarded_uri and forwarded_uri != request.url.path:
            request.scope["path"] = forwarded_uri.split("?")[0]
        elif request.url.path in ("/api/main.py", "/api/index.py", "/api"):
            request.scope["path"] = "/"
    return await call_next(request)

# Only mount uploads directory locally (Vercel has no persistent filesystem)
if not IS_VERCEL:
    os.makedirs("uploads", exist_ok=True)
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(trades.router)
app.include_router(tiers.router)
app.include_router(stats.router)
app.include_router(mt5.router)
app.include_router(risk.router)
app.include_router(deposits.router)

if not IS_VERCEL:
    app.include_router(ws.router)

@app.get("/index.html", response_class=HTMLResponse)
@app.get("/", response_class=HTMLResponse)
async def serve_index():
    return get_index_response()

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return {}

@app.get("/health")
def health():
    return {"status": "ok", "version": "0.2.0", "env": "vercel" if IS_VERCEL else "local"}
