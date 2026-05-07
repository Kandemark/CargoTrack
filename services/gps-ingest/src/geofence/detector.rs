use crate::models::{GeofenceEvent, GeofenceEventType, Position};
use chrono::Utc;
use geo::{Contains, Coord, Point, Polygon};
use parking_lot::RwLock;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Clone, Deserialize)]
pub struct GeofenceDefinition {
    pub id: String,
    pub name: String,
    /// GeoJSON-style polygon coordinates: [[[lon, lat], ...]]
    pub coordinates: Vec<Vec<[f64; 2]>>,
}

#[derive(Debug, Clone, Default)]
pub struct GeofenceState {
    /// Vehicles currently inside each geofence.
    pub vehicles_inside: HashMap<String, Vec<String>>,
    /// Geofences each vehicle is currently inside.
    pub vehicle_geofences: HashMap<String, Vec<String>>,
}

pub struct GeofenceDetector {
    polygons: Vec<(GeofenceDefinition, Polygon)>,
    state: Arc<RwLock<GeofenceState>>,
}

impl GeofenceDetector {
    pub fn new(definitions: Vec<GeofenceDefinition>) -> Self {
        let polygons = definitions
            .into_iter()
            .filter_map(|def| {
                let exterior: Vec<Coord> = def
                    .coordinates
                    .first()?
                    .iter()
                    .map(|c| Coord {
                        x: c[0], // lon
                        y: c[1], // lat
                    })
                    .collect();
                let polygon = Polygon::new(
                    geo::LineString::from(exterior),
                    vec![],
                );
                Some((def, polygon))
            })
            .collect();

        Self {
            polygons,
            state: Arc::new(RwLock::new(GeofenceState::default())),
        }
    }

    /// Check a position against all geofences and return any events.
    pub fn check_position(&self, position: &Position) -> Vec<GeofenceEvent> {
        let vehicle_id = position
            .vehicle_id
            .clone()
            .unwrap_or_else(|| position.device_id.clone());

        let point = Point::new(position.longitude, position.latitude);
        let now = Utc::now();
        let mut events = Vec::new();
        let mut state = self.state.write();

        // Initialize vehicle entry
        state
            .vehicle_geofences
            .entry(vehicle_id.clone())
            .or_default();

        for (def, polygon) in &self.polygons {
            let contains = polygon.contains(&point);
            let currently_inside = state
                .vehicle_geofences
                .get(&vehicle_id)
                .map(|gf| gf.contains(&def.id))
                .unwrap_or(false);

            if contains && !currently_inside {
                // Vehicle entered geofence
                state
                    .vehicles_inside
                    .entry(def.id.clone())
                    .or_default()
                    .push(vehicle_id.clone());
                state
                    .vehicle_geofences
                    .get_mut(&vehicle_id)
                    .unwrap()
                    .push(def.id.clone());

                events.push(GeofenceEvent {
                    vehicle_id: vehicle_id.clone(),
                    geofence_id: def.id.clone(),
                    geofence_name: def.name.clone(),
                    event_type: GeofenceEventType::Enter,
                    position: position.clone(),
                    occurred_at: now,
                });
            } else if !contains && currently_inside {
                // Vehicle exited geofence
                if let Some(vehicles) = state.vehicles_inside.get_mut(&def.id) {
                    vehicles.retain(|v| v != &vehicle_id);
                }
                if let Some(gfs) = state.vehicle_geofences.get_mut(&vehicle_id) {
                    gfs.retain(|id| id != &def.id);
                }

                events.push(GeofenceEvent {
                    vehicle_id: vehicle_id.clone(),
                    geofence_id: def.id.clone(),
                    geofence_name: def.name.clone(),
                    event_type: GeofenceEventType::Exit,
                    position: position.clone(),
                    occurred_at: now,
                });
            }
        }

        events
    }

    /// Load geofence definitions from a JSON file.
    pub fn from_json_file(path: &str) -> anyhow::Result<Self> {
        let data = std::fs::read_to_string(path)?;
        let definitions: Vec<GeofenceDefinition> = serde_json::from_str(&data)?;
        Ok(Self::new(definitions))
    }
}
