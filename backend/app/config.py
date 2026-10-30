from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Standalone: its own Postgres database (not the WAF Manager one).
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    APP_NAME: str = "Audit for BIGIP"
    DEBUG: bool = False
    # "*" = allow any origin WITHOUT credentials (safe for this token-in-header
    # API). Set an explicit comma-separated list in .env to lock it down and
    # allow credentials.
    CORS_ORIGINS: List[str] = ["*"]
    FIRST_ADMIN_USERNAME: str = "admin"
    FIRST_ADMIN_PASSWORD: str = "Admin1234!"
    FIRST_ADMIN_EMAIL: str = "admin@company.com"

    class Config:
        env_file = ".env"


settings = Settings()
