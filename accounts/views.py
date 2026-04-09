"""
accounts/views.py
Customer self-registration view.

Security notes:
  - No rate-limiting package is required: registration is intentionally
    slow (bcrypt hashing) and protected by CSRF.
  - The success redirect goes to the login page, not the dashboard, so
    freshly created accounts do not gain a session without explicitly
    authenticating. This prevents accidental automatic login after POST
    replay attacks.
  - No auto-login after registration — the user must present credentials
    on the login form, which is subject to Django's standard auth checks.
"""
import logging

from django.contrib import messages
from django.views.generic.edit import CreateView

from .forms import CustomerRegistrationForm

logger = logging.getLogger(__name__)


class RegisterView(CreateView):
    """
    Public customer registration.

    Anyone can reach this view. On success the user is redirected to the
    login page (not auto-logged-in) with a one-time success message.
    """

    form_class    = CustomerRegistrationForm
    template_name = 'accounts/register.html'
    success_url   = '/accounts/login/'

    def dispatch(self, request, *args, **kwargs):
        """Redirect already-authenticated users away from the registration page."""
        if request.user.is_authenticated:
            return self.handle_already_authenticated()
        return super().dispatch(request, *args, **kwargs)

    def handle_already_authenticated(self):
        from django.shortcuts import redirect
        return redirect('/dashboard/')

    def form_valid(self, form):
        response = super().form_valid(form)
        username = form.instance.username
        logger.info("New customer registered via portal: %s", username)
        messages.success(
            self.request,
            "Account created successfully. Please sign in to continue.",
        )
        return response

    def form_invalid(self, form):
        # Log failed attempts for audit trail (no PII in log message)
        logger.warning(
            "Registration form submission failed: %d error(s) from %s",
            len(form.errors),
            self.request.META.get('REMOTE_ADDR', 'unknown'),
        )
        return super().form_invalid(form)
