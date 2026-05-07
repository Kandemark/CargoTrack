package com.cargotrack.workflow.messaging;

import com.google.gson.Gson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

/**
 * Publishes shipment state transitions to Kafka for downstream consumers
 * (Django read-model updates, webhook dispatcher, notification service).
 */
@Component
public class KafkaEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(KafkaEventPublisher.class);
    private static final String TOPIC = "cargotrack.shipments.state";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final Gson gson;

    public KafkaEventPublisher(KafkaTemplate<String, String> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
        this.gson = new Gson();
    }

    /**
     * Publish a shipment state change event to Kafka.
     */
    public void publishStateChange(
            String shipmentId,
            String fromState,
            String toState,
            String processInstanceId,
            Map<String, Object> variables
    ) {
        var event = new ShipmentStateChangeEvent(
                shipmentId,
                fromState,
                toState,
                processInstanceId,
                Instant.now().toString(),
                variables
        );

        String payload = gson.toJson(event);
        kafkaTemplate.send(TOPIC, shipmentId, payload)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish state change for {}: {}", shipmentId, ex.getMessage());
                    } else {
                        log.info("Published state change: {} {}→{}", shipmentId, fromState, toState);
                    }
                });
    }

    public record ShipmentStateChangeEvent(
            String shipmentId,
            String fromState,
            String toState,
            String processInstanceId,
            String occurredAt,
            Map<String, Object> metadata
    ) {}
}
