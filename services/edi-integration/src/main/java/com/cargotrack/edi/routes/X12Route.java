package com.cargotrack.edi.routes;

import com.cargotrack.edi.transform.X12Parser;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.component.kafka.KafkaConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Camel route for ANSI X12 EDI messages.
 *
 * Handles:
 * - 204 (Motor Carrier Load Tender)
 * - 214 (Transportation Carrier Shipment Status)
 * - 301 (Confirmation — customs release)
 */
@Component
public class X12Route extends RouteBuilder {

    private static final Logger log = LoggerFactory.getLogger(X12Route.class);
    private final X12Parser parser;

    public X12Route(X12Parser parser) {
        this.parser = parser;
    }

    @Override
    public void configure() {
        onException(X12Parser.X12Exception.class)
                .log("X12 parse error: ${exception.message}")
                .to("file:{{edi.error-dir}}?fileName=x12-error-${date:now:yyyyMMddHHmmss}.err")
                .handled(true);

        // SFTP pickup for X12 204 (load tender / shipment booking)
        from("sftp:{{edi.sftp.host}}:{{edi.sftp.port}}/inbound/x12/204"
                + "?username={{edi.sftp.user}}"
                + "&password={{edi.sftp.password}}"
                + "&delay=30000"
                + "&delete=true"
                + "&include=*.x12"
                + "&move=.processed/204-${file:name}")
                .routeId("x12-204-inbound")
                .log("Received X12 204 Load Tender: ${file:name}")
                .process(exchange -> {
                    String body = exchange.getIn().getBody(String.class);
                    var msg = parser.parse(body);
                    String json = parser.toJson(msg);
                    exchange.getIn().setBody(json);
                    exchange.getIn().setHeader(KafkaConstants.KEY, msg.controlNumber());
                })
                .to("kafka:{{kafka.topic.shipments}}");

        // SFTP pickup for X12 214 (shipment status)
        from("sftp:{{edi.sftp.host}}:{{edi.sftp.port}}/inbound/x12/214"
                + "?username={{edi.sftp.user}}"
                + "&password={{edi.sftp.password}}"
                + "&delay=30000"
                + "&delete=true"
                + "&include=*.x12"
                + "&move=.processed/214-${file:name}")
                .routeId("x12-214-inbound")
                .log("Received X12 214 Shipment Status: ${file:name}")
                .process(exchange -> {
                    String body = exchange.getIn().getBody(String.class);
                    var msg = parser.parse(body);
                    String json = parser.toJson(msg);
                    exchange.getIn().setBody(json);
                    exchange.getIn().setHeader(KafkaConstants.KEY, msg.controlNumber());
                })
                .to("kafka:{{kafka.topic.tracking}}");

        // SFTP pickup for X12 301 (customs release confirmation)
        from("sftp:{{edi.sftp.host}}:{{edi.sftp.port}}/inbound/x12/301"
                + "?username={{edi.sftp.user}}"
                + "&password={{edi.sftp.password}}"
                + "&delay=30000"
                + "&delete=true"
                + "&include=*.x12"
                + "&move=.processed/301-${file:name}")
                .routeId("x12-301-inbound")
                .log("Received X12 301 Customs Release: ${file:name}")
                .process(exchange -> {
                    String body = exchange.getIn().getBody(String.class);
                    var msg = parser.parse(body);
                    String json = parser.toJson(msg);
                    exchange.getIn().setBody(json);
                    exchange.getIn().setHeader(KafkaConstants.KEY, msg.controlNumber());
                })
                .to("kafka:{{kafka.topic.customs}}");
    }
}
