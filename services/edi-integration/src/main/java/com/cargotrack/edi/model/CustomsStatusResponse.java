package com.cargotrack.edi.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomsStatusResponse {
    private String declarationId;
    private String customsSystem;
    private String status;
    private String assessmentChannel;
    private String customsOfficer;
    private String inspectionRequired;
    private String inspectionLocation;
    private LocalDateTime inspectionDate;
    private List<String> requiredDocuments;
    private String releaseOrderNumber;
    private LocalDateTime releasedAt;
    private String remarks;
    private String rawResponse;  // Original response for audit
}
