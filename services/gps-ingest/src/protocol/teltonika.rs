use super::ProtocolAdapter;
use crate::models::{Position, RawDevicePacket};
use anyhow::Context;
use chrono::{TimeZone, Utc};

pub struct TeltonikaAdapter;

impl ProtocolAdapter for TeltonikaAdapter {
    fn protocol_name(&self) -> &str {
        "teltonika"
    }

    fn can_decode(&self, packet: &RawDevicePacket) -> bool {
        // Teltonika packets start with 4 zero bytes + data length
        packet.payload.len() >= 12
            && packet.payload[0] == 0x00
            && packet.payload[1] == 0x00
            && packet.payload[2] == 0x00
            && packet.payload[3] == 0x00
    }

    fn decode(&self, packet: &RawDevicePacket) -> anyhow::Result<Vec<Position>> {
        let data = &packet.payload;
        // Skip preamble (4B zeros) and data length (4B)
        let codec_id = *data.get(8).context("Missing codec ID")?;

        match codec_id {
            0x08 => decode_codec8(&packet.device_id, &data[9..]),
            0x0F => decode_codec16(&packet.device_id, &data[9..]),
            _ => anyhow::bail!("Unsupported Teltonika codec: {codec_id:#04x}"),
        }
    }
}

fn decode_codec8(device_id: &str, data: &[u8]) -> anyhow::Result<Vec<Position>> {
    if data.len() < 2 {
        anyhow::bail!("Codec8 record too short");
    }
    let record_count = data[0] as usize;
    let mut positions = Vec::with_capacity(record_count);
    let mut offset = 1;

    for _ in 0..record_count {
        if offset + 30 > data.len() {
            break;
        }
        let timestamp_ms = u64::from_be_bytes(
            data[offset..offset + 8].try_into().unwrap(),
        );
        offset += 8;

        let longitude = i32::from_be_bytes(data[offset..offset + 4].try_into().unwrap()) as f64
            / 10_000_000.0;
        offset += 4;

        let latitude = i32::from_be_bytes(data[offset..offset + 4].try_into().unwrap()) as f64
            / 10_000_000.0;
        offset += 4;

        let altitude_m = i16::from_be_bytes(data[offset..offset + 2].try_into().unwrap()) as f64;
        offset += 2;

        let heading_deg = u16::from_be_bytes(data[offset..offset + 2].try_into().unwrap()) as f64;
        offset += 2;

        let satellites = data[offset] as i32;
        offset += 1;

        let speed_kmh = u16::from_be_bytes(data[offset..offset + 2].try_into().unwrap()) as f64;
        offset += 2;

        // Skip IO elements (9 bytes in codec8: event IO ID(1) + total count(1) + 1B values count(1) + 1B(1) + 2B(1) + 4B(1) + 8B(1))
        offset += 9;

        let device_time = Utc
            .timestamp_millis_opt(timestamp_ms as i64)
            .single()
            .unwrap_or_else(Utc::now);

        positions.push(Position {
            device_id: device_id.to_string(),
            vehicle_id: None,
            latitude,
            longitude,
            altitude_m,
            speed_kmh,
            heading_deg,
            satellites,
            hdop: 1.0, // Codec8 doesn't carry HDOP
            device_time,
            server_time: Utc::now(),
        });
    }

    Ok(positions)
}

fn decode_codec16(device_id: &str, data: &[u8]) -> anyhow::Result<Vec<Position>> {
    // Codec16 is similar but with 2B record count
    if data.len() < 2 {
        anyhow::bail!("Codec16 record too short");
    }
    let record_count = u16::from_be_bytes(data[0..2].try_into().unwrap()) as usize;
    let mut positions = Vec::with_capacity(record_count);
    let mut offset = 2;

    for _ in 0..record_count {
        if offset + 31 > data.len() {
            break;
        }
        let timestamp_ms = u64::from_be_bytes(
            data[offset..offset + 8].try_into().unwrap(),
        );
        offset += 8;

        let longitude = i32::from_be_bytes(data[offset..offset + 4].try_into().unwrap()) as f64
            / 10_000_000.0;
        offset += 4;

        let latitude = i32::from_be_bytes(data[offset..offset + 4].try_into().unwrap()) as f64
            / 10_000_000.0;
        offset += 4;

        let altitude_m = i16::from_be_bytes(data[offset..offset + 2].try_into().unwrap()) as f64;
        offset += 2;

        let heading_deg = u16::from_be_bytes(data[offset..offset + 2].try_into().unwrap()) as f64;
        offset += 2;

        let satellites = data[offset] as i32;
        offset += 1;

        let speed_kmh = u16::from_be_bytes(data[offset..offset + 2].try_into().unwrap()) as f64;
        offset += 2;

        // Codec16 IO elements offset includes GSM signal (1B)
        offset += 10;

        let device_time = Utc
            .timestamp_millis_opt(timestamp_ms as i64)
            .single()
            .unwrap_or_else(Utc::now);

        positions.push(Position {
            device_id: device_id.to_string(),
            vehicle_id: None,
            latitude,
            longitude,
            altitude_m,
            speed_kmh,
            heading_deg,
            satellites,
            hdop: 1.0,
            device_time,
            server_time: Utc::now(),
        });
    }

    Ok(positions)
}
