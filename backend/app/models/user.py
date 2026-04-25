from __future__ import annotations

from app.extensions import db
from app.models.enums import UserRole
from app.models.mixins import TimestampMixin
from app.utils.serializers import serialize_datetime


class User(TimestampMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum(UserRole, native_enum=False), nullable=False, index=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    group_memberships = db.relationship("GroupMember", back_populates="student", cascade="all, delete-orphan")
    attempts = db.relationship("Attempt", back_populates="student")
    manual_gradings = db.relationship("ManualGrading", back_populates="grader")
    published_results = db.relationship("Result", back_populates="published_by")
    audit_logs = db.relationship("AuditLog", back_populates="user")

    def to_dict(self, include_groups: bool = False):
        payload = {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "role": self.role.value,
            "is_active": self.is_active,
            "created_at": serialize_datetime(self.created_at),
            "updated_at": serialize_datetime(self.updated_at),
        }
        if include_groups:
            payload["groups"] = [
                {
                    "id": membership.group.id,
                    "name": membership.group.name,
                }
                for membership in self.group_memberships
            ]
        return payload
