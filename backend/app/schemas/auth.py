from marshmallow import Schema, fields, validate


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, load_only=True)


class StudentRegistrationSchema(Schema):
    full_name = fields.String(required=True, validate=validate.Length(min=2, max=150))
    email = fields.Email(required=True)
    password = fields.String(required=True, load_only=True, validate=validate.Length(min=8, max=128))
