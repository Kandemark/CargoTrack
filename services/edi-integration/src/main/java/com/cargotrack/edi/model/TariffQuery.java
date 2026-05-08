package com.cargotrack.edi.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TariffQuery {
    private String hsCode;
    private String countryCode;  // ISO 3166-1 alpha-2
    private String description;
    private BigDecimal generalDutyRate;
    private BigDecimal eacCetsRate;     // EAC Common External Tariff
    private BigDecimal vatRate;
    private BigDecimal exciseRate;
    private String requiresPermit;
    private String permitType;
    private String restrictionNotes;
}
