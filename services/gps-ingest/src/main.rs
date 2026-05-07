mod config;
mod geofence;
mod kafka;
mod models;
mod protocol;

use config::Config;
use geofence::GeofenceDetector;
use kafka::KafkaProducer;
use protocol::{
    concox::ConcoxAdapter, decode_packet, meitrack::MeitrackAdapter,
    teltonika::TeltonikaAdapter, ProtocolAdapter,
};
use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use tracing::{error, info, warn};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env();

    if config.log_json {
        tracing_subscriber::fmt()
            .json()
            .with_env_filter(
                tracing_subscriber::EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| "info".into()),
            )
            .init();
    } else {
        tracing_subscriber::fmt()
            .with_env_filter(
                tracing_subscriber::EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| "info".into()),
            )
            .init();
    }

    info!("CargoTrack GPS Ingestion Service starting");
    info!("MQTT: {}:{}", config.mqtt_host, config.mqtt_port);
    info!("Kafka: {}", config.kafka_brokers);

    // Protocol adapters for major GPS tracker manufacturers
    let adapters: Vec<Box<dyn ProtocolAdapter>> = vec![
        Box::new(TeltonikaAdapter),
        Box::new(ConcoxAdapter),
        Box::new(MeitrackAdapter),
    ];
    info!(
        "Loaded {} protocol adapters: {}",
        adapters.len(),
        adapters
            .iter()
            .map(|a| a.protocol_name())
            .collect::<Vec<_>>()
            .join(", ")
    );

    // Geofence detector (optional — requires definitions file)
    let geofence_detector = match &config.geofence_definitions_path {
        Some(path) => {
            info!("Loading geofence definitions from {path}");
            Some(GeofenceDetector::from_json_file(path)?)
        }
        None => {
            info!("No geofence definitions file configured — geofencing disabled");
            None
        }
    };

    // Kafka producer
    let kafka_producer = KafkaProducer::new(&config)?;

    // MQTT subscriber
    let (mqtt_client, mut eventloop) = {
        let mut options = MqttOptions::new(
            &config.mqtt_client_id,
            &config.mqtt_host,
            config.mqtt_port,
        );
        options.set_keep_alive(std::time::Duration::from_secs(30));
        options.set_clean_session(true);
        AsyncClient::new(options, 1024)
    };

    mqtt_client
        .subscribe(&config.mqtt_topic, QoS::AtLeastOnce)
        .await?;
    info!("Subscribed to {}", config.mqtt_topic);

    // Main processing loop — poll MQTT, decode, geofence, publish to Kafka
    info!("Entering main processing loop");
    loop {
        match eventloop.poll().await {
            Ok(Event::Incoming(Packet::Publish(publish))) => {
                let packet = models::RawDevicePacket {
                    device_id: extract_device_id(&publish.topic),
                    protocol: infer_protocol(&publish.topic),
                    payload: publish.payload.to_vec(),
                    received_at: chrono::Utc::now(),
                };

                match decode_packet(&packet, &adapters) {
                    Ok(positions) => {
                        for position in &positions {
                            if let Err(e) = kafka_producer.publish_position(position).await {
                                error!("Failed to publish position: {e}");
                            }

                            if let Some(ref detector) = geofence_detector {
                                for event in detector.check_position(position) {
                                    if let Err(e) =
                                        kafka_producer.publish_geofence_event(&event).await
                                    {
                                        error!("Failed to publish geofence event: {e}");
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => warn!(
                        "Failed to decode packet from device {}: {e}",
                        packet.device_id
                    ),
                }
            }
            Ok(Event::Incoming(Packet::ConnAck(_))) => {
                info!("MQTT broker acknowledged connection");
            }
            Ok(Event::Incoming(_)) => {}
            Ok(Event::Outgoing(_)) => {}
            Err(e) => {
                error!("MQTT event loop error: {e}");
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
        }
    }
}

fn extract_device_id(topic: &str) -> String {
    topic
        .split('/')
        .nth(2)
        .map(|s| s.to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

fn infer_protocol(topic: &str) -> String {
    topic
        .split('/')
        .nth(4)
        .map(|s| s.to_string())
        .unwrap_or_else(|| "auto".to_string())
}
