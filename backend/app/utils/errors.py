from __future__ import annotations

from http import HTTPStatus

from flask import jsonify
from marshmallow import ValidationError
from werkzeug.exceptions import HTTPException


class ApiError(Exception):
    def __init__(self, message: str, status_code: int = HTTPStatus.BAD_REQUEST, details=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(error: ApiError):
        return (
            jsonify(
                {
                    "message": error.message,
                    "details": error.details,
                }
            ),
            error.status_code,
        )

    @app.errorhandler(ValidationError)
    def handle_validation_error(error: ValidationError):
        return jsonify({"message": "Validation error", "details": error.messages}), HTTPStatus.UNPROCESSABLE_ENTITY

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException):
        return jsonify({"message": error.description}), error.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        app.logger.exception("Unexpected error", exc_info=error)
        return jsonify({"message": "Internal server error"}), HTTPStatus.INTERNAL_SERVER_ERROR
