from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

db_url = settings.db_url
is_sqlite = db_url.startswith("sqlite")

def create_db_engine(url: str):
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=1,
        max_overflow=4,
        pool_recycle=300,
    )

import tempfile
import os

fallback_db_path = os.path.join(tempfile.gettempdir(), "linhoking_sql_app.db")
FALLBACK_SQLITE_URL = f"sqlite:///{fallback_db_path}"

try:
    engine = create_db_engine(db_url)
    with engine.connect() as conn:
        pass
except Exception as e:
    print(f"[DB Engine Warning] Primary DB connection failed ({e}). Falling back to temp SQLite: {FALLBACK_SQLITE_URL}")
    db_url = FALLBACK_SQLITE_URL
    engine = create_db_engine(db_url)
    is_sqlite = True

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    global engine, is_sqlite
    try:
        Base.metadata.create_all(bind=engine)
        if not is_sqlite:
            with engine.connect() as conn:
                from sqlalchemy import text
                conn.execute(text("ALTER TABLE trades ADD COLUMN IF NOT EXISTS voice_url VARCHAR;"))
                conn.commit()
    except Exception as e:
        print(f"[DB Warning] Primary DB query failed: {e}. Switching to temp SQLite engine.")
        if not is_sqlite:
            try:
                engine = create_db_engine(FALLBACK_SQLITE_URL)
                is_sqlite = True
                Base.metadata.create_all(bind=engine)
            except Exception as fb_err:
                print(f"[DB Critical] Fallback SQLite failed: {fb_err}")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
