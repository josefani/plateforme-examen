from __future__ import annotations

import os

from flask import Flask, current_app, jsonify, request

from app.config import config_by_name
from app.extensions import cors, db, jwt, limiter, migrate
from app.services.audit_service import AuditService
from app.services.exam_service import ExamService
from app.utils.errors import register_error_handlers
from app.utils.time import utcnow


def create_app(config_name: str | None = None) -> Flask:
    app = Flask(__name__)

    environment = config_name or os.getenv("FLASK_ENV", "development")
    app.config.from_object(config_by_name.get(environment, config_by_name["development"]))

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    limiter.init_app(app)

    register_blueprints(app)
    register_error_handlers(app)
    register_hooks(app)
    register_shell_context(app)

    @app.get("/health")
    def healthcheck():
        return jsonify({"status": "ok", "timestamp": utcnow().isoformat()})

    return app


def register_blueprints(app: Flask):
    from app.api.admin.routes import admin_bp
    from app.api.auth.routes import auth_bp
    from app.api.student.routes import student_bp
    from app.services.seed_service import register_seed_command

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(student_bp, url_prefix="/api/student")
    register_seed_command(app)


def register_hooks(app: Flask):
    from app.models.user import User

    @jwt.user_lookup_loader
    def load_user(_jwt_header, jwt_data):
        identity = jwt_data["sub"]
        return User.query.get(int(identity))

    @app.before_request
    def apply_attempt_safety_checks():
        if request.path.startswith("/api/"):
            ExamService.finalize_stale_attempts()
            ExamService.finalize_missing_heartbeats(current_app.config["HEARTBEAT_GRACE_SECONDS"])

    @app.after_request
    def add_default_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    @jwt.unauthorized_loader
    def handle_missing_token(reason):
        return jsonify({"message": reason}), 401

    @jwt.invalid_token_loader
    def handle_invalid_token(reason):
        return jsonify({"message": reason}), 401

    @jwt.expired_token_loader
    def handle_expired_token(_jwt_header, jwt_payload):
        return jsonify({"message": "Token expired", "details": {"type": jwt_payload.get("type")}}), 401

    @jwt.revoked_token_loader
    def handle_revoked_token(_jwt_header, _jwt_payload):
        return jsonify({"message": "Token revoked"}), 401

    @jwt.needs_fresh_token_loader
    def handle_fresh_token(_jwt_header, _jwt_payload):
        return jsonify({"message": "Fresh token required"}), 401


def register_shell_context(app: Flask):
    from app.extensions import db
    from app.models import Answer, Attempt, Exam, Group, Question, Result, User

    @app.shell_context_processor
    def shell_context():
        return {
            "db": db,
            "User": User,
            "Group": Group,
            "Question": Question,
            "Exam": Exam,
            "Attempt": Attempt,
            "Answer": Answer,
            "Result": Result,
            "AuditService": AuditService,
        }
