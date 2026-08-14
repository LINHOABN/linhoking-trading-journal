import os
import sys
import mimetypes
from pathlib import Path

os.environ["VERCEL"] = "1"

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Static files live next to this file in api/static/
STATIC_DIR = Path(__file__).resolve().parent / "static"

from fastapi import FastAPI, Request
from fastapi.responses import Response, HTMLResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.routers import auth, trades, tiers, stats, mt5, risk, deposits

Base.metadata.create_all(bind=engine)

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
    version="0.2.0",
)

def _serve_file(rel_path: str):
    file_path = STATIC_DIR / rel_path
    if file_path.exists() and file_path.is_file():
        content = file_path.read_bytes()
        if rel_path.endswith(".js"):
            media_type = "application/javascript"
        elif rel_path.endswith(".css"):
            media_type = "text/css"
        else:
            media_type = "text/html; charset=utf-8"
        return Response(content=content, media_type=media_type)
    return None

@app.get("/debug")
async def debug(request: Request):
    return JSONResponse({
        "url": str(request.url),
        "url_path": request.url.path,
        "scope_path": request.scope.get("path"),
        "static_dir": str(STATIC_DIR),
        "static_dir_exists": STATIC_DIR.exists(),
        "static_files": [str(p) for p in STATIC_DIR.rglob("*")] if STATIC_DIR.exists() else [],
        "all_headers": dict(request.headers),
    })

@app.get("/assets/{file_name:path}")
async def serve_assets(file_name: str):
    res = _serve_file(f"assets/{file_name}")
    if res:
        return res
    return JSONResponse(status_code=404, content={"detail": f"Asset {file_name} not found"})

@app.get("/")
@app.get("/index.html")
async def serve_root():
    res = _serve_file("index.html")
    if res:
        return res
    return HTMLResponse(content="<h1>LINHOKING Trading Journal</h1>")

@app.exception_handler(404)
async def custom_404_handler(request: Request, exc: StarletteHTTPException):
    path = request.scope.get("path") or request.url.path
    if not any(path.startswith(p) for p in [
        "/auth", "/trades", "/tiers", "/stats", "/risk", "/deposits", "/mt5", "/health", "/assets"
    ]):
        res = _serve_file("index.html")
        if res:
            return res
    return JSONResponse(status_code=404, content={
        "detail": "Not Found",
        "path": path,
    })

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def vercel_route_fixer(request, call_next):
    forwarded_uri = request.headers.get("x-forwarded-uri") or request.headers.get("x-matched-path")
    if forwarded_uri:
        cleaned = forwarded_uri.split("?")[0]
        if cleaned not in ("/api/main.py", "/api/index.py", "/api"):
            request.scope["path"] = cleaned
        else:
            request.scope["path"] = "/"
    elif request.url.path in ("/api/main.py", "/api/index.py", "/api"):
        request.scope["path"] = "/"
    return await call_next(request)

app.include_router(auth.router)
app.include_router(trades.router)
app.include_router(tiers.router)
app.include_router(stats.router)
app.include_router(mt5.router)
app.include_router(risk.router)
app.include_router(deposits.router)

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return {}

@app.get("/health")
def health():
    return {"status": "ok", "version": "0.2.0", "env": "vercel"}
