from rest_framework import serializers


def validate_password_strength(password: str) -> str:
    """Validate that password meets minimum strength requirements.

    Must contain: one uppercase letter, one digit, one special character.
    Raises serializers.ValidationError if requirements are not met.
    """
    errors = []
    if not any(c.isupper() for c in password):
        errors.append("one uppercase letter")
    if not any(c.isdigit() for c in password):
        errors.append("one digit")
    if not any(c in "!@#$%^&*()-_=+[]{}|;:,.<>?/~`" for c in password):
        errors.append("one special character")
    if errors:
        raise serializers.ValidationError(
            f"Password must contain at least {', '.join(errors)}."
        )
    return password
