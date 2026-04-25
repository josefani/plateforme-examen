from __future__ import annotations

from functools import wraps
from http import HTTPStatus

from flask_jwt_extended import current_user, verify_jwt_in_request

from app.utils.errors import ApiError


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            if current_user is None:
                raise ApiError("Authentication required", HTTPStatus.UNAUTHORIZED)
            if current_user.role.value not in roles:
                raise ApiError("Forbidden", HTTPStatus.FORBIDDEN)
            return fn(*args, **kwargs)

        return wrapper

    return decorator
