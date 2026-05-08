// CargoTrack shared Rust types — canonical domain types used across all Rust services.
// Crates: gps-ingest, route-optimizer, container-matcher, fuel-optimizer (PyO3).
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Geospatial ──────────────────────────────────────────────────────────────

/// WGS84 coordinate with optional elevation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Position {
    pub latitude: f64,
    pub longitude: f64,
    pub elevation_m: Option<f64>,
    pub heading_deg: Option<f64>,
    pub speed_kmh: Option<f64>,
    pub accuracy_m: Option<f64>,
    pub timestamp: DateTime<Utc>,
}

impl Position {
    pub fn distance_km(&self, other: &Position) -> f64 {
        haversine_km(self.latitude, self.longitude, other.latitude, other.longitude)
    }
}

/// A named geographic point (depot, border post, warehouse, etc.).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GeoPoint {
    pub name: String,
    pub position: Position,
    pub country_code: Option<String>,
    pub point_type: PointType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PointType {
    Depot,
    BorderPost,
    Warehouse,
    Port,
    Weighbridge,
    FuelStation,
    CustomsOffice,
    DeliveryPoint,
    Other,
}

/// Polygonal geofence (port zone, border zone, warehouse radius, corridor segment).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Geofence {
    pub id: Uuid,
    pub name: String,
    pub vertices: Vec<Position>,
    pub fence_type: GeofenceType,
    pub metadata: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GeofenceType {
    PortZone,
    BorderZone,
    WarehouseRadius,
    CorridorSegment,
    NoGoZone,
    RestArea,
}

impl Geofence {
    /// Point-in-polygon check using ray-casting algorithm.
    pub fn contains(&self, pos: &Position) -> bool {
        let n = self.vertices.len();
        if n < 3 {
            return false;
        }
        let mut inside = false;
        let mut j = n - 1;
        for i in 0..n {
            let vi = &self.vertices[i];
            let vj = &self.vertices[j];
            if (vi.longitude > pos.longitude) != (vj.longitude > pos.longitude)
                && pos.latitude
                    < (vj.latitude - vi.latitude) * (pos.longitude - vi.longitude)
                        / (vj.longitude - vi.longitude)
                        + vi.latitude
            {
                inside = !inside;
            }
            j = i;
        }
        inside
    }
}

// ── Tracking ────────────────────────────────────────────────────────────────

/// A tracking event from an IoT device or manual update.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackingEvent {
    pub event_id: Uuid,
    pub shipment_id: Option<String>,
    pub vehicle_id: Option<String>,
    pub device_id: String,
    pub event_type: TrackingEventType,
    pub position: Position,
    pub metadata: std::collections::HashMap<String, String>,
    pub received_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TrackingEventType {
    PositionUpdate,
    GeofenceEnter,
    GeofenceExit,
    RouteDeviation,
    Stopped,
    Speeding,
    IgnitionOn,
    IgnitionOff,
    PanicButton,
    DoorOpen,
    DoorClose,
    TemperatureAlert,
    FuelLevelChange,
}

// ── Shipment ────────────────────────────────────────────────────────────────

/// Shipment state as defined in the BPMN workflow and Kafka event stream.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ShipmentStatus {
    Created,
    DocumentsVerified,
    CarrierAssigned,
    Dispatched,
    Departed,
    BorderCheckpoint,
    CustomsClearance,
    InTransit,
    LastMile,
    Delivered,
    Invoiced,
    Paid,
    Closed,
    Cancelled,
}

/// State-change event emitted to Kafka `cargotrack.shipments.state`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShipmentStateChange {
    pub shipment_id: String,
    pub reference: String,
    pub from_status: ShipmentStatus,
    pub to_status: ShipmentStatus,
    pub location: Option<GeoPoint>,
    pub corridor: Option<String>,
    pub driver_name: Option<String>,
    pub vehicle_reg: Option<String>,
    pub changed_by: String,
    pub occurred_at: DateTime<Utc>,
}

