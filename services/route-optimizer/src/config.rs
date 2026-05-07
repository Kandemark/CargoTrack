use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub grpc_port: u16,
    pub cache_capacity: usize,
    pub log_json: bool,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            grpc_port: env::var("GRPC_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(50051),
            cache_capacity: env::var("CACHE_CAPACITY")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(1024),
            log_json: env::var("LOG_JSON")
                .ok()
                .map(|v| v == "1" || v == "true")
                .unwrap_or(false),
        }
    }
}
