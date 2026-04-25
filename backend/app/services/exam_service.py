from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from http import HTTPStatus

from sqlalchemy import and_, or_
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.enums import (
    AssignmentTargetType,
    AttemptStatus,
    QuestionType,
)
from app.models.exam import Answer, Attempt, Exam, ExamAssignment, ExamQuestion, ManualGrading, Question, Result
from app.models.group import GroupMember
from app.models.user import User
from app.services.audit_service import AuditService
from app.utils.errors import ApiError
from app.utils.serializers import serialize_decimal
from app.utils.time import utcnow


def _as_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


@dataclass
class AssignmentAccess:
    exam: Exam
    assignments: list[ExamAssignment]


class ExamService:
    @staticmethod
    def assigned_exam_query(student: User):
        group_ids = [membership.group_id for membership in student.group_memberships]
        return (
            Exam.query.options(
                joinedload(Exam.question_items).joinedload(ExamQuestion.question).joinedload(Question.choices),
                joinedload(Exam.assignments).joinedload(ExamAssignment.student),
                joinedload(Exam.assignments).joinedload(ExamAssignment.group),
                joinedload(Exam.attempts),
            )
            .join(ExamAssignment)
            .filter(
                or_(
                    and_(
                        ExamAssignment.target_type == AssignmentTargetType.STUDENT,
                        ExamAssignment.student_id == student.id,
                    ),
                    and_(
                        ExamAssignment.target_type == AssignmentTargetType.GROUP,
                        ExamAssignment.group_id.in_(group_ids or [-1]),
                    ),
                )
            )
            .distinct()
        )

    @staticmethod
    def get_student_exam_access(student: User, exam_id: int) -> AssignmentAccess:
        exam = (
            ExamService.assigned_exam_query(student)
            .filter(Exam.id == exam_id)
            .first()
        )
        if exam is None or exam.status.value != "published":
            raise ApiError("Exam not found", HTTPStatus.NOT_FOUND)

        assignments = []
        group_ids = {membership.group_id for membership in student.group_memberships}
        for assignment in exam.assignments:
            if assignment.target_type == AssignmentTargetType.STUDENT and assignment.student_id == student.id:
                assignments.append(assignment)
            if assignment.target_type == AssignmentTargetType.GROUP and assignment.group_id in group_ids:
                assignments.append(assignment)
        if not assignments:
            raise ApiError("Exam not assigned", HTTPStatus.FORBIDDEN)
        return AssignmentAccess(exam=exam, assignments=assignments)

    @staticmethod
    def compute_deadline(exam: Exam, started_at):
        duration_deadline = started_at + timedelta(minutes=exam.duration_minutes)
        if exam.mode.value == "scheduled" and exam.available_until is not None:
            return min(duration_deadline, exam.available_until)
        return duration_deadline

    @staticmethod
    def can_start_exam(exam: Exam):
        now = utcnow()
        if exam.available_from and now < exam.available_from:
            return False
        if exam.available_until and now > exam.available_until:
            return False
        return True

    @staticmethod
    def build_student_exam_summary(exam: Exam, student: User):
        attempt = next((item for item in exam.attempts if item.student_id == student.id), None)
        now = utcnow()
        if attempt:
            availability = attempt.status.value
        elif exam.available_from and now < exam.available_from:
            availability = "upcoming"
        elif exam.available_until and now > exam.available_until:
            availability = "closed"
        else:
            availability = "open"

        return {
            **exam.to_dict(include_questions=False),
            "attempt": attempt.to_dict(include_answers=False) if attempt else None,
            "availability": availability,
        }

    @staticmethod
    def list_student_exams(student: User):
        exams = ExamService.assigned_exam_query(student).order_by(Exam.available_from.asc().nullslast(), Exam.title.asc()).all()
        return [ExamService.build_student_exam_summary(exam, student) for exam in exams]

    @staticmethod
    def _shuffle_sequence(items, seed_value: str):
        ordered = list(items)
        randomizer = random.Random(seed_value)
        randomizer.shuffle(ordered)
        return ordered

    @staticmethod
    def build_attempt_payload(attempt: Attempt):
        exam = attempt.exam
        exam_questions = list(exam.question_items)
        if exam.shuffle_questions:
            exam_questions = ExamService._shuffle_sequence(exam_questions, f"exam-{attempt.id}")

        answers_by_question = {answer.question_id: answer for answer in attempt.answers}
        question_payloads = []
        for index, exam_question in enumerate(exam_questions, start=1):
            question = exam_question.question
            choices = list(question.choices)
            if exam.shuffle_choices and choices:
                choices = ExamService._shuffle_sequence(choices, f"question-{attempt.id}-{question.id}")
            question_payloads.append(
                {
                    "position": index,
                    "exam_question_id": exam_question.id,
                    "points": serialize_decimal(exam_question.points),
                    "question": {
                        **question.to_dict(include_correct_answers=False),
                        "choices": [choice.to_dict(include_correct_answer=False) for choice in choices],
                    },
                    "answer": answers_by_question[question.id].to_dict(),
                }
            )

        return {
            "attempt": attempt.to_dict(include_answers=False),
            "exam": exam.to_dict(include_questions=False, include_assignments=False),
            "questions": question_payloads,
        }

    @staticmethod
    def _ensure_attempt_open(attempt: Attempt):
        if attempt.status != AttemptStatus.IN_PROGRESS:
            raise ApiError("Attempt is no longer active", HTTPStatus.CONFLICT)
        if utcnow() > attempt.deadline_at:
            ExamService.submit_attempt(attempt, auto=True, reason="timeout")
            raise ApiError("Attempt timed out and was submitted automatically", HTTPStatus.CONFLICT)

    @staticmethod
    def start_attempt(student: User, exam_id: int):
        access = ExamService.get_student_exam_access(student, exam_id)
        exam = access.exam
        if not ExamService.can_start_exam(exam):
            raise ApiError("Exam is not currently available", HTTPStatus.CONFLICT)

        existing_attempt = Attempt.query.filter_by(exam_id=exam.id, student_id=student.id).first()
        if existing_attempt:
            if existing_attempt.status == AttemptStatus.IN_PROGRESS:
                return existing_attempt
            raise ApiError("An attempt already exists for this exam", HTTPStatus.CONFLICT)

        started_at = utcnow()
        deadline_at = ExamService.compute_deadline(exam, started_at)
        if deadline_at <= started_at:
            raise ApiError("Exam window already closed", HTTPStatus.CONFLICT)

        attempt = Attempt(
            exam=exam,
            student=student,
            assignment=access.assignments[0],
            status=AttemptStatus.IN_PROGRESS,
            started_at=started_at,
            deadline_at=deadline_at,
            last_heartbeat_at=started_at,
            max_score=_as_decimal(exam.total_points()),
        )
        db.session.add(attempt)
        db.session.flush()

        for exam_question in exam.question_items:
            db.session.add(
                Answer(
                    attempt=attempt,
                    question=exam_question.question,
                    selected_choice_ids=[],
                )
            )

        AuditService.log_event("exam_started", user=student, attempt=attempt, details={"exam_id": exam.id})
        db.session.commit()
        return attempt

    @staticmethod
    def get_attempt_for_student(student: User, attempt_id: int):
        attempt = (
            Attempt.query.options(
                joinedload(Attempt.exam).joinedload(Exam.question_items).joinedload(ExamQuestion.question).joinedload(Question.choices),
                joinedload(Attempt.answers).joinedload(Answer.question).joinedload(Question.choices),
                joinedload(Attempt.result),
            )
            .filter_by(id=attempt_id, student_id=student.id)
            .first()
        )
        if attempt is None:
            raise ApiError("Attempt not found", HTTPStatus.NOT_FOUND)
        if attempt.status == AttemptStatus.IN_PROGRESS and utcnow() > attempt.deadline_at:
            ExamService.submit_attempt(attempt, auto=True, reason="timeout")
            attempt = Attempt.query.get(attempt.id)
        return attempt

    @staticmethod
    def save_attempt_answers(attempt: Attempt, answers_data: list[dict], save_mode: str, user: User):
        ExamService._ensure_attempt_open(attempt)

        answers_by_question = {answer.question_id: answer for answer in attempt.answers}
        for item in answers_data:
            answer = answers_by_question.get(item["question_id"])
            if answer is None:
                raise ApiError(f"Question {item['question_id']} is not part of this attempt.", HTTPStatus.BAD_REQUEST)

            if answer.question.type == QuestionType.SHORT_TEXT:
                text = item.get("text_answer")
                answer.text_answer = text.strip() if isinstance(text, str) and text.strip() else None
                answer.boolean_answer = None
                answer.selected_choice_ids = []
            elif answer.question.type == QuestionType.TRUE_FALSE:
                answer.boolean_answer = item.get("boolean_answer")
                answer.text_answer = None
                answer.selected_choice_ids = []
            else:
                unique_choices = sorted({int(choice_id) for choice_id in item.get("selected_choice_ids", [])})
                valid_choice_ids = {choice.id for choice in answer.question.choices}
                if any(choice_id not in valid_choice_ids for choice_id in unique_choices):
                    raise ApiError("One or more selected choices are invalid.", HTTPStatus.BAD_REQUEST)
                if answer.question.type == QuestionType.SINGLE_CHOICE and len(unique_choices) > 1:
                    raise ApiError("single_choice questions accept only one answer.", HTTPStatus.BAD_REQUEST)
                answer.selected_choice_ids = unique_choices
                answer.text_answer = None
                answer.boolean_answer = None

        attempt.last_saved_at = utcnow()
        action = "autosave" if save_mode == "autosave" else "manual_save"
        AuditService.log_event(action, user=user, attempt=attempt, details={"count": len(answers_data)})
        db.session.commit()
        return attempt

    @staticmethod
    def record_event(attempt: Attempt, user: User, event_type: str, details: dict):
        if event_type in {"focus_lost", "visibility_hidden"}:
            attempt.focus_loss_count += 1
            attempt.suspicion_count += 1
        elif event_type in {"copy_blocked", "context_menu_blocked"}:
            attempt.suspicion_count += 1
        AuditService.log_event(event_type, user=user, attempt=attempt, details=details)
        db.session.commit()
        return attempt

    @staticmethod
    def heartbeat(attempt: Attempt, user: User):
        if attempt.status != AttemptStatus.IN_PROGRESS:
            return attempt
        if utcnow() > attempt.deadline_at:
            return ExamService.submit_attempt(attempt, auto=True, reason="timeout")
        attempt.last_heartbeat_at = utcnow()
        db.session.commit()
        return attempt

    @staticmethod
    def _grade_answer(answer: Answer, points: Decimal):
        question = answer.question
        if question.type == QuestionType.SHORT_TEXT:
            return False

        if question.type == QuestionType.TRUE_FALSE:
            correct = question.correct_boolean
            answer.is_correct = answer.boolean_answer == correct if answer.boolean_answer is not None else False
        else:
            correct_ids = sorted(choice.id for choice in question.choices if choice.is_correct)
            selected_ids = sorted(answer.selected_choice_ids or [])
            answer.is_correct = selected_ids == correct_ids

        answer.awarded_points = points if answer.is_correct else Decimal("0")
        return True

    @staticmethod
    def _sync_result(attempt: Attempt):
        total_points = sum(_as_decimal(answer.awarded_points) for answer in attempt.answers if answer.awarded_points is not None)
        max_points = _as_decimal(attempt.max_score)
        percentage = Decimal("0.00") if max_points == 0 else (total_points / max_points) * Decimal("100")

        if attempt.result is None:
            attempt.result = Result(
                total_points=total_points,
                max_points=max_points,
                percentage=percentage.quantize(Decimal("0.01")),
                is_published=False,
            )
        else:
            attempt.result.total_points = total_points
            attempt.result.max_points = max_points
            attempt.result.percentage = percentage.quantize(Decimal("0.01"))

        attempt.score = total_points

    @staticmethod
    def _has_pending_manual_grading(attempt: Attempt):
        return any(
            answer.question.type == QuestionType.SHORT_TEXT and answer.awarded_points is None
            for answer in attempt.answers
        )

    @staticmethod
    def submit_attempt(attempt: Attempt, auto: bool = False, reason: str | None = None):
        if attempt.status in {AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED, AttemptStatus.GRADED, AttemptStatus.TERMINATED}:
            return attempt

        now = utcnow()
        points_by_question = {item.question_id: _as_decimal(item.points) for item in attempt.exam.question_items}
        for answer in attempt.answers:
            answer.is_final = True
            ExamService._grade_answer(answer, points_by_question[answer.question_id])

        attempt.submitted_at = now
        attempt.last_saved_at = now
        attempt.auto_submit_reason = reason if auto else None
        ExamService._sync_result(attempt)

        if ExamService._has_pending_manual_grading(attempt):
            attempt.status = AttemptStatus.AUTO_SUBMITTED if auto else AttemptStatus.SUBMITTED
        else:
            attempt.status = AttemptStatus.GRADED
            if attempt.exam.auto_publish_results and not attempt.exam.has_manual_questions():
                if attempt.result is None:
                    ExamService._sync_result(attempt)
                attempt.result.is_published = True
                attempt.result.published_at = now

        action = "auto_submit" if auto else "submit"
        AuditService.log_event(action, user=attempt.student, attempt=attempt, details={"reason": reason})
        if reason == "timeout":
            AuditService.log_event("timeout", user=attempt.student, attempt=attempt, details={"deadline_at": attempt.deadline_at.isoformat()})
        db.session.commit()
        return attempt

    @staticmethod
    def grade_short_text(answer: Answer, grader: User, awarded_points, feedback: str | None):
        if answer.question.type != QuestionType.SHORT_TEXT:
            raise ApiError("Only short_text answers can be manually graded.", HTTPStatus.BAD_REQUEST)
        max_points = next(
            (_as_decimal(item.points) for item in answer.attempt.exam.question_items if item.question_id == answer.question_id),
            Decimal("0"),
        )
        normalized_points = _as_decimal(awarded_points)
        if normalized_points < 0 or normalized_points > max_points:
            raise ApiError("Awarded points are out of range for this question.", HTTPStatus.BAD_REQUEST)

        answer.awarded_points = normalized_points
        manual_grading = ManualGrading(
            answer=answer,
            grader=grader,
            awarded_points=answer.awarded_points,
            feedback=feedback,
        )
        db.session.add(manual_grading)

        attempt = answer.attempt
        ExamService._sync_result(attempt)
        if not ExamService._has_pending_manual_grading(attempt):
            attempt.status = AttemptStatus.GRADED
        db.session.commit()
        return attempt

    @staticmethod
    def publish_results(attempts: list[Attempt], admin: User):
        published_ids = []
        for attempt in attempts:
            if attempt.result is None:
                ExamService._sync_result(attempt)
            attempt.result.is_published = True
            attempt.result.published_at = utcnow()
            attempt.result.published_by = admin
            published_ids.append(attempt.id)
            AuditService.log_event(
                "results_published",
                user=admin,
                attempt=attempt,
                details={"exam_id": attempt.exam_id, "student_id": attempt.student_id},
            )
        db.session.commit()
        return published_ids

    @staticmethod
    def finalize_stale_attempts():
        now = utcnow()
        attempts = (
            Attempt.query.options(joinedload(Attempt.exam).joinedload(Exam.question_items), joinedload(Attempt.answers).joinedload(Answer.question).joinedload(Question.choices), joinedload(Attempt.student))
            .filter(Attempt.status == AttemptStatus.IN_PROGRESS)
            .all()
        )

        for attempt in attempts:
            if now > attempt.deadline_at:
                ExamService.submit_attempt(attempt, auto=True, reason="timeout")
                continue

    @staticmethod
    def finalize_missing_heartbeats(grace_seconds: int):
        now = utcnow()
        attempts = (
            Attempt.query.options(
                joinedload(Attempt.exam).joinedload(Exam.question_items),
                joinedload(Attempt.answers).joinedload(Answer.question).joinedload(Question.choices),
                joinedload(Attempt.student),
            )
            .filter(Attempt.status == AttemptStatus.IN_PROGRESS)
            .all()
        )
        for attempt in attempts:
            if attempt.last_heartbeat_at and now - attempt.last_heartbeat_at > timedelta(seconds=grace_seconds):
                ExamService.submit_attempt(attempt, auto=True, reason="heartbeat_missing")

    @staticmethod
    def create_retake_request(student: User, exam_id: int, reason: str | None):
        from app.models.exam import RetakeRequest

        attempt = Attempt.query.filter_by(exam_id=exam_id, student_id=student.id).first()
        if attempt is None:
            raise ApiError("No attempt found for this exam.", HTTPStatus.NOT_FOUND)
        if attempt.status == AttemptStatus.IN_PROGRESS:
            raise ApiError("Cannot request retake while attempt is still in progress.", HTTPStatus.CONFLICT)
        if attempt.result is None:
            raise ApiError("Results are not yet available.", HTTPStatus.CONFLICT)

        percentage = float(attempt.result.percentage) if attempt.result.percentage else 0
        if percentage >= 75:
            raise ApiError("You passed this exam. Retake is only available for failed exams.", HTTPStatus.CONFLICT)

        existing = RetakeRequest.query.filter_by(
            exam_id=exam_id, student_id=student.id, status="pending"
        ).first()
        if existing:
            raise ApiError("You already have a pending retake request for this exam.", HTTPStatus.CONFLICT)

        req = RetakeRequest(
            exam_id=exam_id,
            student_id=student.id,
            attempt_id=attempt.id,
            reason=reason,
            status="pending",
        )
        db.session.add(req)
        db.session.commit()
        return req
