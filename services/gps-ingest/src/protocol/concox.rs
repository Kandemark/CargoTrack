use super::ProtocolAdapter;
use crate::models::{Position, RawDevicePacket};
use chrono::Utc;

pub struct ConcoxAdapter;

impl ProtocolAdapter for ConcoxAdapter {
    fn protocol_name(&self) -> &str {
        "concox"
    }

    fn can_decode(&self, packet: &RawDevicePacket) -> bool {
        // Concox GT06 protocol: start bits 0x78 0x78
        packet.payload.len() >= 4
            && packet.payload[0] == 0x78
            && packet.payload[1] == 0x78
    }

    fn decode(&self, packet: &RawDevicePacket) -> anyhow::Result<Vec<Position>> {
        let data = &packet.payload;
        let server_time = Utc::now();

        if data.len() < 11 {
            anyhow::bail!("Concox packet too short");
        }

        // Protocol number (1B), skip to GPS data
        let gps_data = &data[4..];

        // Parse latitude (4 bytes, 32-bit signed * 180 / 2^23)
        let lat_raw = i32::from_be_bytes(
            gps_data[3..7].try_into().map_err(|_| anyhow::anyhow!("lat OOB"))?,
        );
        let latitude = (lat_raw as f64 * 180.0) / 8_388_608.0;

        // Parse longitude (4 bytes)
        let lon_raw = i32::from_be_bytes(
            gps_data[7..11].try_into().map_err(|_| anyhow::anyhow!("lon OOB"))?,
        );
        let longitude = (lon_raw as f64 * 180.0) / 8_388_608.0;

        let speed_kmh = gps_data.get(11).map(|&b| b as f64).unwrap_or(0.0);
        let heading_deg = gps_data
            .get(12)
            .map(|&b| (b as u16 & 0x03) as f64 * 90.0)
            .unwrap_or(0.0);
        let satellites = gps_data.get(12).map(|&b| (b >> 2) as i32).unwrap_or(0);

        // Device time from BCD-encoded bytes, fall back to server time
        let device_time = if gps_data.len() >= 20 {
            parse_gt06_time(&gps_data[13..19])
        } else {
            None
        }
        .unwrap_or(server_time);

        Ok(vec![Position {
            device_id: packet.device_id.clone(),
            vehicle_id: None,
            latitude,
            longitude,
            altitude_m: 0.0,
            speed_kmh,
            heading_deg,
            satellites,
            hdop: 1.0,
            device_time,
            server_time,
        }])
    }
}

fn parse_gt06_time(bytes: &[u8]) -> Option<chrono::DateTime<Utc>> {
    use chrono::TimeZone;
    let bcd = |b: u8| -> u32 { ((b >> 4) * 10 + (b & 0x0F)) as u32 };
    if bytes.len() < 6 {
        return None;
    }
    let year = 2000 + bcd(bytes[0]);
    let month = bcd(bytes[1]);
    let day = bcd(bytes[2]);
    let hour = bcd(bytes[3]);
    let minute = bcd(bytes[4]);
    let second = bcd(bytes[5]);
    Utc.with_ymd_and_hms(year as i32, month, day, hour, minute, second)
        .single()
}
