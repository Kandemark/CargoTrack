"""
CargoTrack ML Pipeline — polyglot machine learning for logistics intelligence.

Models:
    delay_predictor   — XGBoost binary classifier for shipment delay risk (exists)
    demand_forecaster — GradientBoostingRegressor for corridor/week volume prediction
    dynamic_pricing   — Market-aware freight rate recommendation engine
    theft_risk        — XGBoost classifier for cargo theft risk scoring
    driver_scoring    — Weighted-ensemble composite driver performance score
    border_delay      — Poisson/queuing model for border crossing wait times
    fuel_optimizer    — Dynamic programming for optimal refuelling stops
    container_matching — Bin-packing heuristic for LCL consolidation

Rust acceleration:
    When the PyO3 extension modules are installed, fuel_optimizer and
    container_matching use Rust implementations (10-50x faster).
    Check HAS_RUST_FUEL / HAS_RUST_CONTAINER to detect availability.
"""

# Rust acceleration flags
try:
    from ._fuel_optimizer_rs import _HAS_RUST as HAS_RUST_FUEL  # noqa: F401
except ImportError:
    HAS_RUST_FUEL = False

try:
    from ._container_matcher_rs import _HAS_RUST as HAS_RUST_CONTAINER  # noqa: F401
except ImportError:
    HAS_RUST_CONTAINER = False
