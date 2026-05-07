use crate::config::Config;
use crate::models::{GeofenceEvent, Position};
use anyhow::Context;
use rdkafka::config::ClientConfig;
use rdkafka::producer::{FutureProducer, FutureRecord};
use std::time::Duration;
use tracing::{debug, info};

pub struct KafkaProducer {
    producer: FutureProducer,
    positions_topic: String,
    geofence_topic: String,
}

impl KafkaProducer {
    pub fn new(config: &Config) -> anyhow::Result<Self> {
        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", &config.kafka_brokers)
            .set("message.timeout.ms", "5000")
            .set("compression.type", "snappy")
            .set("acks", "all")
            .set("enable.idempotence", "true")
            .create()
            .context("Failed to create Kafka producer")?;

        info!("Kafka producer connected to {}", config.kafka_brokers);

        Ok(Self {
            producer,
            positions_topic: config.kafka_topic_positions.clone(),
            geofence_topic: config.kafka_topic_geofence.clone(),
        })
    }

    /// Publish a position to the GPS positions topic.
    /// Uses device_id as the key for partition affinity (all positions from
    /// the same device land on the same partition for ordered processing).
    pub async fn publish_position(&self, position: &Position) -> anyhow::Result<()> {
        let payload = serde_json::to_vec(position)?;
        let key = &position.device_id;

        let record = FutureRecord::to(&self.positions_topic)
            .key(key)
            .payload(&payload);

        self.producer
            .send(record, Duration::from_secs(5))
            .await
            .map_err(|(e, _)| anyhow::anyhow!("Kafka send error: {e}"))?;

        debug!(
            "Published position for device {} at ({}, {})",
            position.device_id, position.latitude, position.longitude
        );
        Ok(())
    }

    /// Publish a batch of positions.
    pub async fn publish_batch(&self, positions: &[Position]) -> anyhow::Result<()> {
        for position in positions {
            self.publish_position(position).await?;
        }
        Ok(())
    }

    /// Publish a geofence event.
    pub async fn publish_geofence_event(&self, event: &GeofenceEvent) -> anyhow::Result<()> {
        let payload = serde_json::to_vec(event)?;
        let key = format!("{}:{}", event.vehicle_id, event.geofence_id);

        let record = FutureRecord::to(&self.geofence_topic)
            .key(&key)
            .payload(&payload);

        self.producer
            .send(record, Duration::from_secs(5))
            .await
            .map_err(|(e, _)| anyhow::anyhow!("Kafka geofence send error: {e}"))?;

        info!(
            "Geofence event: vehicle {} {:?} {}",
            event.vehicle_id, event.event_type, event.geofence_name
        );
        Ok(())
    }
}
