use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub latitude: f64,
    pub longitude: f64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stop {
    pub id: String,
    pub location: Location,
    pub time_window: Option<TimeWindow>,
    pub service_time_min: f64,
    pub demand_kg: f64,
    pub shipment_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeWindow {
    pub earliest: DateTime<Utc>,
    pub latest: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vehicle {
    pub id: String,
    pub start_location: Location,
    pub end_location: Option<Location>,
    pub capacity_kg: f64,
    pub available_from: Option<DateTime<Utc>>,
    pub available_until: Option<DateTime<Utc>>,
    pub cost_per_km: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteOptimizationRequest {
    pub request_id: String,
    pub depot: Location,
    pub stops: Vec<Stop>,
    pub vehicles: Vec<Vehicle>,
    pub max_distance_km: Option<f64>,
    pub max_duration_h: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteSolution {
    pub request_id: String,
    pub routes: Vec<VehicleRoute>,
    pub total_distance_km: f64,
    pub total_cost: f64,
    pub unserved_stops: Vec<String>,
    pub computed_at: DateTime<Utc>,
    pub solver_metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleRoute {
    pub vehicle_id: String,
    pub stop_sequence: Vec<RouteStop>,
    pub distance_km: f64,
    pub duration_h: f64,
    pub load_kg: f64,
    pub cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteStop {
    pub stop_id: String,
    pub arrival_time: DateTime<Utc>,
    pub departure_time: DateTime<Utc>,
    pub distance_from_prev_km: f64,
}

/// Haverine distance between two points in kilometers.
pub fn haversine_km(a: &Location, b: &Location) -> f64 {
    let lat1 = a.latitude.to_radians();
    let lat2 = b.latitude.to_radians();
    let dlat = (b.latitude - a.latitude).to_radians();
    let dlon = (b.longitude - a.longitude).to_radians();

    let a_val = (dlat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
    let c = 2.0 * a_val.sqrt().asin();
    6371.0 * c
}
