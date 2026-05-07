pub mod teltonika;
pub mod concox;
pub mod meitrack;

use crate::models::{Position, RawDevicePacket};
use anyhow::Result;

/// Common trait for GPS device protocol adapters.
pub trait ProtocolAdapter: Send + Sync {
    fn protocol_name(&self) -> &str;
    fn can_decode(&self, packet: &RawDevicePacket) -> bool;
    fn decode(&self, packet: &RawDevicePacket) -> Result<Vec<Position>>;
}

/// Auto-detect protocol and decode a raw packet.
pub fn decode_packet(
    packet: &RawDevicePacket,
    adapters: &[Box<dyn ProtocolAdapter>],
) -> Result<Vec<Position>> {
    // If protocol is explicitly set, use that adapter
    if packet.protocol != "auto" {
        if let Some(adapter) = adapters
            .iter()
            .find(|a| a.protocol_name() == packet.protocol)
        {
            return adapter.decode(packet);
        }
    }

    // Auto-detect
    for adapter in adapters {
        if adapter.can_decode(packet) {
            return adapter.decode(packet);
        }
    }

    anyhow::bail!("No protocol adapter could decode packet from device {}", packet.device_id)
}
