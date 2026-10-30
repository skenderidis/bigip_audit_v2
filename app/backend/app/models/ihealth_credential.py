from sqlalchemy import String, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class IHealthCredential(Base):
    """F5 iHealth API credentials (single row, id=1). The client secret is
    stored encrypted (Fernet); the client id is not sensitive on its own."""
    __tablename__ = "ihealth_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_secret_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
