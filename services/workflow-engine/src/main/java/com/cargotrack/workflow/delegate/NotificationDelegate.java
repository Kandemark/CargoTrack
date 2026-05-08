package com.cargotrack.workflow.delegate;

import org.camunda.bpm.engine.delegate.DelegateExecution;
import org.camunda.bpm.engine.delegate.JavaDelegate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component("notifyStakeholder")
public class NotificationDelegate implements JavaDelegate {

    private static final Logger log = LoggerFactory.getLogger(NotificationDelegate.class);

    private final KafkaTemplate<String, String> kafkaTemplate;

    public NotificationDelegate(KafkaTemplate<String, String> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    @Override
    public void execute(DelegateExecution execution) {
        String shipmentId = (String) execution.getVariable("shipmentId");
        String eventType = (String) execution.getVariable("eventType");
        String currentActivity = execution.getCurrentActivityName();

        log.info("Dispatching notification for shipment {} — event={}, activity={}",
                shipmentId, eventType, currentActivity);

        String payload = buildNotificationPayload(shipmentId, eventType, currentActivity, execution);

        kafkaTemplate.send("cargotrack.notifications.state", shipmentId, payload)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish notification for shipment {}", shipmentId, ex);
                    } else {
                        log.info("Notification published for shipment {} — offset={}",
                                shipmentId, result.getRecordMetadata().offset());
                    }
                });
    }

    private String buildNotificationPayload(String shipmentId, String eventType,
                                            String activity, DelegateExecution execution) {
        return String.format(
                "{\"shipmentId\":\"%s\",\"eventType\":\"%s\",\"activity\":\"%s\",\"timestamp\":\"%s\"}",
                shipmentId, eventType, activity, java.time.Instant.now().toString());
    }
}
