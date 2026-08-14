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

@app.get("/")
def root():
    return {
        "status": "ok",
        "app": "LINHOKING Trading Journal API",
        "version": "0.2.0",
        "env": "vercel" if IS_VERCEL else "local"
    }

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
