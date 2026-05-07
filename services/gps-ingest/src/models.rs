use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub device_id: String,
    pub vehicle_id: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub altitude_m: f64,
    pub speed_kmh: f64,
    pub heading_deg: f64,
    pub satellites: i32,
    pub hdop: f64,
    pub device_time: DateTime<Utc>,
    pub server_time: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionBatch {
    pub positions: Vec<Position>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeofenceEvent {
    pub vehicle_id: String,
    pub geofence_id: String,
    pub geofence_name: String,
    pub event_type: GeofenceEventType,
    pub position: Position,
    pub occurred_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GeofenceEventType {
    Unspecified = 0,
    Enter = 1,
    Exit = 2,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RawDevicePacket {
    pub device_id: String,
    pub protocol: String,
    pub payload: Vec<u8>,
    pub received_at: DateTime<Utc>,
}
