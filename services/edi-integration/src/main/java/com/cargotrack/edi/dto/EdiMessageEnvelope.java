package com.cargotrack.edi.dto;

import java.time.Instant;
import java.util.Map;

public record EdiMessageEnvelope(
        String messageId,
        String partnerId,
        String format,        // EDIFACT, ANSI_X12, UBL, JSON
        String messageType,   // IFTMIN, IFTSTA, 204, 214, etc.
        String direction,     // INBOUND, OUTBOUND
        String rawPayload,
        Map<String, Object> parsedFields,
        Instant receivedAt,
        String status         // RECEIVED, VALIDATED, TRANSFORMED, DELIVERED, FAILED
) {
    public static EdiMessageEnvelope received(String messageId, String partnerId,
                                               String format, String messageType,
                                               String rawPayload) {
        return new EdiMessageEnvelope(
                messageId, partnerId, format, messageType, "INBOUND",
                rawPayload, Map.of(), Instant.now(), "RECEIVED");
    }
}
