package com.cargotrack.edi.transform;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Parses ANSI X12 messages into structured JSON.
 *
 * Supported transaction sets:
 * - 204 (Motor Carrier Load Tender — shipment booking)
 * - 214 (Transportation Carrier Shipment Status — tracking)
 * - 301 (Confirmation — customs release)
 */
@Component
public class X12Parser {

    private static final Logger log = LoggerFactory.getLogger(X12Parser.class);
    private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    public record X12Message(
            String transactionSet,
            String senderId,
            String receiverId,
            String controlNumber,
            String date,
            List<X12Segment> segments
    ) {}

    public record X12Segment(String id, List<String> elements) {}

    /**
     * Parse a raw ANSI X12 message into structured segments.
     */
    public X12Message parse(String rawMessage) throws X12Exception {
        String cleaned = rawMessage.replace("\r\n", "\n").replace("\r", "\n").trim();
        String[] lines = cleaned.split("~");

        List<X12Segment> segments = new ArrayList<>();
        String transactionSet = "UNKNOWN";
        String senderId = "";
        String receiverId = "";
        String controlNumber = "";
        String date = "";

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;

            // X12 segment: ID*elem1*elem2*elem3...
            String[] elements = trimmed.split("\\*");
            String segmentId = elements[0];

            List<String> elementList = new ArrayList<>();
            for (int i = 1; i < elements.length; i++) {
                elementList.add(elements[i]);
            }

            switch (segmentId) {
                case "ISA": // Interchange control header
                    if (elements.length > 6) senderId = elements[6];
                    if (elements.length > 8) receiverId = elements[8];
                    if (elements.length > 9) date = elements[9];
                    break;

                case "GS": // Functional group header
                    if (elements.length > 1) transactionSet = elements[1];
                    if (elements.length > 6) controlNumber = elements[6];
                    break;

                case "ST": // Transaction set header
                    if (elements.length > 1) transactionSet = elements[1];
                    if (elements.length > 2) controlNumber = elements[2];
                    break;

                case "B2": // Beginning segment (204)
                    if (elements.length > 1) {
                        elementList.add("scac=" + elements[1]); // carrier SCAC code
                    }
                    break;

                case "N1": // Name
                    if (elements.length > 1) elementList.add("qualifier=" + elements[1]);
                    if (elements.length > 2) elementList.add("name=" + elements[2]);
                    break;

                case "N3": // Address
                    if (elements.length > 1) elementList.add("address=" + elements[1]);
                    break;

                case "N4": // City/State/Zip
                    if (elements.length > 1) elementList.add("city=" + elements[1]);
                    if (elements.length > 2) elementList.add("state=" + elements[2]);
                    if (elements.length > 3) elementList.add("zip=" + elements[3]);
                    break;
            }

            segments.add(new X12Segment(segmentId, elementList));
        }

        return new X12Message(transactionSet, senderId, receiverId, controlNumber, date, segments);
    }

    /**
     * Convert parsed X12 to a JSON string for Kafka publishing.
     */
    public String toJson(X12Message msg) {
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("standard", "ANSI_X12");
        envelope.put("transactionSet", msg.transactionSet());
        envelope.put("senderId", msg.senderId());
        envelope.put("receiverId", msg.receiverId());
        envelope.put("controlNumber", msg.controlNumber());
        envelope.put("date", msg.date());

        List<Map<String, Object>> segList = new ArrayList<>();
        for (var seg : msg.segments()) {
            Map<String, Object> sm = new LinkedHashMap<>();
            sm.put("id", seg.id());
            sm.put("elements", seg.elements());
            segList.add(sm);
        }
        envelope.put("segments", segList);

        return gson.toJson(envelope);
    }

    public static class X12Exception extends Exception {
        public X12Exception(String message) {
            super(message);
        }
    }
}
