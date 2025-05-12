from flask_wtf import FlaskForm
from wtforms import StringField, TextAreaField, SelectField, SubmitField
from wtforms.validators import DataRequired, NumberRange
from flask_babel import lazy_gettext as _

class DisseminationForm(FlaskForm):
    bulletin_id = SelectField(
        _("Select Bulletin"), 
        validators=[
            DataRequired(message=_("Please select a bulletin.")),
            NumberRange(min=1, message=_("Please select a valid bulletin."))
        ],
        coerce=int # Ensure value is coerced to an integer
    )
    email_group_id = SelectField(
        _("Select Email Group"), 
        validators=[
            DataRequired(message=_("Please select an email group.")),
            NumberRange(min=1, message=_("Please select a valid email group."))
        ],
        coerce=int # Ensure value is coerced to an integer
    )
    subject = StringField(
        _("Subject"), 
        validators=[DataRequired(message=_("Subject is required."))]
    )
    message = TextAreaField(
        _("Message"), 
        validators=[DataRequired(message=_("Message is required."))]
    )
    submit = SubmitField(_("Disseminate")) 