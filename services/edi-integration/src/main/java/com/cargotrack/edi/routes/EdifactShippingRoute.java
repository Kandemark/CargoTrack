package com.cargotrack.edi.routes;

import com.cargotrack.edi.processor.EdifactToInternalProcessor;
import org.apache.camel.builder.RouteBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class EdifactShippingRoute extends RouteBuilder {

    private static final Logger log = LoggerFactory.getLogger(EdifactShippingRoute.class);

    @Override
    public void configure() {
        String kafkaBrokers = System.getenv().getOrDefault("KAFKA_BROKERS", "localhost:9092");

        // Handle runtime configuration of dead-letter channel
        errorHandler(deadLetterChannel("sftp:{{edi.sftp.host}}:{{edi.sftp.port}}/dead-letter"
                + "?username={{edi.sftp.username}}"
                + "&password={{edi.sftp.password}}"));

        // Inbound EDIFACT IFTMIN (shipping instructions) from partner SFTP drop zones
        from("sftp:{{edi.sftp.host}}:{{edi.sftp.port}}/inbound/edifact"
                + "?username={{edi.sftp.username}}"
                + "&password={{edi.sftp.password}}"
                + "&delete=true"
                + "&include=.*\\.edi$"
                + "&delay=30000")
                .routeId("edifact-sftp-inbound").autoStartup(false)
                .log("Received EDIFACT file: ${header.CamelFileName}")
                .process(new EdifactToInternalProcessor())
                .to("kafka:cargotrack.shipments.state"
                        + "?brokers=" + kafkaBrokers)
                .log("Published to Kafka: ${header.CamelFileName}");

        // Outbound EDIFACT IFTSTA (status) — consume internal events, transform, push to partner
        from("kafka:cargotrack.shipments.state"
                + "?brokers=" + kafkaBrokers
                + "&groupId=edi-gateway-shipping")
                .routeId("edifact-status-outbound").autoStartup(false)
                .filter(header("ediPartnerId").isNotNull())
                .log("Transforming shipment state to EDIFACT IFTSTA for partner ${header.ediPartnerId}")
                .setHeader("CamelFileName",
                        simple("IFTFSTA_${header.shipmentId}_${date:now:yyyyMMddHHmmss}.edi"))
                .to("sftp:{{edi.sftp.host}}:{{edi.sftp.port}}/outbound/edifact"
                        + "?username={{edi.sftp.username}}"
                        + "&password={{edi.sftp.password}}");

        // Health-check ping
        from("timer:edi-health?period=60000")
                .routeId("edi-health-check")
                .setBody(constant("EDI Gateway — alive"))
                .log("${body} — routes active: ${camelContext.routes.size()}");
    }
}
