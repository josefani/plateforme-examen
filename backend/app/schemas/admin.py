from marshmallow import Schema, ValidationError, fields, validate, validates_schema

from app.models.enums import ExamMode, ExamStatus, QuestionType


QUESTION_TYPES = [item.value for item in QuestionType]
EXAM_MODES = [item.value for item in ExamMode]
EXAM_STATUSES = [item.value for item in ExamStatus]


class StudentCreateSchema(Schema):
    full_name = fields.String(required=True, validate=validate.Length(min=2, max=150))
    email = fields.Email(required=True)
    password = fields.String(required=True, validate=validate.Length(min=8, max=128))
    is_active = fields.Boolean(load_default=True)
    group_ids = fields.List(fields.Integer(strict=True), load_default=list)


class StudentUpdateSchema(Schema):
    full_name = fields.String(validate=validate.Length(min=2, max=150))
    email = fields.Email()
    password = fields.String(validate=validate.Length(min=8, max=128))
    is_active = fields.Boolean()
    group_ids = fields.List(fields.Integer(strict=True))


class GroupSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=2, max=150))
    description = fields.String(allow_none=True, load_default=None)
    member_ids = fields.List(fields.Integer(strict=True), load_default=list)


class QuestionChoiceSchema(Schema):
    label = fields.String(required=True, validate=validate.Length(min=1))
    sort_order = fields.Integer(load_default=0)
    is_correct = fields.Boolean(load_default=False)


class QuestionSchema(Schema):
    type = fields.String(required=True, validate=validate.OneOf(QUESTION_TYPES))
    title = fields.String(required=True, validate=validate.Length(min=2, max=180))
    statement = fields.String(required=True, validate=validate.Length(min=5))
    points = fields.Decimal(required=True, as_string=False, validate=validate.Range(min=0))
    correct_boolean = fields.Boolean(allow_none=True, load_default=None)
    explanation = fields.String(allow_none=True, load_default=None)
    tags = fields.List(fields.String(validate=validate.Length(min=1, max=50)), load_default=list)
    difficulty = fields.String(allow_none=True, load_default=None, validate=validate.Length(max=50))
    is_active = fields.Boolean(load_default=True)
    choices = fields.List(fields.Nested(QuestionChoiceSchema), load_default=list)

    @validates_schema
    def validate_choices(self, data, **kwargs):
        question_type = data["type"]
        choices = data.get("choices", [])

        if question_type in {QuestionType.SINGLE_CHOICE.value, QuestionType.MULTIPLE_CHOICE.value}:
            if len(choices) < 2:
                raise ValidationError("At least two choices are required for choice questions.", "choices")
            correct_count = sum(1 for choice in choices if choice.get("is_correct"))
            if question_type == QuestionType.SINGLE_CHOICE.value and correct_count != 1:
                raise ValidationError("Single choice questions require exactly one correct answer.", "choices")
            if question_type == QuestionType.MULTIPLE_CHOICE.value and correct_count < 1:
                raise ValidationError("Multiple choice questions require at least one correct answer.", "choices")
        elif question_type == QuestionType.TRUE_FALSE.value:
            if choices:
                raise ValidationError("Choices are not allowed for true_false questions.", "choices")
            if data.get("correct_boolean") is None:
                raise ValidationError("true_false questions require correct_boolean.", "correct_boolean")
        else:
            if choices:
                raise ValidationError("Choices are only allowed for single_choice and multiple_choice questions.", "choices")
            if data.get("correct_boolean") is not None:
                raise ValidationError("correct_boolean is only allowed for true_false questions.", "correct_boolean")


class ExamQuestionItemSchema(Schema):
    question_id = fields.Integer(required=True, strict=True)
    sort_order = fields.Integer(load_default=0)
    points = fields.Decimal(required=True, as_string=False, validate=validate.Range(min=0))


class ExamSchema(Schema):
    title = fields.String(required=True, validate=validate.Length(min=2, max=180))
    description = fields.String(allow_none=True, load_default=None)
    instructions = fields.String(allow_none=True, load_default=None)
    duration_minutes = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=480))
    shuffle_questions = fields.Boolean(load_default=False)
    shuffle_choices = fields.Boolean(load_default=False)
    mode = fields.String(required=True, validate=validate.OneOf(EXAM_MODES))
    available_from = fields.DateTime(allow_none=True, load_default=None)
    available_until = fields.DateTime(allow_none=True, load_default=None)
    auto_publish_results = fields.Boolean(load_default=False)
    status = fields.String(load_default=ExamStatus.DRAFT.value, validate=validate.OneOf(EXAM_STATUSES))
    questions = fields.List(fields.Nested(ExamQuestionItemSchema), required=True, validate=validate.Length(min=1))

    @validates_schema
    def validate_window(self, data, **kwargs):
        available_from = data.get("available_from")
        available_until = data.get("available_until")
        if available_from and available_until and available_until <= available_from:
            raise ValidationError("available_until must be after available_from.", "available_until")


class AssignmentSchema(Schema):
    student_ids = fields.List(fields.Integer(strict=True), load_default=list)
    group_ids = fields.List(fields.Integer(strict=True), load_default=list)

    @validates_schema
    def validate_targets(self, data, **kwargs):
        if not data.get("student_ids") and not data.get("group_ids"):
            raise ValidationError("At least one student or group is required.")


class ManualGradingSchema(Schema):
    awarded_points = fields.Decimal(required=True, as_string=False, validate=validate.Range(min=0))
    feedback = fields.String(allow_none=True, load_default=None)


class PublishResultsSchema(Schema):
    exam_id = fields.Integer(strict=True, allow_none=True, load_default=None)
    attempt_ids = fields.List(fields.Integer(strict=True), load_default=list)

    @validates_schema
    def validate_targets(self, data, **kwargs):
        if not data.get("exam_id") and not data.get("attempt_ids"):
            raise ValidationError("Provide exam_id or attempt_ids.")
