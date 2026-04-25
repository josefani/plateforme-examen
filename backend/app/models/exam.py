from __future__ import annotations

from app.extensions import db
from app.models.enums import (
    AssignmentTargetType,
    AttemptStatus,
    ExamMode,
    ExamStatus,
    QuestionType,
)
from app.models.mixins import TimestampMixin
from app.utils.serializers import serialize_datetime, serialize_decimal


class Question(TimestampMixin, db.Model):
    __tablename__ = "questions"

    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.Enum(QuestionType, native_enum=False), nullable=False, index=True)
    title = db.Column(db.String(180), nullable=False)
    statement = db.Column(db.Text, nullable=False)
    points = db.Column(db.Numeric(8, 2), nullable=False)
    correct_boolean = db.Column(db.Boolean, nullable=True)
    explanation = db.Column(db.Text, nullable=True)
    tags = db.Column(db.JSON, nullable=False, default=list)
    difficulty = db.Column(db.String(50), nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    choices = db.relationship(
        "QuestionChoice",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuestionChoice.sort_order",
    )
    exam_links = db.relationship("ExamQuestion", back_populates="question")
    answers = db.relationship("Answer", back_populates="question")

    def to_dict(self, include_correct_answers: bool = True):
        payload = {
            "id": self.id,
            "type": self.type.value,
            "title": self.title,
            "statement": self.statement,
            "points": serialize_decimal(self.points),
            "tags": self.tags or [],
            "difficulty": self.difficulty,
            "is_active": self.is_active,
            "created_at": serialize_datetime(self.created_at),
            "updated_at": serialize_datetime(self.updated_at),
        }
        payload["choices"] = [
            choice.to_dict(include_correct_answer=include_correct_answers)
            for choice in self.choices
        ]
        if include_correct_answers:
            payload["explanation"] = self.explanation
            payload["correct_boolean"] = self.correct_boolean
        else:
            payload["explanation"] = None
        return payload


class QuestionChoice(TimestampMixin, db.Model):
    __tablename__ = "question_choices"

    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    label = db.Column(db.Text, nullable=False)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    is_correct = db.Column(db.Boolean, nullable=False, default=False)

    question = db.relationship("Question", back_populates="choices")

    def to_dict(self, include_correct_answer: bool = True):
        payload = {
            "id": self.id,
            "label": self.label,
            "sort_order": self.sort_order,
        }
        if include_correct_answer:
            payload["is_correct"] = self.is_correct
        return payload


class Exam(TimestampMixin, db.Model):
    __tablename__ = "exams"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(180), nullable=False)
    description = db.Column(db.Text, nullable=True)
    instructions = db.Column(db.Text, nullable=True)
    duration_minutes = db.Column(db.Integer, nullable=False)
    shuffle_questions = db.Column(db.Boolean, nullable=False, default=False)
    shuffle_choices = db.Column(db.Boolean, nullable=False, default=False)
    mode = db.Column(db.Enum(ExamMode, native_enum=False), nullable=False, default=ExamMode.SCHEDULED)
    available_from = db.Column(db.DateTime(timezone=True), nullable=True, index=True)
    available_until = db.Column(db.DateTime(timezone=True), nullable=True, index=True)
    auto_publish_results = db.Column(db.Boolean, nullable=False, default=False)
    status = db.Column(db.Enum(ExamStatus, native_enum=False), nullable=False, default=ExamStatus.DRAFT, index=True)

    question_items = db.relationship(
        "ExamQuestion",
        back_populates="exam",
        cascade="all, delete-orphan",
        order_by="ExamQuestion.sort_order",
    )
    assignments = db.relationship("ExamAssignment", back_populates="exam", cascade="all, delete-orphan")
    attempts = db.relationship("Attempt", back_populates="exam")

    def total_points(self):
        return sum(serialize_decimal(item.points) or 0 for item in self.question_items)

    def has_manual_questions(self):
        return any(item.question.type == QuestionType.SHORT_TEXT for item in self.question_items)

    def to_dict(self, include_questions: bool = True, include_assignments: bool = False):
        payload = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "instructions": self.instructions,
            "duration_minutes": self.duration_minutes,
            "shuffle_questions": self.shuffle_questions,
            "shuffle_choices": self.shuffle_choices,
            "mode": self.mode.value,
            "available_from": serialize_datetime(self.available_from),
            "available_until": serialize_datetime(self.available_until),
            "auto_publish_results": self.auto_publish_results,
            "status": self.status.value,
            "total_points": self.total_points(),
            "created_at": serialize_datetime(self.created_at),
            "updated_at": serialize_datetime(self.updated_at),
        }
        if include_questions:
            payload["questions"] = [item.to_dict() for item in self.question_items]
        if include_assignments:
            payload["assignments"] = [assignment.to_dict() for assignment in self.assignments]
        return payload


