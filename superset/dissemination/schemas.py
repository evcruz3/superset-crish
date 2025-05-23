from marshmallow import fields, Schema

class DisseminationUserSchema(Schema):
    id = fields.Int()
    first_name = fields.String(allow_none=True)
    last_name = fields.String(allow_none=True)
    username = fields.String(allow_none=True)

class EmailGroupSchema(Schema):
    id = fields.Int()
    name = fields.String()
    description = fields.String(allow_none=True)
    emails = fields.String(allow_none=True)
    created_on = fields.DateTime()
    changed_on = fields.DateTime(allow_none=True)
    created_by = fields.Nested(DisseminationUserSchema, allow_none=True) # Allow none if FK is nullable
    changed_by = fields.Nested(DisseminationUserSchema, allow_none=True) # Allow none if FK is nullable 