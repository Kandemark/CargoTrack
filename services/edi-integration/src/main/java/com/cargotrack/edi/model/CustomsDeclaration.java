package com.cargotrack.edi.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomsDeclaration {
    public enum DeclarationType { IMPORT, EXPORT, TRANSIT, WAREHOUSE, TEMPORARY }
    public enum AssessmentChannel { GREEN, YELLOW, RED }
    public enum DeclarationStatus {
        DRAFT, SUBMITTED, UNDER_REVIEW, ASSESSED,
        APPROVED, REJECTED, CLEARED, RELEASED, CANCELLED
    }

    private String declarationId;
    private String customsSystem;       // TRADENET, ASYCUDA, TANCIS
    private String customsOffice;
    private DeclarationType type;
    private String regimeCode;          // CPC — Customs Procedure Code
    private String declarantTin;
    private String declarantName;
    private String importerTin;
    private String importerName;
    private String exporterTin;
    private String exporterName;
    private String countryOfOrigin;
    private String countryOfExport;
    private String countryOfDestination;
    private String transportMode;       // SEA, ROAD, RAIL, AIR
    private String vehicleRegistration;
    private String borderCrossing;      // Busia, Malaba, Namanga, etc.
    private String shipmentTrackingNo;  // Links to CargoTrack shipment
    private List<DeclarationLineItem> lineItems;
    private BigDecimal totalCustomsValue;
    private String currencyCode;
    private BigDecimal dutyAmount;
    private BigDecimal vatAmount;
    private BigDecimal exciseAmount;
    private BigDecimal totalTaxAmount;
    private AssessmentChannel assessmentChannel;
    private DeclarationStatus status;
    private String rejectionReason;
    private LocalDateTime submittedAt;
    private LocalDateTime assessedAt;
    private LocalDateTime clearedAt;
    private String externalRef;         // System-specific reference

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DeclarationLineItem {
        private int lineNumber;
        private String hsCode;
        private String goodsDescription;
        private BigDecimal quantity;
        private String unitOfMeasure;
        private BigDecimal grossWeightKg;
        private BigDecimal netWeightKg;
        private BigDecimal itemValue;
        private String currencyCode;
        private BigDecimal dutyRate;
        private BigDecimal vatRate;
        private BigDecimal lineDuty;
        private BigDecimal lineVat;
        private List<String> permits;  // Required permits (phytosanitary, etc.)
    }
}
