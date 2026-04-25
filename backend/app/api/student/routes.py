from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from app.schemas.student import AttemptEventSchema, SaveAttemptSchema
from app.services.audit_service import AuditService
from app.services.exam_service import ExamService
from app.utils.decorators import role_required


student_bp = Blueprint("student", __name__)

save_attempt_schema = SaveAttemptSchema()
event_schema = AttemptEventSchema()


@student_bp.get("/exams")
@role_required("student")
def list_my_exams():
    return jsonify({"items": ExamService.list_student_exams(current_user)})


@student_bp.get("/exams/<int:exam_id>")
@role_required("student")
def exam_detail(exam_id: int):
    access = ExamService.get_student_exam_access(current_user, exam_id)
    return jsonify(
        {
            "item": ExamService.build_student_exam_summary(access.exam, current_user),
        }
    )


@student_bp.post("/exams/<int:exam_id>/start")
@role_required("student")
def start_exam(exam_id: int):
    attempt = ExamService.start_attempt(current_user, exam_id)
    return jsonify({"item": ExamService.build_attempt_payload(attempt)}), 201


@student_bp.get("/attempts/<int:attempt_id>")
@role_required("student")
def get_attempt(attempt_id: int):
    attempt = ExamService.get_attempt_for_student(current_user, attempt_id)
    return jsonify({"item": ExamService.build_attempt_payload(attempt)})


@student_bp.put("/attempts/<int:attempt_id>/save")
@role_required("student")
def save_attempt(attempt_id: int):
    attempt = ExamService.get_attempt_for_student(current_user, attempt_id)
    payload = save_attempt_schema.load(request.get_json() or {})
    attempt = ExamService.save_attempt_answers(attempt, payload["answers"], payload["save_mode"], current_user)
    return jsonify(
        {
            "item": attempt.to_dict(include_answers=False),
            "message": "Saved",
        }
    )


@student_bp.post("/attempts/<int:attempt_id>/heartbeat")
@role_required("student")
def heartbeat(attempt_id: int):
    attempt = ExamService.get_attempt_for_student(current_user, attempt_id)
    attempt = ExamService.heartbeat(attempt, current_user)
    return jsonify({"item": attempt.to_dict(include_answers=False)})


@student_bp.post("/attempts/<int:attempt_id>/events")
@role_required("student")
def record_event(attempt_id: int):
    attempt = ExamService.get_attempt_for_student(current_user, attempt_id)
    payload = event_schema.load(request.get_json() or {})
    attempt = ExamService.record_event(attempt, current_user, payload["event_type"], payload.get("details", {}))
    return jsonify({"item": attempt.to_dict(include_answers=False)})


@student_bp.post("/attempts/<int:attempt_id>/submit")
@role_required("student")
def submit_attempt(attempt_id: int):
    attempt = ExamService.get_attempt_for_student(current_user, attempt_id)
    attempt = ExamService.submit_attempt(attempt, auto=False)
    return jsonify({"item": attempt.to_dict(include_answers=False)})


@student_bp.get("/results")
@role_required("student")
def my_results():
    exams = ExamService.list_student_exams(current_user)
    items = [
        exam
        for exam in exams
        if exam.get("attempt")
        and exam["attempt"].get("result")
        and exam["attempt"]["result"].get("is_published")
    ]
    return jsonify({"items": items, "heartbeat_grace_seconds": current_app.config["HEARTBEAT_GRACE_SECONDS"]})
