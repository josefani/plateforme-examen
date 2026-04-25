from marshmallow import Schema, ValidationError, fields, validate, validates_schema


class SaveAnswerItemSchema(Schema):
    question_id = fields.Integer(required=True, strict=True)
    text_answer = fields.String(allow_none=True, load_default=None)
    boolean_answer = fields.Boolean(allow_none=True, load_default=None)
    selected_choice_ids = fields.List(fields.Integer(strict=True), load_default=list)


class SaveAttemptSchema(Schema):
    save_mode = fields.String(load_default="autosave", validate=validate.OneOf(["autosave", "manual"]))
    answers = fields.List(fields.Nested(SaveAnswerItemSchema), required=True, validate=validate.Length(min=1))


class AttemptEventSchema(Schema):
    event_type = fields.String(required=True, validate=validate.Length(min=2, max=100))
    details = fields.Dict(keys=fields.String(), load_default=dict)

    @validates_schema
    def validate_details(self, data, **kwargs):
        if data.get("details") is None:
            raise ValidationError("details must be an object.", "details")


class RetakeRequestSchema(Schema):
    reason = fields.String(allow_none=True, load_default=None, validate=validate.Length(max=500))
