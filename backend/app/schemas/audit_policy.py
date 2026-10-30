from datetime import datetime
from typing import Any
from pydantic import BaseModel


class AuditPolicyOut(BaseModel):
    id: int
    name: str
    source: str
    filename: str | None = None
    domain: str
    summary: dict[str, Any] | None = None
    uploaded_at: datetime
    template: str | None = None
    analysis: dict[str, Any] | None = None
    analyzed_at: datetime | None = None

    class Config:
        from_attributes = True


class AuditPolicyDetail(AuditPolicyOut):
    content: dict[str, Any]
    findings: list[dict[str, Any]] | None = None
