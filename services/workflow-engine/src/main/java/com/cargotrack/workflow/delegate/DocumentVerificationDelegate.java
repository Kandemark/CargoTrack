package com.cargotrack.workflow.delegate;

import org.camunda.bpm.engine.delegate.DelegateExecution;
import org.camunda.bpm.engine.delegate.JavaDelegate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component("documentVerification")
public class DocumentVerificationDelegate implements JavaDelegate {

    private static final Logger log = LoggerFactory.getLogger(DocumentVerificationDelegate.class);

    @Override
    public void execute(DelegateExecution execution) {
        String shipmentId = (String) execution.getVariable("shipmentId");
        log.info("Verifying documents for shipment {}", shipmentId);

        ExecutionState state = verifyDocuments(shipmentId);

        execution.setVariable("documentsVerified", state == ExecutionState.PASSED);
        execution.setVariable("verificationNotes", state.notes());
        log.info("Document verification for {} — {}", shipmentId, state);
    }

    private ExecutionState verifyDocuments(String shipmentId) {
        // Stub: external document verification service call
        return ExecutionState.PASSED;
    }

    private enum ExecutionState {
        PASSED("All documents valid"),
        FAILED("Missing or invalid documents");

        private final String notes;
        ExecutionState(String notes) { this.notes = notes; }
        String notes() { return notes; }
    }
}
