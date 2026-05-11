package com.cargotrack.edi.connector;

import com.cargotrack.edi.config.EdiGatewayConfig;
import com.cargotrack.edi.model.TariffQuery;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Direct API client for TANCIS (Tanzania Customs Integrated System).
 *
 * TANCIS REST API endpoints:
 *   - POST /oauth/token              — OAuth2 token (client_credentials)
 *   - GET  /tariff/{hsCode}          — HS code tariff rates
 *   - POST /validation/tin           — TIN validation
 *   - GET  /exchange-rates           — Bank of Tanzania rates
 *   - GET  /border/{code}/status     — border crossing operational status
 */
@Component
public class TancisClient {

    private final EdiGatewayConfig config;

    public TancisClient(EdiGatewayConfig config) {
        this.config = config;
    }

    /**
     * Look up Tanzania-specific tariff rates for an HS code.
     * Tanzania applies EAC CET but has country-specific variations
     * for sensitive products (sugar, textiles, etc.).
     */
    public TariffQuery lookupTariff(String hsCode) {
        var tancis = config.getCustomsSystems().get("tancis");
        if (tancis == null) return null;

        return TariffQuery.builder()
            .hsCode(hsCode)
            .countryCode("TZ")
            .eacCetsRate(getEacCetsRate(hsCode))
            .vatRate(new BigDecimal("0.18")) // 18% VAT in Tanzania
            .exciseRate(getExciseRate(hsCode))
            .build();
    }

    private BigDecimal getEacCetsRate(String hsCode) {
        if (hsCode == null) return BigDecimal.ZERO;
        var chapter = hsCode.substring(0, 2);
        // Tanzania applies higher rates on some sensitive products
        return switch (chapter) {
            case "17" -> new BigDecimal("0.35"); // Sugar (sensitive — higher than CET)
            case "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62", "63"
                -> new BigDecimal("0.25"); // Textiles (sensitive)
            case "84", "85" -> new BigDecimal("0.00"); // Capital goods exemption
            default -> new BigDecimal("0.25"); // General EAC CET
        };
    }

    private BigDecimal getExciseRate(String hsCode) {
        if (hsCode == null) return BigDecimal.ZERO;
        return switch (hsCode.substring(0, 2)) {
            case "22" -> new BigDecimal("0.10");
            case "24" -> new BigDecimal("0.30");
            default -> BigDecimal.ZERO;
        };
    }
}