class ExamQuestion(TimestampMixin, db.Model):
    __tablename__ = "exam_questions"
    __table_args__ = (
        db.UniqueConstraint("exam_id", "question_id", name="uq_exam_question"),
    )

    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = db.Column(db.Integer, db.ForeignKey("questions.id", ondelete="RESTRICT"), nullable=False, index=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    points = db.Column(db.Numeric(8, 2), nullable=False)

    exam = db.relationship("Exam", back_populates="question_items")
    question = db.relationship("Question", back_populates="exam_links")

    def to_dict(self):
        return {
            "id": self.id,
            "question_id": self.question_id,
            "sort_order": self.sort_order,
            "points": serialize_decimal(self.points),
            "question": self.question.to_dict(),
        }


class ExamAssignment(TimestampMixin, db.Model):
    __tablename__ = "exam_assignments"
    __table_args__ = (
        db.UniqueConstraint("exam_id", "student_id", name="uq_exam_assignment_student"),
        db.UniqueConstraint("exam_id", "group_id", name="uq_exam_assignment_group"),
    )

    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = db.Column(
        db.Enum(AssignmentTargetType, native_enum=False),
        nullable=False,
        index=True,
    )
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id", ondelete="CASCADE"), nullable=True, index=True)

    exam = db.relationship("Exam", back_populates="assignments")
    student = db.relationship("User")
    group = db.relationship("Group", back_populates="assignments")
    attempts = db.relationship("Attempt", back_populates="assignment")

    def to_dict(self):
        return {
            "id": self.id,
            "target_type": self.target_type.value,
            "student": self.student.to_dict() if self.student else None,
            "group": self.group.to_dict(include_members=False) if self.group else None,
            "assigned_at": serialize_datetime(self.created_at),
        }


class Attempt(TimestampMixin, db.Model):
    __tablename__ = "attempts"
    __table_args__ = (
        db.UniqueConstraint("exam_id", "student_id", name="uq_exam_student_attempt"),
    )

    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assignment_id = db.Column(
        db.Integer,
        db.ForeignKey("exam_assignments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status = db.Column(
        db.Enum(AttemptStatus, native_enum=False),
        nullable=False,
        default=AttemptStatus.IN_PROGRESS,
        index=True,
    )
    started_at = db.Column(db.DateTime(timezone=True), nullable=False)
    deadline_at = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    submitted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    terminated_at = db.Column(db.DateTime(timezone=True), nullable=True)
    last_saved_at = db.Column(db.DateTime(timezone=True), nullable=True)
    last_heartbeat_at = db.Column(db.DateTime(timezone=True), nullable=True)
    auto_submit_reason = db.Column(db.String(255), nullable=True)
    suspicion_count = db.Column(db.Integer, nullable=False, default=0)
    focus_loss_count = db.Column(db.Integer, nullable=False, default=0)
    score = db.Column(db.Numeric(8, 2), nullable=True)
    max_score = db.Column(db.Numeric(8, 2), nullable=False)

    exam = db.relationship("Exam", back_populates="attempts")
    student = db.relationship("User", back_populates="attempts")
    assignment = db.relationship("ExamAssignment", back_populates="attempts")
    answers = db.relationship("Answer", back_populates="attempt", cascade="all, delete-orphan")
    result = db.relationship("Result", back_populates="attempt", uselist=False, cascade="all, delete-orphan")
    audit_logs = db.relationship("AuditLog", back_populates="attempt")

    def to_dict(self, include_answers: bool = True, include_result: bool = True):
        payload = {
            "id": self.id,
            "exam_id": self.exam_id,
            "student_id": self.student_id,
            "status": self.status.value,
            "started_at": serialize_datetime(self.started_at),
            "deadline_at": serialize_datetime(self.deadline_at),
            "submitted_at": serialize_datetime(self.submitted_at),
            "terminated_at": serialize_datetime(self.terminated_at),
            "last_saved_at": serialize_datetime(self.last_saved_at),
            "last_heartbeat_at": serialize_datetime(self.last_heartbeat_at),
            "auto_submit_reason": self.auto_submit_reason,
            "suspicion_count": self.suspicion_count,
            "focus_loss_count": self.focus_loss_count,
            "score": serialize_decimal(self.score),
            "max_score": serialize_decimal(self.max_score),
        }
        if include_answers:
            payload["answers"] = [answer.to_dict() for answer in self.answers]
        if include_result:
            payload["result"] = self.result.to_dict() if self.result else None
        return payload


class Answer(TimestampMixin, db.Model):
    __tablename__ = "answers"
    __table_args__ = (
        db.UniqueConstraint("attempt_id", "question_id", name="uq_attempt_question_answer"),
    )

    id = db.Column(db.Integer, primary_key=True)
    attempt_id = db.Column(db.Integer, db.ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = db.Column(db.Integer, db.ForeignKey("questions.id", ondelete="RESTRICT"), nullable=False, index=True)
    text_answer = db.Column(db.Text, nullable=True)
    boolean_answer = db.Column(db.Boolean, nullable=True)
    selected_choice_ids = db.Column(db.JSON, nullable=False, default=list)
    awarded_points = db.Column(db.Numeric(8, 2), nullable=True)
    is_correct = db.Column(db.Boolean, nullable=True)
    is_final = db.Column(db.Boolean, nullable=False, default=False)

    attempt = db.relationship("Attempt", back_populates="answers")
    question = db.relationship("Question", back_populates="answers")
    manual_gradings = db.relationship("ManualGrading", back_populates="answer", cascade="all, delete-orphan")

    def to_dict(self, include_question: bool = False):
        payload = {
            "id": self.id,
            "attempt_id": self.attempt_id,
            "question_id": self.question_id,
            "text_answer": self.text_answer,
            "boolean_answer": self.boolean_answer,
            "selected_choice_ids": self.selected_choice_ids or [],
            "awarded_points": serialize_decimal(self.awarded_points),
            "is_correct": self.is_correct,
            "is_final": self.is_final,
            "updated_at": serialize_datetime(self.updated_at),
        }
        if include_question:
            payload["question"] = self.question.to_dict(include_correct_answers=False)
        return payload


class ManualGrading(TimestampMixin, db.Model):
    __tablename__ = "manual_gradings"

    id = db.Column(db.Integer, primary_key=True)
    answer_id = db.Column(db.Integer, db.ForeignKey("answers.id", ondelete="CASCADE"), nullable=False, index=True)
    grader_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    awarded_points = db.Column(db.Numeric(8, 2), nullable=False)
    feedback = db.Column(db.Text, nullable=True)

    answer = db.relationship("Answer", back_populates="manual_gradings")
    grader = db.relationship("User", back_populates="manual_gradings")

    def to_dict(self):
        return {
            "id": self.id,
            "answer_id": self.answer_id,
            "grader": self.grader.to_dict() if self.grader else None,
            "awarded_points": serialize_decimal(self.awarded_points),
            "feedback": self.feedback,
            "created_at": serialize_datetime(self.created_at),
        }


class Result(TimestampMixin, db.Model):
    __tablename__ = "results"

    id = db.Column(db.Integer, primary_key=True)
    attempt_id = db.Column(db.Integer, db.ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    total_points = db.Column(db.Numeric(8, 2), nullable=False)
    max_points = db.Column(db.Numeric(8, 2), nullable=False)
    percentage = db.Column(db.Numeric(5, 2), nullable=False)
    is_published = db.Column(db.Boolean, nullable=False, default=False)
    published_at = db.Column(db.DateTime(timezone=True), nullable=True)
    published_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    feedback_summary = db.Column(db.Text, nullable=True)

    attempt = db.relationship("Attempt", back_populates="result")
    published_by = db.relationship("User", back_populates="published_results")

    def to_dict(self):
        return {
            "id": self.id,
            "attempt_id": self.attempt_id,
            "total_points": serialize_decimal(self.total_points),
            "max_points": serialize_decimal(self.max_points),
            "percentage": serialize_decimal(self.percentage),
            "is_published": self.is_published,
            "published_at": serialize_datetime(self.published_at),
            "published_by": self.published_by.to_dict() if self.published_by else None,
            "feedback_summary": self.feedback_summary,
            "created_at": serialize_datetime(self.created_at),
            "updated_at": serialize_datetime(self.updated_at),
        }


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    attempt_id = db.Column(db.Integer, db.ForeignKey("attempts.id", ondelete="SET NULL"), nullable=True, index=True)
    action = db.Column(db.String(100), nullable=False, index=True)
    details = db.Column(db.JSON, nullable=False, default=dict)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False)

    user = db.relationship("User", back_populates="audit_logs")
    attempt = db.relationship("Attempt", back_populates="audit_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "attempt_id": self.attempt_id,
            "action": self.action,
            "details": self.details or {},
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "created_at": serialize_datetime(self.created_at),
        }


class RetakeRequest(TimestampMixin, db.Model):
    __tablename__ = "retake_requests"
    __table_args__ = (
        db.UniqueConstraint("exam_id", "student_id", "status", name="uq_retake_pending"),
    )

    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    attempt_id = db.Column(db.Integer, db.ForeignKey("attempts.id", ondelete="SET NULL"), nullable=True, index=True)
    reason = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="pending", index=True)
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    exam = db.relationship("Exam", backref="retake_requests")
    student = db.relationship("User", foreign_keys=[student_id])
    attempt = db.relationship("Attempt")
    reviewed_by = db.relationship("User", foreign_keys=[reviewed_by_id])

    def to_dict(self):
        return {
            "id": self.id,
            "exam_id": self.exam_id,
            "student_id": self.student_id,
            "attempt_id": self.attempt_id,
            "reason": self.reason,
            "status": self.status,
            "reviewed_at": serialize_datetime(self.reviewed_at),
            "created_at": serialize_datetime(self.created_at),
            "updated_at": serialize_datetime(self.updated_at),
        }
