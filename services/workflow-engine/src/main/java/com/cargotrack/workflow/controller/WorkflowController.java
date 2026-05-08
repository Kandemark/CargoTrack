package com.cargotrack.workflow.controller;

import com.cargotrack.workflow.dto.ShipmentProcessRequest;
import org.camunda.bpm.engine.ProcessEngine;
import org.camunda.bpm.engine.ProcessEngines;
import org.camunda.bpm.engine.runtime.ProcessInstance;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/workflows")
public class WorkflowController {

    private static final Logger log = LoggerFactory.getLogger(WorkflowController.class);
    public static final String SHIPMENT_LIFECYCLE = "shipment-lifecycle";

    @PostMapping("/shipments")
    public ResponseEntity<Map<String, Object>> startShipmentWorkflow(
            @RequestBody ShipmentProcessRequest request) {

        ProcessEngine engine = ProcessEngines.getDefaultProcessEngine();

        Map<String, Object> variables = new HashMap<>();
        variables.put("shipmentId", request.shipmentId());
        variables.put("origin", request.origin());
        variables.put("destination", request.destination());
        variables.put("cargoType", request.cargoType());
        variables.put("declaredValueUsd", request.declaredValueUsd());
        variables.put("carrierId", request.carrierId() != null ? request.carrierId() : "");
        variables.put("shipperId", request.shipperId());

        if (request.variables() != null) {
            variables.putAll(request.variables());
        }

        ProcessInstance instance = engine.getRuntimeService()
                .startProcessInstanceByKey(SHIPMENT_LIFECYCLE, request.shipmentId(), variables);

        log.info("Started shipment lifecycle for {} — instanceId={}", request.shipmentId(), instance.getId());

        Map<String, Object> response = new HashMap<>();
        response.put("processInstanceId", instance.getId());
        response.put("shipmentId", request.shipmentId());
        response.put("status", "STARTED");

        return ResponseEntity.ok(response);
    }

    @GetMapping("/shipments/{shipmentId}")
    public ResponseEntity<Map<String, Object>> getShipmentStatus(@PathVariable String shipmentId) {
        ProcessEngine engine = ProcessEngines.getDefaultProcessEngine();

        var query = engine.getRuntimeService()
                .createProcessInstanceQuery()
                .processInstanceBusinessKey(shipmentId)
                .singleResult();

        Map<String, Object> response = new HashMap<>();
        response.put("shipmentId", shipmentId);

        if (query != null) {
            response.put("active", true);
            response.put("processInstanceId", query.getId());
            var activities = engine.getRuntimeService()
                    .getActiveActivityIds(query.getId());
            response.put("activityNames", activities);
        } else {
            response.put("active", false);
            // Check history
            var historic = engine.getHistoryService()
                    .createHistoricProcessInstanceQuery()
                    .processInstanceBusinessKey(shipmentId)
                    .singleResult();
            response.put("completed", historic != null && historic.getEndTime() != null);
            if (historic != null) {
                response.put("durationMs",
                        historic.getEndTime() != null ? historic.getDurationInMillis() : null);
            }
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> status = new HashMap<>();
        status.put("status", "UP");
        status.put("engine", ProcessEngines.getDefaultProcessEngine().getName());
        return ResponseEntity.ok(status);
    }
}
