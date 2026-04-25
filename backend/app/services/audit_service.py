from __future__ import annotations

from flask import request

from app.extensions import db
from app.models.exam import AuditLog
from app.utils.time import utcnow


class AuditService:
    @staticmethod
    def log_event(action: str, user=None, attempt=None, details=None, commit: bool = False):
        entry = AuditLog(
            user=user,
            attempt=attempt,
            action=action,
            details=details or {},
            ip_address=request.headers.get("X-Forwarded-For", request.remote_addr),
            user_agent=request.user_agent.string if request else None,
            created_at=utcnow(),
        )
        db.session.add(entry)
        if commit:
            db.session.commit()
        return entry
