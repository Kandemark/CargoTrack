package com.cargotrack.workflow.messaging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

@Component
public class KafkaEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(KafkaEventPublisher.class);
    private static final String TOPIC = "cargotrack.shipments.state";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public KafkaEventPublisher(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public void publishStateChange(
            String shipmentId,
            String fromState,
            String toState,
            String processInstanceId,
            Map<String, Object> variables
    ) {
        var event = new ShipmentStateChangeEvent(
                shipmentId, fromState, toState, processInstanceId,
                Instant.now().toString(), variables);

        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(TOPIC, shipmentId, payload)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.error("Failed to publish state change for {}: {}", shipmentId, ex.getMessage());
                        } else {
                            log.info("Published state change: {} {}->{}", shipmentId, fromState, toState);
                        }
                    });
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize event for shipment {}", shipmentId, e);
        }
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
