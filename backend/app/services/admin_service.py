from __future__ import annotations

from decimal import Decimal
from http import HTTPStatus

from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.enums import (
    AssignmentTargetType,
    AttemptStatus,
    ExamMode,
    ExamStatus,
    QuestionType,
    UserRole,
)
from app.models.exam import Answer, Attempt, Exam, ExamAssignment, ExamQuestion, Question, QuestionChoice, Result
from app.models.group import Group, GroupMember
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.exam_service import ExamService
from app.utils.errors import ApiError
from app.utils.security import hash_password


def _decimal(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


class AdminService:
    @staticmethod
    def dashboard_summary():
        pending_grading = (
            Answer.query.join(Attempt).join(Question)
            .filter(
                Question.type == QuestionType.SHORT_TEXT,
                Attempt.status.in_([AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED]),
                Answer.awarded_points.is_(None),
            )
            .count()
        )
        return {
            "students": User.query.filter_by(role=UserRole.STUDENT).count(),
            "groups": Group.query.count(),
            "questions": Question.query.count(),
            "published_exams": Exam.query.filter_by(status=ExamStatus.PUBLISHED).count(),
            "attempts_in_progress": Attempt.query.filter_by(status=AttemptStatus.IN_PROGRESS).count(),
            "pending_manual_grading": pending_grading,
            "published_results": Result.query.filter(Result.is_published.is_(True)).count(),
        }

    @staticmethod
    def list_students():
        students = (
            User.query.options(joinedload(User.group_memberships).joinedload(GroupMember.group))
            .filter_by(role=UserRole.STUDENT)
            .order_by(User.full_name.asc())
            .all()
        )
        return [student.to_dict(include_groups=True) for student in students]

    @staticmethod
    def _sync_student_groups(student: User, group_ids: list[int]):
        groups = Group.query.filter(Group.id.in_(group_ids or [-1])).all()
        if len(groups) != len(set(group_ids)):
            raise ApiError("One or more groups were not found.", HTTPStatus.BAD_REQUEST)

        student.group_memberships.clear()
        db.session.flush()
        for group in groups:
            student.group_memberships.append(GroupMember(group=group, student=student))

    @staticmethod
    def create_student(payload: dict):
        existing = User.query.filter_by(email=payload["email"].strip().lower()).first()
        if existing:
            raise ApiError("A user with this email already exists.", HTTPStatus.CONFLICT)

        student = User(
            full_name=payload["full_name"].strip(),
            email=payload["email"].strip().lower(),
            password_hash=hash_password(payload["password"]),
            role=UserRole.STUDENT,
            is_active=payload["is_active"],
        )
        db.session.add(student)
        db.session.flush()
        AdminService._sync_student_groups(student, payload.get("group_ids", []))
        db.session.commit()
        return student

    @staticmethod
    def update_student(student: User, payload: dict):
        if "full_name" in payload:
            student.full_name = payload["full_name"].strip()
        if "email" in payload:
            normalized_email = payload["email"].strip().lower()
            existing = User.query.filter(User.email == normalized_email, User.id != student.id).first()
            if existing:
                raise ApiError("A user with this email already exists.", HTTPStatus.CONFLICT)
            student.email = normalized_email
        if "password" in payload:
            student.password_hash = hash_password(payload["password"])
        if "is_active" in payload:
            student.is_active = payload["is_active"]
        if "group_ids" in payload:
            AdminService._sync_student_groups(student, payload["group_ids"])
        db.session.commit()
        return student

    @staticmethod
    def delete_student(student: User):
        db.session.delete(student)
        db.session.commit()

    @staticmethod
    def list_groups():
        groups = Group.query.options(joinedload(Group.members).joinedload(GroupMember.student)).order_by(Group.name.asc()).all()
        return [group.to_dict() for group in groups]

    @staticmethod
    def create_group(payload: dict):
        group = Group(name=payload["name"].strip(), description=payload.get("description"))
        db.session.add(group)
        db.session.flush()
        AdminService._sync_group_members(group, payload.get("member_ids", []))
        db.session.commit()
        return group

    @staticmethod
    def _sync_group_members(group: Group, member_ids: list[int]):
        members = User.query.filter(User.id.in_(member_ids or [-1]), User.role == UserRole.STUDENT).all()
        if len(members) != len(set(member_ids)):
            raise ApiError("One or more students were not found.", HTTPStatus.BAD_REQUEST)
        group.members.clear()
        db.session.flush()
        for student in members:
            group.members.append(GroupMember(group=group, student=student))

    @staticmethod
    def update_group(group: Group, payload: dict):
        group.name = payload["name"].strip()
        group.description = payload.get("description")
        AdminService._sync_group_members(group, payload.get("member_ids", []))
        db.session.commit()
        return group

    @staticmethod
    def delete_group(group: Group):
        db.session.delete(group)
        db.session.commit()

    @staticmethod
    def list_questions():
        questions = Question.query.options(joinedload(Question.choices)).order_by(Question.created_at.desc()).all()
        return [question.to_dict() for question in questions]

    @staticmethod
    def _replace_question_choices(question: Question, choices_data: list[dict]):
        question.choices.clear()
        for item in sorted(choices_data, key=lambda choice: choice.get("sort_order", 0)):
            question.choices.append(
                QuestionChoice(
                    label=item["label"].strip(),
                    sort_order=item.get("sort_order", 0),
                    is_correct=item.get("is_correct", False),
                )
            )

    @staticmethod
    def create_question(payload: dict):
        question = Question(
            type=QuestionType(payload["type"]),
            title=payload["title"].strip(),
            statement=payload["statement"].strip(),
            points=_decimal(payload["points"]),
            correct_boolean=payload.get("correct_boolean"),
            explanation=payload.get("explanation"),
            tags=payload.get("tags", []),
            difficulty=payload.get("difficulty"),
            is_active=payload.get("is_active", True),
        )
        db.session.add(question)
        db.session.flush()
        AdminService._replace_question_choices(question, payload.get("choices", []))
        db.session.commit()
        return question

    @staticmethod
    def update_question(question: Question, payload: dict):
        question.type = QuestionType(payload["type"])
        question.title = payload["title"].strip()
        question.statement = payload["statement"].strip()
        question.points = _decimal(payload["points"])
        question.correct_boolean = payload.get("correct_boolean")
        question.explanation = payload.get("explanation")
        question.tags = payload.get("tags", [])
        question.difficulty = payload.get("difficulty")
        question.is_active = payload.get("is_active", True)
        AdminService._replace_question_choices(question, payload.get("choices", []))
        db.session.commit()
        return question

    @staticmethod
    def list_exams():
        exams = (
            Exam.query.options(
                joinedload(Exam.question_items).joinedload(ExamQuestion.question),
                joinedload(Exam.assignments).joinedload(ExamAssignment.group),
                joinedload(Exam.assignments).joinedload(ExamAssignment.student),
            )
            .order_by(Exam.created_at.desc())
            .all()
        )
        return [exam.to_dict(include_assignments=True) for exam in exams]

    @staticmethod
    def _replace_exam_questions(exam: Exam, items: list[dict]):
        questions = Question.query.filter(Question.id.in_([item["question_id"] for item in items])).all()
        by_id = {question.id: question for question in questions}
        if len(by_id) != len({item["question_id"] for item in items}):
            raise ApiError("One or more questions were not found.", HTTPStatus.BAD_REQUEST)

        exam.question_items.clear()
        for item in sorted(items, key=lambda exam_item: exam_item.get("sort_order", 0)):
            question = by_id[item["question_id"]]
            exam.question_items.append(
                ExamQuestion(
                    question=question,
                    sort_order=item.get("sort_order", 0),
                    points=_decimal(item["points"]),
                )
            )

    @staticmethod
    def create_exam(payload: dict):
        exam = Exam(
            title=payload["title"].strip(),
            description=payload.get("description"),
            instructions=payload.get("instructions"),
            duration_minutes=payload["duration_minutes"],
            shuffle_questions=payload.get("shuffle_questions", False),
            shuffle_choices=payload.get("shuffle_choices", False),
            mode=ExamMode(payload["mode"]),
            available_from=payload.get("available_from"),
            available_until=payload.get("available_until"),
            auto_publish_results=payload.get("auto_publish_results", False),
            status=ExamStatus(payload.get("status", ExamStatus.DRAFT.value)),
        )
        db.session.add(exam)
        db.session.flush()
        AdminService._replace_exam_questions(exam, payload["questions"])
        db.session.commit()
        return exam

    @staticmethod
    def update_exam(exam: Exam, payload: dict):
        exam.title = payload["title"].strip()
        exam.description = payload.get("description")
        exam.instructions = payload.get("instructions")
        exam.duration_minutes = payload["duration_minutes"]
        exam.shuffle_questions = payload.get("shuffle_questions", False)
        exam.shuffle_choices = payload.get("shuffle_choices", False)
        exam.mode = ExamMode(payload["mode"])
        exam.available_from = payload.get("available_from")
        exam.available_until = payload.get("available_until")
        exam.auto_publish_results = payload.get("auto_publish_results", False)
        exam.status = ExamStatus(payload.get("status", ExamStatus.DRAFT.value))
        AdminService._replace_exam_questions(exam, payload["questions"])
        db.session.commit()
        return exam

    @staticmethod
    def assign_exam(exam: Exam, payload: dict):
        student_ids = set(payload.get("student_ids", []))
        group_ids = set(payload.get("group_ids", []))
        students = User.query.filter(User.id.in_(student_ids or [-1]), User.role == UserRole.STUDENT).all()
        groups = Group.query.filter(Group.id.in_(group_ids or [-1])).all()
        if len(students) != len(student_ids) or len(groups) != len(group_ids):
            raise ApiError("Invalid student or group selection.", HTTPStatus.BAD_REQUEST)

        existing_student_ids = {
            assignment.student_id
            for assignment in exam.assignments
            if assignment.target_type == AssignmentTargetType.STUDENT
        }
        existing_group_ids = {
            assignment.group_id
            for assignment in exam.assignments
            if assignment.target_type == AssignmentTargetType.GROUP
        }

        for student in students:
            if student.id not in existing_student_ids:
                exam.assignments.append(
                    ExamAssignment(
                        target_type=AssignmentTargetType.STUDENT,
                        student=student,
                    )
                )

        for group in groups:
            if group.id not in existing_group_ids:
                exam.assignments.append(
                    ExamAssignment(
                        target_type=AssignmentTargetType.GROUP,
                        group=group,
                    )
                )

        db.session.commit()
        return exam

    @staticmethod
    def list_assignments():
        assignments = (
            ExamAssignment.query.options(
                joinedload(ExamAssignment.exam),
                joinedload(ExamAssignment.student),
                joinedload(ExamAssignment.group),
            )
            .order_by(ExamAssignment.created_at.desc())
            .all()
        )
        return [
            {
                **assignment.to_dict(),
                "exam": assignment.exam.to_dict(include_questions=False),
            }
            for assignment in assignments
        ]

    @staticmethod
    def pending_manual_grading():
        answers = (
            Answer.query.options(
                joinedload(Answer.question).joinedload(Question.choices),
                joinedload(Answer.attempt).joinedload(Attempt.student),
                joinedload(Answer.attempt).joinedload(Attempt.exam),
            )
            .join(Attempt)
            .join(Question)
            .filter(
                Question.type == QuestionType.SHORT_TEXT,
                Attempt.status.in_([AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED]),
                Answer.awarded_points.is_(None),
            )
            .order_by(Attempt.submitted_at.asc())
            .all()
        )
        return [
            {
                "answer": answer.to_dict(include_question=True),
                "attempt": answer.attempt.to_dict(include_answers=False, include_result=False),
                "student": answer.attempt.student.to_dict(),
                "exam": answer.attempt.exam.to_dict(include_questions=False),
            }
            for answer in answers
        ]

    @staticmethod
    def results_summary():
        attempts = (
            Attempt.query.options(
                joinedload(Attempt.student),
                joinedload(Attempt.exam),
                joinedload(Attempt.result),
            )
            .order_by(Attempt.created_at.desc())
            .all()
        )
        return [
            {
                "attempt": attempt.to_dict(include_answers=False),
                "student": attempt.student.to_dict(),
                "exam": attempt.exam.to_dict(include_questions=False),
            }
            for attempt in attempts
        ]

    @staticmethod
    def publish_results(payload: dict, admin: User):
        attempts_query = Attempt.query.options(joinedload(Attempt.result), joinedload(Attempt.exam), joinedload(Attempt.student))
        if payload.get("exam_id"):
            attempts = attempts_query.filter_by(exam_id=payload["exam_id"]).all()
        else:
            attempts = attempts_query.filter(Attempt.id.in_(payload.get("attempt_ids", []))).all()
        if not attempts:
            raise ApiError("No attempts found to publish.", HTTPStatus.NOT_FOUND)
        if any(attempt.status == AttemptStatus.IN_PROGRESS for attempt in attempts):
            raise ApiError("In-progress attempts cannot be published.", HTTPStatus.CONFLICT)
        if any(ExamService._has_pending_manual_grading(attempt) for attempt in attempts):
            raise ApiError("Some attempts still require manual grading.", HTTPStatus.CONFLICT)
        return ExamService.publish_results(attempts, admin)