// ── Fleet / Vehicle ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleSpec {
    pub vehicle_id: String,
    pub registration: String,
    pub vehicle_type: VehicleType,
    pub make: String,
    pub model: String,
    pub year: u16,
    pub capacity_kg: f64,
    pub volume_cbm: Option<f64>,
    pub fuel_type: FuelType,
    pub fuel_tank_litres: f64,
    pub avg_consumption_l_per_100km: f64,
    pub axle_count: u8,
    pub has_refrigeration: bool,
    pub has_gps: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum VehicleType {
    Motorcycle,
    Pickup,
    Canter3Ton,
    Canter7Ton,
    Truck10Ton,
    Truck20Ton,
    Trailer28Ton,
    Trailer40Ton,
    RefrigeratedTruck,
    Tanker,
    Flatbed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FuelType {
    Petrol,
    Diesel,
    Cng,
    Electric,
}

// ── Alerts ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub alert_id: Uuid,
    pub rule_name: String,
    pub severity: AlertSeverity,
    pub entity_type: String,
    pub entity_id: String,
    pub message: String,
    pub corridor: Option<String>,
    pub position: Option<Position>,
    pub triggered_at: DateTime<Utc>,
    pub acknowledged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AlertSeverity {
    Info,
    Warning,
    Critical,
}

// ── Corridor ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Corridor {
    pub name: String,
    pub origin: GeoPoint,
    pub destination: GeoPoint,
    pub distance_km: f64,
    pub border_crossings: Vec<String>,
    pub countries: Vec<String>,
    pub risk_index: f64,
    pub average_transit_h: f64,
}

// ── Payment ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentEvent {
    pub payment_id: String,
    pub invoice_id: String,
    pub amount_usd: f64,
    pub amount_local: f64,
    pub currency_local: String,
    pub method: PaymentMethod,
    pub provider: String,
    pub status: PaymentStatus,
    pub occurred_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PaymentMethod {
    Card,
    MobileMoney,
    BankTransfer,
    Cash,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PaymentStatus {
    Pending,
    Succeeded,
    Failed,
    Refunded,
}

// ── Utility ─────────────────────────────────────────────────────────────────

/// Haversine distance in kilometers between two WGS84 coordinates.
pub fn haversine_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let r = 6371.0;
    let dlat = (lat2 - lat1).to_radians();
    let dlon = (lon2 - lon1).to_radians();
    let a = (dlat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (dlon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().asin();
    r * c
}

/// East African corridor definitions.
pub fn eac_corridors() -> Vec<(&'static str, f64, &'static str, &'static str)> {
    vec![
        ("Mombasa-Nairobi", 485.0, "KE", "KE"),
        ("Nairobi-Kampala", 665.0, "KE", "UG"),
        ("Kampala-Kigali", 498.0, "UG", "RW"),
        ("Nairobi-Juba", 1200.0, "KE", "SS"),
        ("Dar es Salaam-Lusaka", 1940.0, "TZ", "ZM"),
        ("Mombasa-Kampala", 1150.0, "KE", "UG"),
        ("Nairobi-Kigali", 1163.0, "KE", "RW"),
        ("Kampala-Goma", 515.0, "UG", "CD"),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_haversine_nairobi_mombasa() {
        let d = haversine_km(-1.2921, 36.8219, -4.0435, 39.6682);
        assert!((d - 440.0).abs() < 50.0, "Nairobi-Mombasa ~440 km, got {d}");
    }

    #[test]
    fn test_geofence_contains() {
        let fence = Geofence {
            id: Uuid::new_v4(),
            name: "Test Zone".into(),
            vertices: vec![
                Position { latitude: 0.0, longitude: 0.0, elevation_m: None, heading_deg: None, speed_kmh: None, accuracy_m: None, timestamp: Utc::now() },
                Position { latitude: 0.0, longitude: 1.0, elevation_m: None, heading_deg: None, speed_kmh: None, accuracy_m: None, timestamp: Utc::now() },
                Position { latitude: 1.0, longitude: 1.0, elevation_m: None, heading_deg: None, speed_kmh: None, accuracy_m: None, timestamp: Utc::now() },
                Position { latitude: 1.0, longitude: 0.0, elevation_m: None, heading_deg: None, speed_kmh: None, accuracy_m: None, timestamp: Utc::now() },
            ],
            fence_type: GeofenceType::WarehouseRadius,
            metadata: std::collections::HashMap::new(),
        };
        assert!(fence.contains(&Position { latitude: 0.5, longitude: 0.5, elevation_m: None, heading_deg: None, speed_kmh: None, accuracy_m: None, timestamp: Utc::now() }));
        assert!(!fence.contains(&Position { latitude: 2.0, longitude: 2.0, elevation_m: None, heading_deg: None, speed_kmh: None, accuracy_m: None, timestamp: Utc::now() }));
    }

    #[test]
    fn test_eac_corridors() {
        let corridors = eac_corridors();
        assert_eq!(corridors.len(), 8);
        assert_eq!(corridors[0].0, "Mombasa-Nairobi");
    }
}
