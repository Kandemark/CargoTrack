"""
shipments/eta_engine.py — Real-time ETA Engine with Kalman Filter

Fuses GPS telemetry with route data to produce continuously updated ETAs.
Handles East African corridor realities:
    - Border crossing wait times (historical + real-time)
    - Driver rest periods (mandatory breaks every 4-5 hours)
    - Speed variations by road segment type
    - Weather impacts on travel speed

Algorithm:
    1. Kalman filter smooths GPS position observations
    2. Distance-to-destination calculated along route waypoints
    3. Speed estimated from recent position deltas + road type
    4. Remaining time = segment_distances / adjusted_speeds
    5. Border crossings add expected wait time
    6. Driver rest periods added based on hours since last break
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from math import atan2, cos, radians, sin, sqrt
from typing import Optional

from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)


# ── Geospatial helpers ──────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two GPS points in kilometers."""
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial bearing from point 1 to point 2 in degrees."""
    dlon = radians(lon2 - lon1)
    y = sin(dlon) * cos(radians(lat2))
    x = cos(radians(lat1)) * sin(radians(lat2)) - sin(radians(lat1)) * cos(radians(lat2)) * cos(dlon)
    return (atan2(y, x) * 180 / 3.14159265359 + 360) % 360


# ── Kalman Filter ───────────────────────────────────────────────────────────

@dataclass
class KalmanState:
    """4D state vector: [lat, lon, speed_kmh, heading_deg]"""
    lat: float
    lon: float
    speed: float  # km/h
    heading: float  # degrees

    # Covariance matrix (4x4, diagonal approximation)
    var_lat: float = 0.0001
    var_lon: float = 0.0001
    var_speed: float = 25.0
    var_heading: float = 100.0

    last_update: Optional[datetime] = None


class KalmanFilter:
    """
    Simple 4-state Kalman filter for GPS position + velocity tracking.
    
    State: [lat, lon, speed (km/h), heading (deg)]
    Process model: constant velocity with process noise
    Observation model: direct observation of lat/lon (from GPS), 
                       speed (from GPS or OBD-II), heading (computed)
    """
    
    def __init__(
        self,
        process_noise: float = 0.001,
        gps_accuracy_m: float = 10.0,
    ):
        self.process_noise = process_noise
        # GPS accuracy in degrees (approximate)
        self.gps_var = (gps_accuracy_m / 111320.0) ** 2
    
    def init_state(self, lat: float, lon: float, speed: float = 0.0, heading: float = 0.0) -> KalmanState:
        return KalmanState(lat=lat, lon=lon, speed=speed, heading=heading)
    
    def predict(self, state: KalmanState, dt_seconds: float) -> KalmanState:
        """Predict next state based on constant velocity model."""
        if dt_seconds <= 0:
            return state
        
        dt_hours = dt_seconds / 3600.0
        
        # Position update based on speed and heading
        dist_km = state.speed * dt_hours
        heading_rad = radians(state.heading)
        
        # Approximate lat/lon displacement
        dlat = (dist_km / 111.32) * cos(heading_rad)
        dlon = (dist_km / (111.32 * cos(radians(state.lat)))) * sin(heading_rad)
        
        # Process noise grows with time
        noise_factor = 1.0 + self.process_noise * dt_seconds
        
        return KalmanState(
            lat=state.lat + dlat,
            lon=state.lon + dlon,
            speed=state.speed,
            heading=state.heading,
            var_lat=state.var_lat * noise_factor + self.process_noise * dt_seconds,
            var_lon=state.var_lon * noise_factor + self.process_noise * dt_seconds,
            var_speed=state.var_speed * noise_factor,
            var_heading=state.var_heading * noise_factor,
            last_update=state.last_update,
        )
    
    def update(self, prior: KalmanState, obs_lat: float, obs_lon: float,
               obs_speed: Optional[float] = None, obs_heading: Optional[float] = None,
               now: Optional[datetime] = None) -> KalmanState:
        """Update state with new GPS observation using Kalman gain."""
        # Kalman gain: K = P_prior / (P_prior + R)
        # where P_prior is variance of prior estimate, R is measurement noise variance
        
        # Position update
        k_lat = prior.var_lat / (prior.var_lat + self.gps_var)
        k_lon = prior.var_lon / (prior.var_lon + self.gps_var)
        
        new_lat = prior.lat + k_lat * (obs_lat - prior.lat)
        new_lon = prior.lon + k_lon * (obs_lon - prior.lon)
        
        # Covariance update: P_new = (1 - K) * P_prior
        new_var_lat = (1 - k_lat) * prior.var_lat
        new_var_lon = (1 - k_lon) * prior.var_lon
        
        # Speed update (if available)
        new_speed = prior.speed
        new_var_speed = prior.var_speed
        if obs_speed is not None:
            speed_var = 4.0  # GPS speed measurement noise ~2 km/h std
            k_speed = prior.var_speed / (prior.var_speed + speed_var)
            new_speed = prior.speed + k_speed * (obs_speed - prior.speed)
            new_var_speed = (1 - k_speed) * prior.var_speed
        
        # Heading update
        new_heading = prior.heading
        new_var_heading = prior.var_heading
        if obs_heading is not None:
            heading_var = 50.0
            k_heading = prior.var_heading / (prior.var_heading + heading_var)
            new_heading = prior.heading + k_heading * (obs_heading - prior.heading)
            new_var_heading = (1 - k_heading) * prior.var_heading
        
        return KalmanState(
            lat=new_lat, lon=new_lon,
            speed=new_speed, heading=new_heading,
            var_lat=new_var_lat, var_lon=new_var_lon,
            var_speed=new_var_speed, var_heading=new_var_heading,
            last_update=now or timezone.now(),
        )


# ── EAC Border Crossing Wait Times ─────────────────────────────────────────

BORDER_WAIT_TIMES_MINUTES: dict[str, dict[str, float]] = {
    "Busia":    {"light": 45, "normal": 90, "heavy": 180},
    "Malaba":   {"light": 60, "normal": 120, "heavy": 240},
    "Namanga":  {"light": 30, "normal": 60, "heavy": 120},
    "Taveta":   {"light": 20, "normal": 45, "heavy": 90},
    "Holili":   {"light": 20, "normal": 45, "heavy": 90},
    "Mutukula": {"light": 30, "normal": 60, "heavy": 150},
    "Rusumo":   {"light": 45, "normal": 90, "heavy": 180},
    "Gatuna":   {"light": 30, "normal": 60, "heavy": 120},
    "Katuna":   {"light": 30, "normal": 60, "heavy": 120},
}


def estimate_border_delay(border_name: str, time_of_day: int = 12) -> float:
    """Estimate border crossing wait time in minutes based on time of day."""
    # Peak hours: 8-10am, 4-6pm are heavier
    if 8 <= time_of_day <= 10 or 16 <= time_of_day <= 18:
        congestion = "heavy"
    elif 6 <= time_of_day <= 8 or 14 <= time_of_day <= 16:
        congestion = "normal"
    else:
        congestion = "light"
    
    times = BORDER_WAIT_TIMES_MINUTES.get(border_name, {})
    return times.get(congestion, 60.0)


# ── Road segment speeds ────────────────────────────────────────────────────

ROAD_TYPE_SPEEDS_KMH: dict[str, float] = {
    "highway": 80.0,
    "paved_road": 60.0,
    "gravel_road": 40.0,
    "border_zone": 20.0,
    "urban": 30.0,
    "port_area": 15.0,
}

WEATHER_SPEED_FACTOR: dict[str, float] = {
    "clear": 1.0,
    "cloudy": 0.95,
    "light_rain": 0.85,
    "heavy_rain": 0.65,
    "storm": 0.40,
    "fog": 0.70,
}


# ── ETA Engine ─────────────────────────────────────────────────────────────

@dataclass
class RouteSegment:
    """A segment of the route between two waypoints."""
    from_name: str
    to_name: str
    distance_km: float
    road_type: str
    border_crossing: Optional[str] = None
    estimated_speed_kmh: float = 60.0


@dataclass
class ETAEstimate:
    """Complete ETA estimate for a shipment."""
    tracking_number: str
    origin: str
    destination: str
    total_distance_km: float
    distance_remaining_km: float
    distance_completed_km: float
    progress_pct: float
    estimated_arrival: Optional[datetime]
    estimated_remaining_hours: float
    confidence_low: Optional[datetime]   # Optimistic (faster speeds)
    confidence_high: Optional[datetime]  # Pessimistic (slower speeds)
    current_speed_kmh: float
    current_position: tuple[float, float]  # (lat, lon)
    upcoming_border: Optional[str]
    border_wait_minutes: float
    next_rest_break_at: Optional[datetime]
    segments: list[dict] = field(default_factory=list)
    last_updated: Optional[datetime] = None


class ETAEngine:
    """
    Real-time ETA engine using Kalman filter and route decomposition.
    
    Usage:
        engine = ETAEngine()
        eta = engine.calculate(shipment, current_lat, current_lon, current_speed)
    """
    
    DRIVE_HOURS_BEFORE_BREAK = 4.5  # hours before mandatory rest
    REST_BREAK_MINUTES = 30         # minimum rest break
    
    def __init__(self):
        self.kalman = KalmanFilter(process_noise=0.0005, gps_accuracy_m=15.0)
        self._states: dict[str, KalmanState] = {}  # tracking_number -> state
    
    def calculate(
        self,
        tracking_number: str,
        origin: str,
        destination: str,
        total_distance_km: float,
        current_lat: float,
        current_lon: float,
        current_speed_kmh: float = 0.0,
        departure_time: Optional[datetime] = None,
        segments: Optional[list[RouteSegment]] = None,
        weather: str = "clear",
    ) -> ETAEstimate:
        """Calculate real-time ETA for a shipment."""
        now = timezone.now()
        
        # ── Kalman filter update ──────────────────────────────────────
        prev_state = self._states.get(tracking_number)
        
        if prev_state is not None:
            # Predict forward to now
            dt = (now - prev_state.last_update).total_seconds() if prev_state.last_update else 0
            predicted = self.kalman.predict(prev_state, dt)
            # Update with new observation
            obs_heading = None
            if prev_state.lat != current_lat or prev_state.lon != current_lon:
                obs_heading = bearing_deg(prev_state.lat, prev_state.lon, current_lat, current_lon)
            state = self.kalman.update(predicted, current_lat, current_lon, current_speed_kmh, obs_heading, now)
        else:
            # First observation — initialize
            state = self.kalman.init_state(current_lat, current_lon, current_speed_kmh)
            state.last_update = now
        
        # Smooth speed with Kalman estimate
        smoothed_speed = max(state.speed, current_speed_kmh * 0.8)
        
        self._states[tracking_number] = state
        
        # ── Distance calculation ──────────────────────────────────────
        if segments:
            distance_completed, distance_remaining, upcoming_border = self._calculate_segment_distances(
                segments, current_lat, current_lon
            )
        else:
            # Simple: origin->current + current->destination
            distance_completed = total_distance_km * 0.5  # placeholder
            distance_remaining = total_distance_km - distance_completed
            upcoming_border = None
        
        progress_pct = (distance_completed / total_distance_km * 100) if total_distance_km > 0 else 0
        
        # ── Speed adjustment factors ──────────────────────────────────
        weather_factor = WEATHER_SPEED_FACTOR.get(weather, 1.0)
        road_factor = self._get_road_factor(segments, distance_completed)
        adjusted_speed = smoothed_speed * weather_factor * road_factor
        
        # ── Time estimation ───────────────────────────────────────────
        # Basic driving time
        base_hours = distance_remaining / max(adjusted_speed, 5.0)
        
        # Border crossing delays
        border_hours = 0.0
        border_wait = 0.0
        if upcoming_border:
            border_wait = estimate_border_delay(upcoming_border, now.hour)
            border_hours = border_wait / 60.0
        
        # Rest breaks
        rest_hours = self._estimate_rest_breaks(base_hours + border_hours, departure_time, now)
        
        total_remaining_hours = base_hours + border_hours + rest_hours
        
        # ── Confidence intervals ──────────────────────────────────────
        # Optimistic: 20% faster travel, no border congestion, no weather
        optimistic_hours = distance_remaining / max(adjusted_speed * 1.2, 5.0)
        optimistic_hours += border_wait * 0.3 / 60.0  # light border traffic
        
        # Pessimistic: 20% slower, heavy border, weather penalty
        pessimistic_hours = distance_remaining / max(adjusted_speed * 0.7, 5.0)
        pessimistic_hours += border_wait * 1.5 / 60.0
        pessimistic_hours += rest_hours * 1.5
        
        estimated_arrival = now + timedelta(hours=total_remaining_hours) if total_remaining_hours > 0 else now
        
        # Next rest break
        next_rest = None
        if departure_time:
            drive_hours_elapsed = (now - departure_time).total_seconds() / 3600
            hours_until_break = self.DRIVE_HOURS_BEFORE_BREAK - (drive_hours_elapsed % self.DRIVE_HOURS_BEFORE_BREAK)
            if hours_until_break < self.DRIVE_HOURS_BEFORE_BREAK:
                next_rest = now + timedelta(hours=hours_until_break)
        
        return ETAEstimate(
            tracking_number=tracking_number,
            origin=origin,
            destination=destination,
            total_distance_km=total_distance_km,
            distance_remaining_km=round(distance_remaining, 1),
            distance_completed_km=round(distance_completed, 1),
            progress_pct=round(progress_pct, 1),
            estimated_arrival=estimated_arrival,
            estimated_remaining_hours=round(total_remaining_hours, 1),
            confidence_low=now + timedelta(hours=optimistic_hours) if optimistic_hours > 0 else now,
            confidence_high=now + timedelta(hours=pessimistic_hours) if pessimistic_hours > 0 else now,
            current_speed_kmh=round(smoothed_speed, 1),
            current_position=(current_lat, current_lon),
            upcoming_border=upcoming_border,
            border_wait_minutes=round(border_wait, 0),
            next_rest_break_at=next_rest,
            last_updated=now,
        )
    
    def observe_gps(self, tracking_number: str, lat: float, lon: float,
                    speed: float = 0.0, heading: Optional[float] = None) -> KalmanState:
        """Register a GPS observation without calculating full ETA."""
        now = timezone.now()
        prev = self._states.get(tracking_number)
        
        if prev is not None:
            dt = (now - prev.last_update).total_seconds() if prev.last_update else 0
            predicted = self.kalman.predict(prev, dt)
            state = self.kalman.update(predicted, lat, lon, speed, heading, now)
        else:
            state = self.kalman.init_state(lat, lon, speed, heading or 0)
            state.last_update = now
        
        self._states[tracking_number] = state
        return state
    
    def get_state(self, tracking_number: str) -> Optional[KalmanState]:
        return self._states.get(tracking_number)
    
    # ── Private helpers ───────────────────────────────────────────────
    
    def _calculate_segment_distances(
        self, segments: list[RouteSegment], current_lat: float, current_lon: float
    ) -> tuple[float, float, Optional[str]]:
        """Calculate completed and remaining distances along route segments."""
        total = sum(s.distance_km for s in segments)
        completed = 0.0
        remaining = total
        upcoming_border = None
        
        # Simple approach: assume position is proportionally along the route
        # In production, use map-matching to snap GPS to nearest segment
        cumulative = 0.0
        closest_seg_idx = 0
        closest_dist = float('inf')
        
        for i, seg in enumerate(segments):
            # Check if driver is near this segment's midpoint
            mid_lat = current_lat  # In production, use segment midpoint
            mid_lon = current_lon
            d = haversine_km(current_lat, current_lon, mid_lat, mid_lon)
            if d < closest_dist:
                closest_dist = d
                closest_seg_idx = i
            cumulative += seg.distance_km
        
        # Estimate completed based on nearest segment
        completed = sum(s.distance_km for s in segments[:closest_seg_idx])
        remaining = total - completed
        
        # Find upcoming border
        for s in segments[closest_seg_idx:]:
            if s.border_crossing:
                upcoming_border = s.border_crossing
                break
        
        return completed, remaining, upcoming_border
    
    def _get_road_factor(self, segments: Optional[list[RouteSegment]], distance_completed: float) -> float:
        """Get speed adjustment factor for current road type."""
        if not segments:
            return 1.0
        
        cumulative = 0.0
        for seg in segments:
            cumulative += seg.distance_km
            if cumulative >= distance_completed:
                base_speed = ROAD_TYPE_SPEEDS_KMH.get(seg.road_type, 60.0)
                return seg.estimated_speed_kmh / max(base_speed, 1.0)
        
        return 1.0
    
    def _estimate_rest_breaks(
        self, remaining_hours: float, departure_time: Optional[datetime], now: datetime
    ) -> float:
        """Estimate required rest break time."""
        if not departure_time:
            return 0.0
        
        drive_hours_elapsed = (now - departure_time).total_seconds() / 3600
        
        # Count how many 4.5h blocks remain
        total_drive_from_now = drive_hours_elapsed + remaining_hours
        breaks_needed = int(total_drive_from_now / self.DRIVE_HOURS_BEFORE_BREAK)
        breaks_already_taken = int(drive_hours_elapsed / self.DRIVE_HOURS_BEFORE_BREAK)
        
        return max(0, breaks_needed - breaks_already_taken) * self.REST_BREAK_MINUTES / 60.0


# Singleton
eta_engine = ETAEngine()
