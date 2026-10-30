"""Bundled WAF reference data — ships with the app (seeded from app/seed on
first run), so the audit viewer can enrich a policy's signature / signature-set
/ threat-campaign references without a live device."""
from sqlalchemy import String, Integer, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Signature(Base):
    __tablename__ = "ref_signatures"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str | None] = mapped_column(String, index=True)
    accuracy: Mapped[str | None] = mapped_column(String(32))
    risk: Mapped[str | None] = mapped_column(String(32))
    attack_type: Mapped[str | None] = mapped_column(String)
    systems: Mapped[list | None] = mapped_column(JSONB)
    cve: Mapped[str | None] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String)
    scope: Mapped[str | None] = mapped_column(String)


class SignatureSetRef(Base):
    __tablename__ = "ref_signature_sets"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(256), unique=True, index=True)
    type: Mapped[str | None] = mapped_column(String(64))
    category: Mapped[str | None] = mapped_column(String(64))
    signature_count: Mapped[int | None] = mapped_column(Integer)
    filter: Mapped[dict | None] = mapped_column(JSONB)
    member_ids: Mapped[list | None] = mapped_column(JSONB)


class ThreatCampaign(Base):
    __tablename__ = "ref_threat_campaigns"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str | None] = mapped_column(String, index=True)
    description: Mapped[str | None] = mapped_column(String)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
