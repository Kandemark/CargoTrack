use super::ProtocolAdapter;
use crate::models::{Position, RawDevicePacket};
use chrono::Utc;
use std::str;

pub struct MeitrackAdapter;

impl ProtocolAdapter for MeitrackAdapter {
    fn protocol_name(&self) -> &str {
        "meitrack"
    }

    fn can_decode(&self, packet: &RawDevicePacket) -> bool {
        // Meitrack ASCII text protocol: starts with "$$"
        packet.payload.len() >= 4
            && packet.payload[0] == b'$'
            && packet.payload[1] == b'$'
    }

    fn decode(&self, packet: &RawDevicePacket) -> anyhow::Result<Vec<Position>> {
        let text = str::from_utf8(&packet.payload)
            .map_err(|_| anyhow::anyhow!("Meitrack packet is not valid UTF-8"))?;

        // Format: $$<IMEI>,<command>,<data>*<checksum>\r\n
        let parts: Vec<&str> = text.trim_matches(|c: char| c == '$' || c == '\r' || c == '\n')
            .split('*')
            .collect();

        let data_part = parts.first().unwrap_or(&"");
        let fields: Vec<&str> = data_part.split(',').collect();

        if fields.len() < 7 {
            anyhow::bail!("Meitrack packet has insufficient fields");
        }

        let latitude = fields.get(3).and_then(|s| s.parse().ok()).unwrap_or(0.0);
        let longitude = fields.get(4).and_then(|s| s.parse().ok()).unwrap_or(0.0);
        let speed_kmh = fields.get(6).and_then(|s| s.parse().ok()).unwrap_or(0.0);
        let heading_deg = fields.get(7).and_then(|s| s.parse().ok()).unwrap_or(0.0);
        let satellites = fields.get(8).and_then(|s| s.parse().ok()).unwrap_or(0);
        let altitude_m = fields.get(12).and_then(|s| s.parse().ok()).unwrap_or(0.0);
        let hdop = fields.get(14).and_then(|s| s.parse().ok()).unwrap_or(1.0);

        Ok(vec![Position {
            device_id: packet.device_id.clone(),
            vehicle_id: None,
            latitude,
            longitude,
            altitude_m,
            speed_kmh,
            heading_deg,
            satellites,
            hdop,
            device_time: Utc::now(), // Meitrack ASCII format doesn't carry precise timestamps
            server_time: Utc::now(),
        }])
    }
}
