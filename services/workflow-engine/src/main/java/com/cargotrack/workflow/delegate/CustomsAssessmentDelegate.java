package com.cargotrack.workflow.delegate;

import org.camunda.bpm.engine.delegate.DelegateExecution;
import org.camunda.bpm.engine.delegate.JavaDelegate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component("customsAssessment")
public class CustomsAssessmentDelegate implements JavaDelegate {

    private static final Logger log = LoggerFactory.getLogger(CustomsAssessmentDelegate.class);

    @Override
    public void execute(DelegateExecution execution) {
        String shipmentId = (String) execution.getVariable("shipmentId");
        String cargoType = (String) execution.getVariable("cargoType");
        Double declaredValue = (Double) execution.getVariable("declaredValueUsd");

        log.info("Assessing customs risk for shipment {} — {} cargo, USD {}", shipmentId, cargoType, declaredValue);

        String riskLevel = assessRisk(shipmentId, cargoType, declaredValue);

        boolean greenLane = "GREEN".equals(riskLevel);
        execution.setVariable("customsRiskLevel", riskLevel);
        execution.setVariable("greenLane", greenLane);

        log.info("Customs assessment for {} — risk={}, greenLane={}", shipmentId, riskLevel, greenLane);
    }

    private String assessRisk(String shipmentId, String cargoType, Double declaredValue) {
        // Stub: DMN decision table evaluation
        // In production, evaluates Camunda DMN against risk-scoring model
        if (declaredValue != null && declaredValue > 100_000) {
            return "RED";
        }
        if (declaredValue != null && declaredValue > 50_000) {
            return "YELLOW";
        }
        return "GREEN";
    }
}
