from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

db_url = settings.db_url
is_sqlite = db_url.startswith("sqlite")

if is_sqlite:
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    # PostgreSQL / Neon: optimized for serverless + connection pooler
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=1,
        max_overflow=4,
        pool_recycle=300,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    try:
        Base.metadata.create_all(bind=engine)
        with engine.connect() as conn:
            from sqlalchemy import text
            conn.execute(text("ALTER TABLE trades ADD COLUMN IF NOT EXISTS voice_url VARCHAR;"))
            conn.commit()
    except Exception as e:
        print(f"[DB] Warning: create_all or alter failed: {e}")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
