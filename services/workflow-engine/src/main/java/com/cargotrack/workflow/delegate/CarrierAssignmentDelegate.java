package com.cargotrack.workflow.delegate;

import org.camunda.bpm.engine.delegate.DelegateExecution;
import org.camunda.bpm.engine.delegate.JavaDelegate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component("carrierAssignment")
public class CarrierAssignmentDelegate implements JavaDelegate {

    private static final Logger log = LoggerFactory.getLogger(CarrierAssignmentDelegate.class);

    @Override
    public void execute(DelegateExecution execution) {
        String shipmentId = (String) execution.getVariable("shipmentId");
        String carrierId = (String) execution.getVariable("carrierId");

        log.info("Assigning carrier {} to shipment {}", carrierId != null ? carrierId : "(auto-select)", shipmentId);

        if (carrierId == null || carrierId.isBlank()) {
            carrierId = selectBestCarrier(execution);
        }

        execution.setVariable("carrierId", carrierId);
        execution.setVariable("carrierAssignedAt", java.time.Instant.now().toString());
        log.info("Shipment {} assigned to carrier {}", shipmentId, carrierId);
    }

    private String selectBestCarrier(DelegateExecution execution) {
        // Stub: query carrier availability, cost, and rating
        // In production, calls route-optimizer gRPC for carrier recommendation
        return "CARRIER-AUTO-" + System.currentTimeMillis() % 10000;
    }
}
