package com.cargotrack.edi.routes;

import org.apache.camel.builder.RouteBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class As2TransportRoute extends RouteBuilder {

    private static final Logger log = LoggerFactory.getLogger(As2TransportRoute.class);

    @Override
    public void configure() {
        // Inbound AS2 receiver — triggered from REST controller
        from("direct:as2-receive")
                .routeId("as2-inbound-receiver")
                .log("AS2 message received — format=${header.ediFormat}, from=${header.AS2-From}")
                .choice()
                    .when(header("ediFormat").isEqualTo("EDIFACT"))
                        .to("direct:process-edifact")
                    .when(header("ediFormat").isEqualTo("ANSI_X12"))
                        .to("direct:process-x12")
                    .otherwise()
                        .log("WARN: Unknown EDI format, sending to dead-letter")
                        .to("mock:dead-letter")
                .end();

        // EDIFACT processor
        from("direct:process-edifact")
                .routeId("process-edifact")
                .log("Processing EDIFACT payload")
                .setBody(simple("{\"parsed\":true,\"format\":\"EDIFACT\"}"));

        // ANSI X12 processor
        from("direct:process-x12")
                .routeId("process-x12")
                .log("Processing ANSI X12 payload")
                .setBody(simple("{\"parsed\":true,\"format\":\"ANSI_X12\"}"));
    }
}
