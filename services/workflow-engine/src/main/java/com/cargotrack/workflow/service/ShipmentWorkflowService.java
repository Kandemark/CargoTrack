package com.cargotrack.workflow.service;

import com.cargotrack.workflow.messaging.KafkaEventPublisher;
import org.camunda.bpm.engine.RuntimeService;
import org.camunda.bpm.engine.runtime.ProcessInstance;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ShipmentWorkflowService {

    private static final Logger log = LoggerFactory.getLogger(ShipmentWorkflowService.class);
    private static final String PROCESS_KEY = "shipment-lifecycle";

    private final RuntimeService runtimeService;
    private final KafkaEventPublisher eventPublisher;

    public ShipmentWorkflowService(RuntimeService runtimeService, KafkaEventPublisher eventPublisher) {
        this.runtimeService = runtimeService;
        this.eventPublisher = eventPublisher;
    }

    public String startShipment(String shipmentId, Map<String, Object> variables) {
        var businessKey = "shipment:" + shipmentId;
        variables.put("shipmentId", shipmentId);

        ProcessInstance instance = runtimeService.startProcessInstanceByKey(
                PROCESS_KEY, businessKey, variables);

        log.info("Started shipment lifecycle {} (processInstanceId={})", shipmentId, instance.getId());
        eventPublisher.publishStateChange(
                shipmentId, "NONE", "CREATED", instance.getId(), variables);

        return instance.getId();
    }

    public void signalEvent(String processInstanceId, String eventName,
                            Map<String, Object> variables) {
        var instance = runtimeService.createProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult();
        if (instance == null) {
            log.warn("No active process instance {} for signal {}", processInstanceId, eventName);
            return;
        }
        runtimeService.signalEventReceived(eventName, instance.getId(), variables);
        log.info("Signaled {} on process {}", eventName, processInstanceId);
    }
}
