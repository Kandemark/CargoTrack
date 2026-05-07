package com.cargotrack.edi.routes;

import com.cargotrack.edi.transform.EdifactParser;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.component.kafka.KafkaConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Camel route that watches for EDIFACT files on SFTP servers and
 * publishes parsed messages to Kafka topics.
 *
 * Supported document types:
 * - IFTMIN (shipment instructions) → cargotrack.shipments.state
 * - IFTSTA (transport status)     → cargotrack.tracking.events
 * - CUSCAR (customs cargo report) → cargotrack.customs.events
 * - CUSDEC (customs declaration)  → cargotrack.customs.events
 */
@Component
public class EdifactRoute extends RouteBuilder {

    private static final Logger log = LoggerFactory.getLogger(EdifactRoute.class);
    private final EdifactParser parser;

    public EdifactRoute(EdifactParser parser) {
        this.parser = parser;
    }

    @Override
    public void configure() {
        // Handle EDIFACT parsing errors gracefully
        onException(EdifactParser.EdifactException.class)
                .log("EDIFACT parse error: ${exception.message}")
                .to("file:{{edi.error-dir}}?fileName=edifact-error-${date:now:yyyyMMddHHmmss}.err")
                .handled(true);

        // SFTP pickup for EDIFACT IFTMIN (shipment instructions)
        from("sftp:{{edi.sftp.host}}:{{edi.sftp.port}}/inbound/edifact/iftmin"
                + "?username={{edi.sftp.user}}"
                + "&password={{edi.sftp.password}}"
                + "&delay=30000"
                + "&delete=true"
                + "&include=*.edi"
                + "&move=.processed/iftmin-${file:name}")
                .routeId("edifact-iftmin-inbound")
                .log("Received EDIFACT IFTMIN: ${file:name}")
                .process(exchange -> {
                    String body = exchange.getIn().getBody(String.class);
                    var msg = parser.parse(body);
                    String json = parser.toJson(msg);
                    exchange.getIn().setBody(json);
                    exchange.getIn().setHeader(KafkaConstants.KEY, msg.referenceNumber());
                    exchange.getIn().setHeader("MessageType", msg.messageType());
                })
                .to("kafka:{{kafka.topic.shipments}}");

        // SFTP pickup for EDIFACT IFTSTA (tracking status updates)
        from("sftp:{{edi.sftp.host}}:{{edi.sftp.port}}/inbound/edifact/iftsta"
                + "?username={{edi.sftp.user}}"
                + "&password={{edi.sftp.password}}"
                + "&delay=30000"
                + "&delete=true"
                + "&include=*.edi"
                + "&move=.processed/iftsta-${file:name}")
                .routeId("edifact-iftsta-inbound")
                .log("Received EDIFACT IFTSTA: ${file:name}")
                .process(exchange -> {
                    String body = exchange.getIn().getBody(String.class);
                    var msg = parser.parse(body);
                    String json = parser.toJson(msg);
                    exchange.getIn().setBody(json);
                    exchange.getIn().setHeader(KafkaConstants.KEY, msg.referenceNumber());
                })
                .to("kafka:{{kafka.topic.tracking}}");

        // SFTP pickup for EDIFACT CUSCAR/CUSDEC (customs documents)
        from("sftp:{{edi.sftp.host}}:{{edi.sftp.port}}/inbound/edifact/customs"
                + "?username={{edi.sftp.user}}"
                + "&password={{edi.sftp.password}}"
                + "&delay=60000"
                + "&delete=true"
                + "&include=*.edi"
                + "&move=.processed/customs-${file:name}")
                .routeId("edifact-customs-inbound")
                .log("Received EDIFACT CUSCAR/CUSDEC: ${file:name}")
                .process(exchange -> {
                    String body = exchange.getIn().getBody(String.class);
                    var msg = parser.parse(body);
                    String json = parser.toJson(msg);
                    exchange.getIn().setBody(json);
                    exchange.getIn().setHeader(KafkaConstants.KEY, msg.referenceNumber());
                })
                .to("kafka:{{kafka.topic.customs}}");

        // Outbound: Kafka → EDIFACT → SFTP drop
        from("kafka:{{kafka.topic.outbound}}?groupId=cargotrack-edi-outbound")
                .routeId("edifact-outbound")
                .log("Preparing EDIFACT outbound: ${body}")
                .process(exchange -> {
                    String json = exchange.getIn().getBody(String.class);
                    String edifact = generateOutboundEdifact(json);
                    exchange.getIn().setBody(edifact);
                })
                .setHeader("CamelFileName", simple("outbound-${date:now:yyyyMMddHHmmss}.edi"))
                .to("sftp:{{edi.sftp.host}}:{{edi.sftp.port}}/outbound"
                        + "?username={{edi.sftp.user}}"
                        + "&password={{edi.sftp.password}}");
    }

    /**
     * Generate a minimal EDIFACT message from internal JSON.
     * In production this uses full EDIFACT mapping templates.
     */
    private String generateOutboundEdifact(String json) {
        // Stub: production uses Smooks EDI templating
        return "UNB+UNOA:2+CARGOTRACK+PARTNER+"
                + java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd:HHmm"))
                + "+REF001'\n"
                + "UNH+1+IFTMIN:D:01B:UN'\n"
                + "BGM+335+SHIPMENT001+9'\n"
                + "DTM+137:" + java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE) + ":102'\n"
                + "FTX+ACK+++SHIPMENT CONFIRMED'\n"
                + "UNT+5+1'\n"
                + "UNZ+1+REF001'\n";
    }
}
