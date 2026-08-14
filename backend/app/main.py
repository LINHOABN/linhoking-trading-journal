from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.routers import auth, trades, tiers, stats, mt5, risk, deposits

IS_VERCEL = os.environ.get("VERCEL") == "1"

if not IS_VERCEL:
    from app.routers import ws  # noqa: E402

try:
    Base.metadata.create_all(bind=engine)
except Exception:
    pass

def _startup_seed():
    try:
        db = SessionLocal()
        from app.services.risk_engine import seed_risk_levels
        seed_risk_levels(db)
        db.close()
    except Exception:
        pass

_startup_seed()

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

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return {}

@app.get("/health")
def health():
    return {"status": "ok", "version": "0.2.0", "env": "vercel" if IS_VERCEL else "local"}
