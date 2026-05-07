package com.cargotrack.workflow.service;

import com.cargotrack.workflow.messaging.KafkaEventPublisher;
import org.camunda.bpm.engine.RuntimeService;
import org.camunda.bpm.engine.runtime.ProcessInstance;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Starts and manages shipment lifecycle process instances.
 */
@Service
public class ShipmentWorkflowService {

    private static final Logger log = LoggerFactory.getLogger(ShipmentWorkflowService.class);
    private static final String PROCESS_KEY = "ShipmentLifecycle";

    private final RuntimeService runtimeService;
    private final KafkaEventPublisher eventPublisher;

    public ShipmentWorkflowService(RuntimeService runtimeService, KafkaEventPublisher eventPublisher) {
        this.runtimeService = runtimeService;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Start a new shipment lifecycle process.
     *
     * @param shipmentId  the shipment to track
     * @param variables   initial process variables (origin, destination, carrier, etc.)
     * @return process instance ID
     */
    public String startShipment(String shipmentId, Map<String, Object> variables) {
        var businessKey = "shipment:" + shipmentId;
        variables.put("shipmentId", shipmentId);

        ProcessInstance instance = runtimeService.startProcessInstanceByKey(
                PROCESS_KEY,
                businessKey,
                variables
        );

        log.info("Started shipment lifecycle {} (processInstanceId={})", shipmentId, instance.getId());
        eventPublisher.publishStateChange(
                shipmentId, "NONE", "CREATED", instance.getId(), variables
        );

        return instance.getId();
    }

    /**
     * Signal a shipment process to advance to the next state.
     * Called when an external event (document uploaded, customs cleared, etc.) occurs.
     */
    public void signalEvent(String processInstanceId, String eventName, Map<String, Object> variables) {
        runtimeService.signal(
                runtimeService.createSignalEvent(eventName)
                        .processInstanceId(processInstanceId)
                        .setVariables(variables)
        );
        log.info("Signaled {} on process {}", eventName, processInstanceId);
    }

    /**
     * Evaluate customs risk using the DMN decision table.
     */
    public Map<String, Object> evaluateCustomsRisk(String shipmentId, Map<String, Object> input) {
        var result = runtimeService
                .createDecisionEvaluation()
                .decisionDefinitionKey("customsRiskScoring")
                .variables(input)
                .evaluate();

        log.info("Customs risk evaluated for {}: {}", shipmentId,
                result.getSingleResult().getEntryMap());
        return result.getSingleResult().getEntryMap();
    }
}
