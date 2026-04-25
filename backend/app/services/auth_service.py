from __future__ import annotations

from http import HTTPStatus

from sqlalchemy import func

from app.models.enums import UserRole
from app.extensions import db
from app.models.user import User
from app.utils.errors import ApiError
from app.utils.security import hash_password, verify_password


class AuthService:
    @staticmethod
    def authenticate(email: str, password: str) -> User:
        user = User.query.filter(func.lower(User.email) == email.strip().lower()).first()
        if user is None or not user.is_active or not verify_password(password, user.password_hash):
            raise ApiError("Invalid credentials", HTTPStatus.UNAUTHORIZED)
        return user

    @staticmethod
    def register_student(payload: dict) -> User:
        email = payload["email"].strip().lower()
        existing = User.query.filter(func.lower(User.email) == email).first()
        if existing:
            raise ApiError("Un compte utilise déjà cette adresse email.", HTTPStatus.CONFLICT)

        student = User(
            full_name=payload["full_name"].strip(),
            email=email,
            password_hash=hash_password(payload["password"]),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.session.add(student)
        db.session.commit()
        return student

    @staticmethod
    def ensure_admin(user: User):
        if user.role != UserRole.ADMIN:
            raise ApiError("Forbidden", HTTPStatus.FORBIDDEN)
