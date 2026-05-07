use anyhow::Context;
use chrono::Utc;
use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use tokio::sync::mpsc;
use tracing::{error, info, warn};

use crate::config::Config;
use crate::models::RawDevicePacket;

pub struct MqttSubscriber {
    client: AsyncClient,
}

impl MqttSubscriber {
    pub fn new(config: &Config) -> anyhow::Result<Self> {
        let mut options = MqttOptions::new(
            &config.mqtt_client_id,
            &config.mqtt_host,
            config.mqtt_port,
        );
        options.set_keep_alive(std::time::Duration::from_secs(30));
        options.set_clean_session(true);

        let (client, eventloop) = AsyncClient::new(options, 1024);

        // Spawn the event loop handler
        let topic = config.mqtt_topic.clone();
        tokio::spawn(async move {
            if let Err(e) = run_event_loop(eventloop, &topic).await {
                error!("MQTT event loop exited: {e:#}");
            }
        });

        Ok(Self { client })
    }

    pub async fn subscribe(&self, topic: &str) -> anyhow::Result<()> {
        self.client
            .subscribe(topic, QoS::AtLeastOnce)
            .await
            .context("Failed to subscribe to MQTT topic")?;
        info!("Subscribed to MQTT topic: {topic}");
        Ok(())
    }
}

async fn run_event_loop(
    mut eventloop: rumqttc::EventLoop,
    topic: &str,
) -> anyhow::Result<()> {
    let (tx, mut rx) = mpsc::channel::<RawDevicePacket>(4096);

    // Register the channel so protocol handlers can receive packets.
    // In production, this would be wired via a shared router.
    loop {
        match eventloop.poll().await {
            Ok(Event::Incoming(Packet::Publish(publish))) => {
                let device_id = extract_device_id(&publish.topic);
                let packet = RawDevicePacket {
                    device_id,
                    protocol: infer_protocol(&publish.topic),
                    payload: publish.payload.to_vec(),
                    received_at: Utc::now(),
                };
                if tx.send(packet).await.is_err() {
                    warn!("Packet channel closed, dropping message");
                }
            }
            Ok(Event::Incoming(Packet::ConnAck(_))) => {
                info!("MQTT connected");
            }
            Ok(Event::Incoming(_)) => {}
            Ok(Event::Outgoing(_)) => {}
            Err(e) => {
                error!("MQTT error: {e}");
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
        }
    }
}

fn extract_device_id(topic: &str) -> String {
    // Expect topics like: cargotrack/gps/{device_id}/raw
    let parts: Vec<&str> = topic.split('/').collect();
    if parts.len() >= 3 {
        parts[2].to_string()
    } else {
        "unknown".to_string()
    }
}

fn infer_protocol(topic: &str) -> String {
    // Protocol can be inferred from topic suffix or device registry.
    // Default to auto-detect in protocol adapter.
    "auto".to_string()
}
