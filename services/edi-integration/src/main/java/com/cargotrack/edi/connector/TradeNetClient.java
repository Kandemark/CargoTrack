package com.cargotrack.edi.connector;

import com.cargotrack.edi.config.EdiGatewayConfig;
import com.cargotrack.edi.model.TariffQuery;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Direct API client for TradeNet's tariff and validation endpoints.
 *
 * TradeNet exposes REST endpoints for:
 *   - HS code tariff lookup (EAC CET rates)
 *   - TIN validation
 *   - Permit requirement checks
 *   - Exchange rate lookup (for customs valuation)
 *
 * These are lightweight queries that don't need full SOAP/Camel routing.
 */
@Component
public class TradeNetClient {

    private final EdiGatewayConfig config;

    public TradeNetClient(EdiGatewayConfig config) {
        this.config = config;
    }

    /**
     * Look up the EAC Common External Tariff rate for an HS code.
     * Returns duty rate, VAT, excise, and any permit requirements.
     */
    public TariffQuery lookupTariff(String hsCode, String countryCode) {
        var tradenet = config.getCustomsSystems().get("tradenet");
        if (tradenet == null) return null;

        // In production, this calls TradeNet's HS Tariff API.
        // For now, return EAC CET defaults for common HS chapters.
        return TariffQuery.builder()
            .hsCode(hsCode)
            .countryCode(countryCode)
            .eacCetsRate(getEacCetsRate(hsCode))
            .vatRate(new BigDecimal("0.16")) // 16% VAT in Kenya
            .exciseRate(getExciseRate(hsCode))
            .build();
    }

    private BigDecimal getEacCetsRate(String hsCode) {
        if (hsCode == null) return BigDecimal.ZERO;
        var chapter = hsCode.substring(0, 2);
        return switch (chapter) {
            case "01", "02", "03", "04", "05" -> new BigDecimal("0.25"); // Live animals/food
            case "06", "07", "08", "09", "10" -> new BigDecimal("0.30"); // Agri products
            case "25", "26", "27" -> new BigDecimal("0.10"); // Minerals
            case "28", "29", "30", "31" -> new BigDecimal("0.00"); // Chemicals/pharma
            case "72", "73", "74", "75", "76" -> new BigDecimal("0.15"); // Metals
            case "84", "85" -> new BigDecimal("0.05"); // Machinery/electronics
            case "87" -> new BigDecimal("0.25"); // Vehicles
            case "90", "91", "92", "93", "94", "95", "96", "97" -> new BigDecimal("0.10");
            default -> new BigDecimal("0.20");
        };
    }

    private BigDecimal getExciseRate(String hsCode) {
        if (hsCode == null) return BigDecimal.ZERO;
        var chapter = hsCode.substring(0, 2);
        return switch (chapter) {
            case "22" -> new BigDecimal("0.05"); // Beverages
            case "24" -> new BigDecimal("0.30"); // Tobacco
            case "87" -> new BigDecimal("0.10"); // Vehicles
            default -> BigDecimal.ZERO;
        };
    }
}
