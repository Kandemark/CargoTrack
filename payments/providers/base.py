"""payments/providers/base.py — Abstract base for all payment providers."""
from abc import ABC, abstractmethod
from typing import Any


class PaymentResult:
    """Standardised result returned by provider methods."""
    def __init__(self, success: bool, reference: str = '', message: str = '',
                 data: dict[str, Any] | None = None):
        self.success   = success
        self.reference = reference
        self.message   = message
        self.data      = data or {}


class BaseProvider(ABC):
    """All providers must implement these three methods."""

    @abstractmethod
    def initiate_payment(self, invoice: Any, phone_or_card: str) -> PaymentResult:
        """Start a payment. Returns a PaymentResult with reference/instructions."""
        ...

    @abstractmethod
    def verify_payment(self, reference: str) -> PaymentResult:
        """Check payment status by provider reference."""
        ...

    @abstractmethod
    def parse_webhook(self, data: dict[str, Any]) -> PaymentResult:
        """Parse a raw webhook payload. Returns success=True when payment confirmed."""
        ...
