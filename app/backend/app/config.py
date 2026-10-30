from urllib.parse import quote_plus
from typing import List, Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database: either set DATABASE_URL directly (handy for local dev), or supply
    # the POSTGRES_* parts and the URL is assembled below with the password
    # URL-encoded — so passwords containing @ : / # ? & etc. work without
    # breaking the connection string.
    DATABASE_URL: Optional[str] = None
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

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

    @model_validator(mode="after")
    def _assemble_database_url(self):
        if not self.DATABASE_URL:
            if not (self.POSTGRES_USER and self.POSTGRES_PASSWORD and self.POSTGRES_DB):
                raise ValueError(
                    "Set DATABASE_URL, or POSTGRES_USER + POSTGRES_PASSWORD + POSTGRES_DB."
                )
            user = quote_plus(self.POSTGRES_USER)
            pwd = quote_plus(self.POSTGRES_PASSWORD)
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{user}:{pwd}"
                f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        return self


settings = Settings()
