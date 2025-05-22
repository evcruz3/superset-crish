from flask_wtf import FlaskForm
from wtforms import SelectField, StringField, TextAreaField, SubmitField, SelectMultipleField, widgets
from wtforms.validators import DataRequired, Length, Email, Optional
from flask_babel import lazy_gettext as _

class DisseminationForm(FlaskForm):
    bulletin_id = SelectField(
        _("Select Bulletin"), 
        validators=[
            DataRequired(message=_("Please select a bulletin.")),
        ],
        coerce=int # Ensure value is coerced to an integer
    )
    email_group_id = SelectField(
        _("Select Email Group"), 
        validators=[
            Optional()
        ],
        coerce=int # Ensure value is coerced to an integer
    )
    dissemination_channels = SelectMultipleField(
        'Dissemination Channels',
        choices=[
            ('email', 'Email'),
            ('facebook', 'Facebook')
        ],
        widget=widgets.ListWidget(prefix_label=False),
        option_widget=widgets.CheckboxInput(),
        validators=[DataRequired(message="Please select at least one dissemination channel.")],
        description="Select one or more channels to disseminate the bulletin through."
    )
    subject = StringField(
        _("Subject"), 
        validators=[
            Optional(),
            Length(max=255)
        ]
    )
    message = TextAreaField(
        _("Message"), 
        validators=[
            Optional()
        ],
        description="This will be the body of the email. For Facebook, a default message will be used or generated based on the bulletin content."
    )
    submit = SubmitField(_("Disseminate"))

    def validate(self, extra_validators=None):
        if not super().validate(extra_validators):
            return False
        
        channels = self.dissemination_channels.data
        
        if 'email' in channels:
            if not self.email_group_id.data or self.email_group_id.data == 0:
                self.email_group_id.errors.append("Email Group is required if 'Email' channel is selected.")
                return False
            # Subject and Message for email are handled by the combined check below
        
        # Check for Subject and Message if email or facebook is selected
        if 'email' in channels or 'facebook' in channels:
            if not self.subject.data:
                self.subject.errors.append("Subject is required if 'Email' or 'Facebook' channel is selected.")
                # No early return here, collect all errors for subject/message
            if not self.message.data:
                self.message.errors.append("Message Body is required if 'Email' or 'Facebook' channel is selected.")
            
            # If any of the above checks failed for subject/message, return False
            if self.subject.errors or self.message.errors:
                 # Check if email_group_id also has errors and only return False if all checks for selected channels are done
                if 'email' in channels and self.email_group_id.errors:
                    return False
                elif not ('email' in channels and self.email_group_id.errors): # if email is not a channel or email_group_id is fine
                    return False


        if not channels: # Should be caught by DataRequired on the field itself, but as a safeguard
            self.dissemination_channels.errors.append("At least one dissemination channel must be selected.")
            
        return True 