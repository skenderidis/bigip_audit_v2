from datetime import datetime, timezone

from sqlalchemy import String, Integer, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LtmAudit(Base):
    """One LTM device configuration review, pulled from an F5 iHealth QKView.

    `content` holds the merged `results` dict (all parsed command/file output),
    `diagnostics` the raw iHealth diagnostics, and `findings` the grouped audit
    issues {ltm, bot, dos}. Bot/DoS inventory + checks are derived from the same
    QKView pull, so the LTM / Bot / DDoS pages all read from this one row."""
    __tablename__ = "ltm_audits"

    id: Mapped[int] = mapped_column(primary_key=True)
    device_name: Mapped[str] = mapped_column(String(255), index=True)
    qkview_id: Mapped[str] = mapped_column(String(64), index=True)
    customer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content: Mapped[dict] = mapped_column(JSONB)
    diagnostics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    findings: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # user-removed findings / diagnostics: {"findings": [name...], "diag": [h_header...]}
    excluded: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # uploaded Resources-Utilization graphs: {graph_key: base64 PNG}
    graphs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
