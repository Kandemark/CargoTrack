package com.cargotrack.edi.processor;

import com.cargotrack.edi.dto.EdiMessageEnvelope;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class EdifactToInternalProcessor implements Processor {

    private static final Logger log = LoggerFactory.getLogger(EdifactToInternalProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        String body = exchange.getIn().getBody(String.class);
        String fileName = exchange.getIn().getHeader("CamelFileName", String.class);

        if (body == null || body.isBlank()) {
            log.warn("Empty EDIFACT body received — file: {}", fileName);
            return;
        }

        Map<String, Object> parsed = parseEdifactSegments(body);
        String messageType = (String) parsed.getOrDefault("messageType", "UNKNOWN");
        String partnerId = (String) parsed.getOrDefault("partnerId", extractPartnerFromFilename(fileName));

        EdiMessageEnvelope envelope = EdiMessageEnvelope.received(
                UUID.randomUUID().toString(),
                partnerId,
                "EDIFACT",
                messageType,
                body);

        exchange.getMessage().setBody(envelope);
        exchange.getMessage().setHeader("messageType", messageType);
        exchange.getMessage().setHeader("partnerId", partnerId);
        exchange.getMessage().setHeader("ediFormat", "EDIFACT");

        log.info("Parsed EDIFACT message — type={}, partner={}, file={}", messageType, partnerId, fileName);
    }

    private Map<String, Object> parseEdifactSegments(String body) {
        Map<String, Object> result = new HashMap<>();
        String[] segments = body.split("'");
        for (String segment : segments) {
            String trimmed = segment.trim();
            if (trimmed.startsWith("UNH")) {
                result.put("messageType", extractElement(trimmed, 2));
            }
            if (trimmed.startsWith("UNB")) {
                result.put("partnerId", extractElement(trimmed, 3));
            }
        }
        if (!result.containsKey("messageType")) {
            result.put("messageType", "UNKNOWN");
        }
        return result;
    }

    private String extractElement(String segment, int index) {
        String[] elements = segment.split("\\+");
        return elements.length > index ? elements[index] : "";
    }

    private String extractPartnerFromFilename(String fileName) {
        if (fileName == null) return "UNKNOWN";
        int underscore = fileName.indexOf('_');
        return underscore > 0 ? fileName.substring(0, underscore) : fileName;
    }
}
