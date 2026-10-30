from datetime import datetime, timezone

from sqlalchemy import String, Integer, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AuditPolicy(Base):
    """A WAF policy uploaded by the user for auditing. Standalone — the only
    source of policies in this app is upload (no managed fleet). `content` holds
    the raw declarative policy JSON; `summary` holds cheap derived signals shown
    on the posture / list pages. The compliance-baseline audit is computed later
    on top of `content`."""
    __tablename__ = "audit_policies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    source: Mapped[str] = mapped_column(String(32), default="upload")
    filename: Mapped[str | None] = mapped_column(String(512), nullable=True)
    domain: Mapped[str] = mapped_column(String(16), default="waf")  # waf | ltm | ddos | bot (future)
    content: Mapped[dict] = mapped_column(JSONB)
    summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    # Audit: chosen template (None = no template → gap analysis skipped) +
    # analyzer findings/summary.
    template: Mapped[str | None] = mapped_column(String(32), nullable=True)
    findings: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    analysis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # User-accepted OWASP requirements that can't be derived from the policy
    # (e.g. virtual-server TLS posture): {ackKey: bool}.
    owasp_acks: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
