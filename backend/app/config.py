import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://neondb_owner:npg_d1nbjryI6fkY@ep-polished-tooth-axxgxy47-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require"
    SECRET_KEY: str = "change-me-to-a-long-random-string"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200  # 30 jours
    ALGORITHM: str = "HS256"
    CORS_ORIGINS: str = "*"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins_list(self) -> list[str]:
        if os.environ.get("VERCEL") == "1":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def db_url(self) -> str:
        return self.DATABASE_URL


settings = Settings()
