import os
import sys
import mimetypes
from pathlib import Path

os.environ["VERCEL"] = "1"

backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Static files sit NEXT to this file in api/static/
STATIC_DIR = Path(__file__).resolve().parent / "static"

from fastapi import FastAPI, Request
from fastapi.responses import Response, HTMLResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="LINHOKING Trading Journal API", version="0.2.0")

# ---- safe DB init ----
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
except Exception:
    pass

# ---- static file serving ----
def _serve(rel_path: str):
    fp = STATIC_DIR / rel_path
    if fp.exists() and fp.is_file():
        content = fp.read_bytes()
        if rel_path.endswith(".js"):
            mt = "application/javascript"
        elif rel_path.endswith(".css"):
            mt = "text/css"
        else:
            mt = "text/html; charset=utf-8"
        return Response(content=content, media_type=mt)
    return None

@app.get("/assets/{file_name:path}")
async def serve_assets(file_name: str):
    res = _serve(f"assets/{file_name}")
    if res:
        return res
    return JSONResponse(status_code=404, content={"detail": f"Asset not found: {file_name}", "static_dir": str(STATIC_DIR), "exists": STATIC_DIR.exists()})

@app.get("/")
@app.get("/index.html")
async def serve_root():
    res = _serve("index.html")
    if res:
        return res
    return JSONResponse(status_code=500, content={"detail": "index.html not found", "static_dir": str(STATIC_DIR), "exists": STATIC_DIR.exists(), "files": [str(p) for p in STATIC_DIR.rglob("*")] if STATIC_DIR.exists() else []})

@app.exception_handler(404)
async def spa_handler(request: Request, exc: StarletteHTTPException):
    path = request.scope.get("path") or request.url.path
    if not any(path.startswith(p) for p in ["/auth", "/trades", "/tiers", "/stats", "/risk", "/deposits", "/mt5", "/health", "/assets", "/favicon"]):
        res = _serve("index.html")
        if res:
            return res
    return JSONResponse(status_code=404, content={"detail": "Not Found", "path": path})

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def route_fixer(request, call_next):
    forwarded = request.headers.get("x-forwarded-uri") or request.headers.get("x-matched-path")
    if forwarded:
        cleaned = forwarded.split("?")[0]
        if cleaned not in ("/api/main.py", "/api/index.py"):
            request.scope["path"] = cleaned
        else:
            request.scope["path"] = "/"
    elif request.url.path in ("/api/main.py", "/api/index.py"):
        request.scope["path"] = "/"
    return await call_next(request)

# ---- API routers (safe import) ----
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
    @app.get("/router-error")
    def router_error():
        return {"error": str(e)}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "static_dir": str(STATIC_DIR),
        "static_exists": STATIC_DIR.exists(),
        "files": [str(p) for p in STATIC_DIR.rglob("*")] if STATIC_DIR.exists() else []
    }

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return {}
