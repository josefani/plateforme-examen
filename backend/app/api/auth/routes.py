from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, create_refresh_token, current_user, jwt_required

from app.extensions import limiter
from app.schemas.auth import LoginSchema, StudentRegistrationSchema
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService


auth_bp = Blueprint("auth", __name__)

login_schema = LoginSchema()
registration_schema = StudentRegistrationSchema()


def _auth_payload(user):
    additional_claims = {"role": user.role.value, "email": user.email}
    access_token = create_access_token(identity=str(user.id), additional_claims=additional_claims)
    refresh_token = create_refresh_token(identity=str(user.id), additional_claims=additional_claims)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user.to_dict(include_groups=True),
    }


@auth_bp.post("/login")
@limiter.limit(lambda: current_app.config["LOGIN_RATE_LIMIT"])
def login():
    payload = login_schema.load(request.get_json() or {})
    user = AuthService.authenticate(payload["email"], payload["password"])
    AuditService.log_event("login", user=user, details={"role": user.role.value}, commit=True)
    return jsonify(_auth_payload(user))


@auth_bp.post("/register")
@limiter.limit(lambda: current_app.config["LOGIN_RATE_LIMIT"])
def register_student():
    payload = registration_schema.load(request.get_json() or {})
    user = AuthService.register_student(payload)
    AuditService.log_event("student_registered", user=user, details={"email": user.email}, commit=True)
    return jsonify(_auth_payload(user)), 201


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    additional_claims = {"role": current_user.role.value, "email": current_user.email}
    access_token = create_access_token(identity=str(current_user.id), additional_claims=additional_claims)
    return jsonify({"access_token": access_token})


@auth_bp.get("/me")
@jwt_required()
def me():
    return jsonify({"user": current_user.to_dict(include_groups=True)})
