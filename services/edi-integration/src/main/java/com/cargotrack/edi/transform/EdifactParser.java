package com.cargotrack.edi.transform;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Parses UN/EDIFACT messages into structured JSON for downstream processing.
 *
 * Supported message types:
 * - IFTMIN  (Instruction message — shipment booking)
 * - IFTSTA  (Transport status — tracking updates)
 * - CUSCAR  (Customs cargo report)
 * - CUSDEC  (Customs declaration)
 */
@Component
public class EdifactParser {

    private static final Logger log = LoggerFactory.getLogger(EdifactParser.class);
    private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    public record EdifactMessage(
            String messageType,
            String senderId,
            String recipientId,
            String referenceNumber,
            String timestamp,
            List<Map<String, String>> segments
    ) {}

    /**
     * Parse a raw EDIFACT message string into structured segments.
     */
    public EdifactMessage parse(String rawMessage) throws EdifactException {
        // Normalize line endings and trim
        String cleaned = rawMessage.replace("\r\n", "\n").replace("\r", "\n").trim();
        String[] lines = cleaned.split("\n");

        List<Map<String, String>> segments = new ArrayList<>();
        String messageType = "UNKNOWN";
        String senderId = "";
        String recipientId = "";
        String referenceNumber = "";
        String timestamp = "";

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.equals("'")) {
                continue;
            }

            String tag = trimmed.length() >= 3 ? trimmed.substring(0, 3) : "";
            String data = trimmed.length() > 4 ? trimmed.substring(3).replace("'", "") : "";

            Map<String, String> segment = new LinkedHashMap<>();
            segment.put("tag", tag);

            switch (tag) {
                case "UNB": // Interchange header
                    messageType = "INTERCHANGE";
                    String[] unbParts = data.split("\\+");
                    if (unbParts.length > 1) senderId = extractComponent(unbParts[1], 0);
                    if (unbParts.length > 2) recipientId = extractComponent(unbParts[2], 0);
                    if (unbParts.length > 3) timestamp = unbParts[3];
                    segment.put("sender", senderId);
                    segment.put("recipient", recipientId);
                    segment.put("timestamp", timestamp);
                    break;

                case "UNH": // Message header
                    String[] unhParts = data.split("\\+");
                    if (unhParts.length > 1) {
                        messageType = unhParts[1].replace(":", "_");
                        referenceNumber = unhParts.length > 0 ? unhParts[0] : "";
                    }
                    segment.put("messageType", messageType);
                    segment.put("referenceNumber", referenceNumber);
                    break;

                case "BGM": // Beginning of message
                    String[] bgmParts = data.split("\\+");
                    if (bgmParts.length > 0) {
                        segment.put("documentNumber", bgmParts[0]);
                    }
                    if (bgmParts.length > 1) {
                        segment.put("messageFunction", bgmParts[1]);
                    }
                    break;

                case "DTM": // Date/time/period
                    String[] dtmParts = data.split("\\+");
                    if (dtmParts.length > 1) {
                        segment.put("qualifier", dtmParts[0]);
                        segment.put("value", dtmParts[1]);
                    }
                    break;

                case "NAD": // Name and address
                    String[] nadParts = data.split("\\+");
                    if (nadParts.length > 0) segment.put("qualifier", nadParts[0]);
                    if (nadParts.length > 1) segment.put("partyId", nadParts[1]);
                    if (nadParts.length > 3) segment.put("partyName", nadParts[3]);
                    break;

                case "CNI": // Consignment info (IFTMIN)
                    String[] cniParts = data.split("\\+");
                    if (cniParts.length > 0) segment.put("consignmentNumber", cniParts[0]);
                    break;

                case "LOC": // Place/location
                    String[] locParts = data.split("\\+");
                    if (locParts.length > 0) segment.put("qualifier", locParts[0]);
                    if (locParts.length > 1) segment.put("locationCode", locParts[1]);
                    if (locParts.length > 2) segment.put("locationName", locParts[2]);
                    break;

                case "MEA": // Measurements
                    String[] meaParts = data.split("\\+");
                    if (meaParts.length > 1) segment.put("measurementCode", meaParts[1]);
                    if (meaParts.length > 2) segment.put("value", meaParts[2]);
                    break;

                case "GID": // Goods item details
                    String[] gidParts = data.split("\\+");
                    if (gidParts.length > 0) segment.put("itemNumber", gidParts[0]);
                    break;

                case "FTX": // Free text
                    String[] ftxParts = data.split("\\+");
                    if (ftxParts.length > 2) segment.put("text", ftxParts[2]);
                    break;

                case "RFF": // Reference
                    String[] rffParts = data.split("\\+");
                    if (rffParts.length > 2) segment.put("qualifier", rffParts[1]);
                    if (rffParts.length > 3) segment.put("reference", rffParts[2]);
                    break;

                default:
                    // Store raw data for unrecognized segments
                    segment.put("data", data);
                    break;
            }

            segments.add(segment);
        }

        return new EdifactMessage(
                messageType, senderId, recipientId, referenceNumber, timestamp, segments
        );
    }

    /**
     * Convert parsed EDIFACT to a JSON string for Kafka publishing.
     */
    public String toJson(EdifactMessage msg) {
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("standard", "EDIFACT");
        envelope.put("messageType", msg.messageType());
        envelope.put("senderId", msg.senderId());
        envelope.put("recipientId", msg.recipientId());
        envelope.put("referenceNumber", msg.referenceNumber());
        envelope.put("timestamp", msg.timestamp());
        envelope.put("segments", msg.segments());
        return gson.toJson(envelope);
    }

    private String extractComponent(String composite, int index) {
        String[] parts = composite.split(":");
        return parts.length > index ? parts[index] : "";
    }

    public static class EdifactException extends Exception {
        public EdifactException(String message) {
            super(message);
        }
    }
}
