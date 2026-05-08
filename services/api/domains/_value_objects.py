"""
domains/_value_objects.py — DDD Value Objects for CargoTrack.

Value objects are immutable, compared by their attributes (not identity),
and carry their own validation.  They eliminate primitive obsession by
replacing bare ``str``, ``Decimal``, and ``float`` parameters with
self-documenting, self-validating types.

All value objects are frozen (hashable) dataclasses with ``__slots__``.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from math import atan2, cos, radians, sin, sqrt
from typing import Optional

# ═══════════════════════════════════════════════════════════════════════════════
# Money
# ═══════════════════════════════════════════════════════════════════════════════

_VALID_CURRENCIES = frozenset({"KES", "TZS", "UGX", "RWF", "BIF", "USD", "EUR", "GBP"})


@dataclass(frozen=True, slots=True)
class Money:
    """An amount in a specific EAC currency.  Immutable, arithmetic-safe."""

    amount: Decimal
    currency: str = "USD"

    def __post_init__(self):
        if self.currency.upper() not in _VALID_CURRENCIES:
            raise ValueError(f"Unsupported currency: {self.currency}")
        # Normalize to Decimal with 2 decimal places
        amount = Decimal(str(self.amount)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP,
        )
        object.__setattr__(self, "amount", amount)
        object.__setattr__(self, "currency", self.currency.upper())

    def __add__(self, other: Money) -> Money:
        if self.currency != other.currency:
            raise ValueError(
                f"Cannot add {self.currency} to {other.currency} — convert first"
            )
        return Money(self.amount + other.amount, self.currency)

    def __sub__(self, other: Money) -> Money:
        if self.currency != other.currency:
            raise ValueError(
                f"Cannot subtract {other.currency} from {self.currency}"
            )
        return Money(self.amount - other.amount, self.currency)

    def __mul__(self, factor: Decimal | int | float) -> Money:
        factor = Decimal(str(factor))
        return Money(self.amount * factor, self.currency)

    def __neg__(self) -> Money:
        return Money(-self.amount, self.currency)

    def __abs__(self) -> Money:
        return Money(abs(self.amount), self.currency)

    def __lt__(self, other: Money) -> bool:
        self._assert_same_currency(other)
        return self.amount < other.amount

    def __le__(self, other: Money) -> bool:
        self._assert_same_currency(other)
        return self.amount <= other.amount

    def __gt__(self, other: Money) -> bool:
        self._assert_same_currency(other)
        return self.amount > other.amount

    def __ge__(self, other: Money) -> bool:
        self._assert_same_currency(other)
        return self.amount >= other.amount

    def _assert_same_currency(self, other: Money):
        if self.currency != other.currency:
            raise ValueError(
                f"Cannot compare {self.currency} to {other.currency}"
            )

    def convert_to(self, target_currency: str) -> Money:
        """Convert to another currency using cross-rate triangulation."""
        from finance.services import get_exchange_rate
        rate = get_exchange_rate(self.currency, target_currency.upper())
        return Money(self.amount * rate, target_currency.upper())

    def is_zero(self) -> bool:
        return self.amount == Decimal("0")

    def __str__(self) -> str:
        return f"{self.amount} {self.currency}"

    def __repr__(self) -> str:
        return f"Money({self.amount}, {self.currency})"

    @classmethod
    def zero(cls, currency: str = "USD") -> Money:
        return cls(Decimal("0"), currency)

    @classmethod
    def from_str(cls, amount: str, currency: str = "USD") -> Money:
        return cls(Decimal(amount), currency)


# ═══════════════════════════════════════════════════════════════════════════════
# Weight
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass(frozen=True, slots=True)
class Weight:
    """A weight in kilograms.  Immutable with unit conversion helpers."""

    value_kg: Decimal

    def __post_init__(self):
        object.__setattr__(
            self, "value_kg",
            Decimal(str(self.value_kg)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        )

    @property
    def tons(self) -> Decimal:
        return (self.value_kg / 1000).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)

    @classmethod
    def from_tons(cls, tons: Decimal | float | str) -> Weight:
        return cls(Decimal(str(tons)) * 1000)

    @classmethod
    def from_kg(cls, kg: Decimal | float | str) -> Weight:
        return cls(Decimal(str(kg)))

    def __add__(self, other: Weight) -> Weight:
        return Weight(self.value_kg + other.value_kg)

    def __sub__(self, other: Weight) -> Weight:
        return Weight(self.value_kg - other.value_kg)

    def __mul__(self, factor: Decimal | int | float) -> Weight:
        return Weight(self.value_kg * Decimal(str(factor)))

    def __lt__(self, other: Weight) -> bool:
        return self.value_kg < other.value_kg

    def __le__(self, other: Weight) -> bool:
        return self.value_kg <= other.value_kg

    def __gt__(self, other: Weight) -> bool:
        return self.value_kg > other.value_kg

    def __ge__(self, other: Weight) -> bool:
        return self.value_kg >= other.value_kg

    def __str__(self) -> str:
        if self.value_kg >= 1000:
            return f"{self.tons} t"
        return f"{self.value_kg} kg"

    def __repr__(self) -> str:
        return f"Weight({self.value_kg}kg)"


# ═══════════════════════════════════════════════════════════════════════════════
# Temperature
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass(frozen=True, slots=True)
class Temperature:
    """A temperature in degrees Celsius.  Supports range checks and MKT."""

    celsius: float

    @property
    def kelvin(self) -> float:
        return self.celsius + 273.15

    @property
    def fahrenheit(self) -> float:
        return self.celsius * 9 / 5 + 32

    @classmethod
    def from_kelvin(cls, k: float) -> Temperature:
        return cls(k - 273.15)

    @classmethod
    def from_fahrenheit(cls, f: float) -> Temperature:
        return cls((f - 32) * 5 / 9)

    def is_within(self, min_temp: Temperature, max_temp: Temperature) -> bool:
        return min_temp.celsius <= self.celsius <= max_temp.celsius

    def excursion_from(self, min_temp: Temperature, max_temp: Temperature) -> Optional[float]:
        """Return how far out of range (0 if in range), or None."""
        if self.is_within(min_temp, max_temp):
            return None
        if self.celsius < min_temp.celsius:
            return min_temp.celsius - self.celsius
        return self.celsius - max_temp.celsius

    def __lt__(self, other: Temperature) -> bool:
        return self.celsius < other.celsius

    def __le__(self, other: Temperature) -> bool:
        return self.celsius <= other.celsius

    def __gt__(self, other: Temperature) -> bool:
        return self.celsius > other.celsius

    def __ge__(self, other: Temperature) -> bool:
        return self.celsius >= other.celsius

    def __str__(self) -> str:
        return f"{self.celsius}°C"

    def __repr__(self) -> str:
        return f"Temperature({self.celsius}°C)"


# ═══════════════════════════════════════════════════════════════════════════════
# GeoPoint
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass(frozen=True, slots=True)
class GeoPoint:
    """A WGS-84 latitude/longitude point.  Immutable."""

    lat: float
    lon: float

    def __post_init__(self):
        if not (-90 <= self.lat <= 90):
            raise ValueError(f"Latitude out of range: {self.lat}")
        if not (-180 <= self.lon <= 180):
            raise ValueError(f"Longitude out of range: {self.lon}")

    def distance_km(self, other: GeoPoint) -> float:
        """Great-circle (haversine) distance in kilometres."""
        R = 6371.0
        dlat = radians(other.lat - self.lat)
        dlon = radians(other.lon - self.lon)
        a = (
            sin(dlat / 2) ** 2
            + cos(radians(self.lat))
            * cos(radians(other.lat))
            * sin(dlon / 2) ** 2
        )
        return R * 2 * atan2(sqrt(a), sqrt(1 - a))

    def bearing_deg(self, other: GeoPoint) -> float:
        """Initial bearing from self to other in degrees [0, 360)."""
        dlon = radians(other.lon - self.lon)
        y = sin(dlon) * cos(radians(other.lat))
        x = cos(radians(self.lat)) * sin(radians(other.lat)) - sin(
            radians(self.lat)
        ) * cos(radians(other.lat)) * cos(dlon)
        return (atan2(y, x) * 180 / 3.14159265359 + 360) % 360

    def __str__(self) -> str:
        return f"({self.lat:.6f}, {self.lon:.6f})"

    def __repr__(self) -> str:
        return f"GeoPoint({self.lat}, {self.lon})"


# ═══════════════════════════════════════════════════════════════════════════════
# PortCode
# ═══════════════════════════════════════════════════════════════════════════════

# EAC UN/LOCODE ports known to the system
_KNOWN_PORT_CODES = frozenset({
    "KEMBA",   # Mombasa, Kenya
    "TZDAR",   # Dar es Salaam, Tanzania
    "KENBO",   # Nairobi ICD, Kenya
    "UGKAM",   # Kampala ICD, Uganda
    "RWKGL",   # Kigali ICD, Rwanda
})

_PORT_NAMES: dict[str, str] = {
    "KEMBA": "Mombasa",
    "TZDAR": "Dar es Salaam",
    "KENBO": "Nairobi ICD",
    "UGKAM": "Kampala ICD",
    "RWKGL": "Kigali ICD",
}


@dataclass(frozen=True, slots=True)
class PortCode:
    """A validated EAC port UN/LOCODE.  Immutable."""

    code: str

    def __post_init__(self):
        normalised = self.code.upper().strip()
        object.__setattr__(self, "code", normalised)
        if normalised not in _KNOWN_PORT_CODES:
            raise ValueError(
                f"Unknown port code: {normalised}. "
                f"Known: {', '.join(sorted(_KNOWN_PORT_CODES))}"
            )

    @property
    def name(self) -> str:
        return _PORT_NAMES.get(self.code, self.code)

    @classmethod
    def try_from(cls, value: str) -> Optional[PortCode]:
        """Safe constructor — returns None for unknown codes."""
        try:
            return cls(value)
        except ValueError:
            return None

    @classmethod
    def all_known(cls) -> list[PortCode]:
        return [cls(c) for c in sorted(_KNOWN_PORT_CODES)]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"

    def __repr__(self) -> str:
        return f"PortCode({self.code})"


# ═══════════════════════════════════════════════════════════════════════════════
# TrackingNumber
# ═══════════════════════════════════════════════════════════════════════════════

_TRACKING_RE = re.compile(r"^CT-\d{8}-[A-Z0-9]{4}$")


@dataclass(frozen=True, slots=True)
class TrackingNumber:
    """A validated CargoTrack tracking number (CT-YYYYMMDD-XXXX)."""

    value: str

    def __post_init__(self):
        normalised = self.value.strip().upper()
        object.__setattr__(self, "value", normalised)
        if not _TRACKING_RE.match(normalised):
            raise ValueError(
                f"Invalid tracking number: {normalised!r}. "
                f"Expected format: CT-YYYYMMDD-XXXX"
            )

    @property
    def date_part(self) -> str:
        """YYYYMMDD portion."""
        return self.value[3:11]

    def __str__(self) -> str:
        return self.value

    def __repr__(self) -> str:
        return f"TrackingNumber({self.value})"


# ═══════════════════════════════════════════════════════════════════════════════
# Corridor
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass(frozen=True, slots=True)
class Corridor:
    """An origin→destination trade corridor.  Normalised, immutable."""

    origin: str
    destination: str

    def __post_init__(self):
        object.__setattr__(self, "origin", self.origin.lower().strip())
        object.__setattr__(self, "destination", self.destination.lower().strip())
        if self.origin == self.destination:
            raise ValueError(
                f"Origin and destination must differ: {self.origin!r}"
            )

    @property
    def key(self) -> str:
        """Normalized key used for lookups (mombasa-nairobi)."""
        return f"{self.origin}-{self.destination}"

    @property
    def display_name(self) -> str:
        """Human-readable corridor name (Mombasa → Nairobi)."""
        return (
            f"{self.origin.replace('-', ' ').title()} "
            f"→ "
            f"{self.destination.replace('-', ' ').title()}"
        )

    @property
    def reversed(self) -> Corridor:
        return Corridor(self.destination, self.origin)

    def __str__(self) -> str:
        return self.display_name

    def __repr__(self) -> str:
        return f"Corridor({self.key})"


# ═══════════════════════════════════════════════════════════════════════════════
# ContainerType
# ═══════════════════════════════════════════════════════════════════════════════

_VALID_CONTAINER_SIZES = frozenset({"20FT", "40FT"})
_VALID_CONTAINER_KINDS = frozenset({"DRY", "REEFER", "OPEN_TOP", "FLAT_RACK", "TANK"})


@dataclass(frozen=True, slots=True)
class ContainerType:
    """An ISO container type (size + kind).  Immutable."""

    size: str   # "20FT" | "40FT"
    kind: str   # "DRY" | "REEFER" | ...

    def __post_init__(self):
        sz = self.size.upper().strip()
        kd = self.kind.upper().strip()
        if sz not in _VALID_CONTAINER_SIZES:
            raise ValueError(
                f"Invalid container size: {sz!r}. "
                f"Valid: {', '.join(sorted(_VALID_CONTAINER_SIZES))}"
            )
        if kd not in _VALID_CONTAINER_KINDS:
            raise ValueError(
                f"Invalid container kind: {kd!r}. "
                f"Valid: {', '.join(sorted(_VALID_CONTAINER_KINDS))}"
            )
        object.__setattr__(self, "size", sz)
        object.__setattr__(self, "kind", kd)

    @property
    def is_40ft(self) -> bool:
        return self.size == "40FT"

    @property
    def is_reefer(self) -> bool:
        return self.kind == "REEFER"

    @property
    def code(self) -> str:
        """Canonical string: '20FT_DRY', '40FT_REEFER', etc."""
        return f"{self.size}_{self.kind}"

    @classmethod
    def from_code(cls, code: str) -> ContainerType:
        """Parse from '20FT_DRY' format."""
        parts = code.strip().upper().split("_", 1)
        if len(parts) != 2:
            raise ValueError(f"Invalid container code: {code!r}")
        return cls(parts[0], parts[1])

    def __str__(self) -> str:
        return self.code

    def __repr__(self) -> str:
        return f"ContainerType({self.code})"
