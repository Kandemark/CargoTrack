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
public class CargoManifest {
    private String manifestNumber;
    private String carrierCode;
    private String vesselName;
    private String voyageNumber;
    private String portOfLoading;
    private String portOfDischarge;
    private LocalDateTime estimatedArrival;
    private LocalDateTime actualArrival;
    private List<ManifestLineItem> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ManifestLineItem {
        private String billOfLading;
        private String containerNumber;
        private String sealNumber;
        private String commodity;
        private int packageCount;
        private BigDecimal grossWeightKg;
        private String consignee;
        private String customsStatus;
    }
}
