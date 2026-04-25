from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user

from app.models.enums import UserRole
from app.models.exam import Answer, Exam, Question
from app.models.group import Group
from app.models.user import User
from app.schemas.admin import (
    AssignmentSchema,
    ExamSchema,
    GroupSchema,
    ManualGradingSchema,
    PublishResultsSchema,
    QuestionSchema,
    StudentCreateSchema,
    StudentUpdateSchema,
)
from app.services.admin_service import AdminService
from app.services.audit_service import AuditService
from app.utils.decorators import role_required


admin_bp = Blueprint("admin", __name__)

student_create_schema = StudentCreateSchema()
student_update_schema = StudentUpdateSchema()
group_schema = GroupSchema()
question_schema = QuestionSchema()
exam_schema = ExamSchema()
assignment_schema = AssignmentSchema()
manual_grading_schema = ManualGradingSchema()
publish_results_schema = PublishResultsSchema()


@admin_bp.get("/dashboard")
@role_required("admin")
def dashboard():
    return jsonify(AdminService.dashboard_summary())


@admin_bp.get("/students")
@role_required("admin")
def list_students():
    return jsonify({"items": AdminService.list_students()})


@admin_bp.post("/students")
@role_required("admin")
def create_student():
    payload = student_create_schema.load(request.get_json() or {})
    student = AdminService.create_student(payload)
    return jsonify({"item": student.to_dict(include_groups=True)}), 201


@admin_bp.patch("/students/<int:student_id>")
@role_required("admin")
def update_student(student_id: int):
    student = User.query.filter_by(id=student_id, role=UserRole.STUDENT).first_or_404()
    payload = student_update_schema.load(request.get_json() or {})
    student = AdminService.update_student(student, payload)
    return jsonify({"item": student.to_dict(include_groups=True)})


@admin_bp.delete("/students/<int:student_id>")
@role_required("admin")
def delete_student(student_id: int):
    student = User.query.filter_by(id=student_id, role=UserRole.STUDENT).first_or_404()
    AdminService.delete_student(student)
    return "", 204


@admin_bp.get("/groups")
@role_required("admin")
def list_groups():
    return jsonify({"items": AdminService.list_groups()})


@admin_bp.post("/groups")
@role_required("admin")
def create_group():
    payload = group_schema.load(request.get_json() or {})
    group = AdminService.create_group(payload)
    return jsonify({"item": group.to_dict()}), 201


@admin_bp.put("/groups/<int:group_id>")
@role_required("admin")
def update_group(group_id: int):
    group = Group.query.get_or_404(group_id)
    payload = group_schema.load(request.get_json() or {})
    group = AdminService.update_group(group, payload)
    return jsonify({"item": group.to_dict()})


@admin_bp.delete("/groups/<int:group_id>")
@role_required("admin")
def delete_group(group_id: int):
    group = Group.query.get_or_404(group_id)
    AdminService.delete_group(group)
    return "", 204


@admin_bp.get("/questions")
@role_required("admin")
def list_questions():
    return jsonify({"items": AdminService.list_questions()})


@admin_bp.post("/questions")
@role_required("admin")
def create_question():
    payload = question_schema.load(request.get_json() or {})
    question = AdminService.create_question(payload)
    return jsonify({"item": question.to_dict()}), 201


@admin_bp.put("/questions/<int:question_id>")
@role_required("admin")
def update_question(question_id: int):
    question = Question.query.get_or_404(question_id)
    payload = question_schema.load(request.get_json() or {})
    question = AdminService.update_question(question, payload)
    return jsonify({"item": question.to_dict()})


@admin_bp.get("/exams")
@role_required("admin")
def list_exams():
    return jsonify({"items": AdminService.list_exams()})


@admin_bp.post("/exams")
@role_required("admin")
def create_exam():
    payload = exam_schema.load(request.get_json() or {})
    exam = AdminService.create_exam(payload)
    return jsonify({"item": exam.to_dict(include_assignments=True)}), 201


@admin_bp.get("/exams/<int:exam_id>")
@role_required("admin")
def get_exam(exam_id: int):
    exam = Exam.query.get_or_404(exam_id)
    return jsonify({"item": exam.to_dict(include_assignments=True)})


@admin_bp.put("/exams/<int:exam_id>")
@role_required("admin")
def update_exam(exam_id: int):
    exam = Exam.query.get_or_404(exam_id)
    payload = exam_schema.load(request.get_json() or {})
    exam = AdminService.update_exam(exam, payload)
    return jsonify({"item": exam.to_dict(include_assignments=True)})


@admin_bp.get("/assignments")
@role_required("admin")
def list_assignments():
    return jsonify({"items": AdminService.list_assignments()})


@admin_bp.post("/exams/<int:exam_id>/assignments")
@role_required("admin")
def assign_exam(exam_id: int):
    exam = Exam.query.get_or_404(exam_id)
    payload = assignment_schema.load(request.get_json() or {})
    exam = AdminService.assign_exam(exam, payload)
    return jsonify({"item": exam.to_dict(include_assignments=True)})


@admin_bp.get("/grading/pending")
@role_required("admin")
def pending_grading():
    return jsonify({"items": AdminService.pending_manual_grading()})


@admin_bp.post("/answers/<int:answer_id>/grade")
@role_required("admin")
def grade_answer(answer_id: int):
    answer = Answer.query.get_or_404(answer_id)
    payload = manual_grading_schema.load(request.get_json() or {})
    from app.services.exam_service import ExamService

    updated_attempt = ExamService.grade_short_text(answer, current_user, payload["awarded_points"], payload.get("feedback"))
    AuditService.log_event(
        "manual_grading",
        user=current_user,
        attempt=updated_attempt,
        details={"answer_id": answer.id},
        commit=True,
    )
    return jsonify({"item": updated_attempt.to_dict(include_answers=False)})


@admin_bp.get("/results")
@role_required("admin")
def results():
    return jsonify({"items": AdminService.results_summary()})


@admin_bp.post("/results/publish")
@role_required("admin")
def publish_results():
    payload = publish_results_schema.load(request.get_json() or {})
    published_ids = AdminService.publish_results(payload, current_user)
    return jsonify({"published_attempt_ids": published_ids})
