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
    email_group_ids = SelectMultipleField(
        _("Select Email Group(s)"),
        validators=[
            Optional()
        ],
        coerce=int,
        description=_("Select one or more email groups. Emails will be aggregated without duplicates.")
    )
    whatsapp_group_id = SelectMultipleField(
        _("Select WhatsApp Group(s)"),
        validators=[
            Optional()
        ],
        coerce=int,
        description=_("Select one or more WhatsApp groups. Phone numbers will be aggregated without duplicates.")
    )
    dissemination_channels = SelectMultipleField(
        'Dissemination Channels',
        choices=[
            ('email', 'Email'),
            ('facebook', 'Facebook'),
            ('whatsapp', 'WhatsApp')
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
            if not self.email_group_ids.data: 
                self.email_group_ids.errors.append("At least one Email Group is required if 'Email' channel is selected.")
            # Subject and Message for email are handled by the combined check below
        
        if 'whatsapp' in channels: # Added validation for WhatsApp group
            if not self.whatsapp_group_id.data or self.whatsapp_group_id.data == 0:
                self.whatsapp_group_id.errors.append("At least one WhatsApp Group is required if 'WhatsApp' channel is selected.")
            # Intentionally not returning False immediately to collect all errors for selected channels first
            # The final return False will be handled after all checks for subject/message are also done.
        
        # Check for Subject and Message if email or facebook or whatsapp is selected
        if 'email' in channels or 'facebook' in channels or 'whatsapp' in channels:
            if not self.subject.data:
                self.subject.errors.append("Subject is required if 'Email', 'Facebook', or 'WhatsApp' channel is selected.")
            if not self.message.data:
                self.message.errors.append("Message Body is required if 'Email', 'Facebook', or 'WhatsApp' channel is selected.")
            
            # If any of the above checks failed for subject/message, return False
            if self.subject.errors or self.message.errors:
                 # Check if email_group_id also has errors and only return False if all checks for selected channels are done
                if ('email' in channels and self.email_group_ids.errors) or \
                   ('whatsapp' in channels and self.whatsapp_group_id.errors): # Added WhatsApp group error check here
                    return False
                elif not (('email' in channels and self.email_group_ids.errors) or 
                          ('whatsapp' in channels and self.whatsapp_group_id.errors)): 
                    return False

        # If only email group has an error (and it's the only channel or others are fine)
        if ('email' in channels and self.email_group_ids.errors and not (self.subject.errors or self.message.errors or self.whatsapp_group_id.errors)) or \
           ('whatsapp' in channels and self.whatsapp_group_id.errors and not (self.subject.errors or self.message.errors or self.email_group_ids.errors)):
            return False

        if not channels: # Should be caught by DataRequired on the field itself, but as a safeguard
            self.dissemination_channels.errors.append("At least one dissemination channel must be selected.")
            
        return True 