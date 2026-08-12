from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.2.0", "env": "vercel" if IS_VERCEL else "local"}
