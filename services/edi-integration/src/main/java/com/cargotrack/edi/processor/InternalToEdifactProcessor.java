package com.cargotrack.edi.processor;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;

public class InternalToEdifactProcessor implements Processor {

    private static final Logger log = LoggerFactory.getLogger(InternalToEdifactProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        Object body = exchange.getIn().getBody();
        String shipmentId = exchange.getIn().getHeader("shipmentId", String.class);
        String status = exchange.getIn().getHeader("shipmentStatus", String.class);

        log.info("Transforming internal event to EDIFACT IFTSTA — shipment={}, status={}", shipmentId, status);

        String edifact = buildIftsta(shipmentId, status);
        exchange.getMessage().setBody(edifact);
        exchange.getMessage().setHeader("ediFormat", "EDIFACT");
        exchange.getMessage().setHeader("messageType", "IFTSTA");
    }

    private String buildIftsta(String shipmentId, String status) {
        if (shipmentId == null) shipmentId = "UNKNOWN";
        if (status == null) status = "UNKNOWN";
        String date = java.time.LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmm"));

        return String.join("\n",
                "UNB+UNOA:2+CARGOTRACK+" + (shipmentId.length() > 6 ? shipmentId.substring(0, 6) : shipmentId) + "+" + date + "+" + System.currentTimeMillis() % 100000000 + "++CARGO'",
                "UNH+" + (System.currentTimeMillis() % 1000000) + "+IFTSTA:D:01B:UN'",
                "BGM+7+" + shipmentId + "+9'",
                "DTM+137:" + date + ":203'",
                "STS+1+" + mapStatusToEdifact(status) + "'",
                "RFF+AAQ:" + shipmentId + "'",
                "UNT+6+" + (System.currentTimeMillis() % 1000000) + "'",
                "UNZ+1+" + (System.currentTimeMillis() % 100000000) + "'"
        );
    }

    private String mapStatusToEdifact(String internalStatus) {
        return switch (internalStatus.toUpperCase()) {
            case "DISPATCHED" -> "45";   // Departed
            case "IN_TRANSIT" -> "24";   // In transit
            case "DELIVERED" -> "74";    // Delivered
            case "CUSTOMS_HOLD" -> "58"; // Held by customs
            default -> "24";             // Default: in transit
        };
    }
}
