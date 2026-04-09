"""
accounts/forms.py
Customer self-registration form.

Security:
  - Validates email uniqueness to prevent duplicate accounts and
    enumeration via error messages that are intentionally generic.
  - Username length and character constraints come from AbstractUser.
  - Password strength is enforced by Django's AUTH_PASSWORD_VALIDATORS.
"""
import logging

from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import UserCreationForm
from django.core.exceptions import ValidationError

User = get_user_model()
logger = logging.getLogger(__name__)


class CustomerRegistrationForm(UserCreationForm):
    """
    Public-facing registration form for CLIENT-role users.

    Extends Django's built-in UserCreationForm which enforces password
    strength via AUTH_PASSWORD_VALIDATORS and provides a password2
    confirmation field.
    """

    first_name = forms.CharField(
        max_length=50,
        required=True,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'First name'}),
    )
    last_name = forms.CharField(
        max_length=50,
        required=True,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Last name'}),
    )
    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'you@example.com'}),
        help_text='Required. Used for account recovery.',
    )
    company = forms.CharField(
        max_length=120,
        required=False,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Company (optional)'}),
    )
    phone = forms.CharField(
        max_length=20,
        required=False,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': '+254 700 000000 (optional)'}),
    )

    class Meta:
        model = User
        fields = (
            'first_name', 'last_name',
            'username', 'email',
            'company', 'phone',
            'password1', 'password2',
        )
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Choose a username'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Apply Bootstrap styling to the two password fields from UserCreationForm
        self.fields['password1'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Password'})
        self.fields['password2'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Confirm password'})
        self.fields['username'].widget.attrs['class'] = 'form-control'

    def clean_email(self):
        """Reject duplicate email addresses without revealing which accounts exist."""
        email = self.cleaned_data.get('email', '').lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            # Generic message — avoids confirming whether an email is registered
            raise ValidationError(
                "An account with this email address already exists. "
                "Please use a different address or sign in."
            )
        return email

    def clean_username(self):
        """Normalise username to lowercase and check uniqueness."""
        username = self.cleaned_data.get('username', '').strip()
        if User.objects.filter(username__iexact=username).exists():
            raise ValidationError("This username is already taken. Please choose another.")
        return username

    def save(self, commit=True):
        """
        Create the User, then set profile.role = CLIENT via the auto-created
        UserProfile (the post_save signal creates it on User.save()).
        """
        user = super().save(commit=False)
        user.email      = self.cleaned_data['email']
        user.first_name = self.cleaned_data['first_name']
        user.last_name  = self.cleaned_data['last_name']
        user.company    = self.cleaned_data.get('company', '')
        user.phone      = self.cleaned_data.get('phone', '')
        user.role       = User.Role.CLIENT   # always CLIENT for self-registration

        if commit:
            user.save()
            logger.info("New customer registered: %s <%s>", user.username, user.email)

        return user
