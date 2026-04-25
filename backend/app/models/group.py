from __future__ import annotations

from app.extensions import db
from app.models.mixins import TimestampMixin
from app.utils.serializers import serialize_datetime


class Group(TimestampMixin, db.Model):
    __tablename__ = "groups"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)

    members = db.relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    assignments = db.relationship("ExamAssignment", back_populates="group")

    def to_dict(self, include_members: bool = True):
        payload = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": serialize_datetime(self.created_at),
            "updated_at": serialize_datetime(self.updated_at),
        }
        if include_members:
            payload["members"] = [member.student.to_dict() for member in self.members]
        return payload


class GroupMember(TimestampMixin, db.Model):
    __tablename__ = "group_members"
    __table_args__ = (
        db.UniqueConstraint("group_id", "student_id", name="uq_group_member"),
    )

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    group = db.relationship("Group", back_populates="members")
    student = db.relationship("User", back_populates="group_memberships")
