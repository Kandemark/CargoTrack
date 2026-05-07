use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub mqtt_host: String,
    pub mqtt_port: u16,
    pub mqtt_client_id: String,
    pub mqtt_topic: String,
    pub kafka_brokers: String,
    pub kafka_topic_positions: String,
    pub kafka_topic_geofence: String,
    pub geofence_definitions_path: Option<String>,
    pub log_json: bool,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            mqtt_host: env::var("MQTT_HOST").unwrap_or_else(|_| "localhost".into()),
            mqtt_port: env::var("MQTT_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(1883),
            mqtt_client_id: env::var("MQTT_CLIENT_ID")
                .unwrap_or_else(|_| "cargotrack-gps-ingest".into()),
            mqtt_topic: env::var("MQTT_TOPIC")
                .unwrap_or_else(|_| "cargotrack/gps/+/raw".into()),
            kafka_brokers: env::var("KAFKA_BROKERS")
                .unwrap_or_else(|_| "localhost:9092".into()),
            kafka_topic_positions: env::var("KAFKA_TOPIC_POSITIONS")
                .unwrap_or_else(|_| "cargotrack.gps.positions".into()),
            kafka_topic_geofence: env::var("KAFKA_TOPIC_GEOFENCE")
                .unwrap_or_else(|_| "cargotrack.gps.geofence".into()),
            geofence_definitions_path: env::var("GEOFENCE_DEFINITIONS_PATH").ok(),
            log_json: env::var("LOG_JSON")
                .ok()
                .map(|v| v == "1" || v == "true")
                .unwrap_or(false),
        }
    }
}
