package com.cargotrack.edi.routes;

import org.apache.camel.builder.RouteBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class SftpPickupRoute extends RouteBuilder {

    private static final Logger log = LoggerFactory.getLogger(SftpPickupRoute.class);

    @Override
    public void configure() {
        // Periodic SFTP polling for EDI files from legacy partners without AS2
        from("sftp:{{edi.sftp.host}}:{{edi.sftp.port}}/inbound/x12"
                + "?username={{edi.sftp.username}}"
                + "&password={{edi.sftp.password}}"
                + "&delete=true"
                + "&include=.*\\.(x12|edi|xml|json)$"
                + "&delay={{edi.sftp.pollDelayMs:60000}}"
                + "&preSort=true"
                + "&readLock=changed"
                + "&readLockMinAge=5s")
                .routeId("sftp-poll-inbound").autoStartup(false)
                .log("Picked up file from SFTP: ${header.CamelFileName} (${file:size} bytes)")
                .choice()
                    .when(header("CamelFileName").endsWith(".x12"))
                        .setHeader("ediFormat", constant("ANSI_X12"))
                    .when(header("CamelFileName").endsWith(".edi"))
                        .setHeader("ediFormat", constant("EDIFACT"))
                    .when(header("CamelFileName").endsWith(".xml"))
                        .setHeader("ediFormat", constant("UBL"))
                    .when(header("CamelFileName").endsWith(".json"))
                        .setHeader("ediFormat", constant("JSON"))
                .end()
                .to("direct:edi-validate-and-route")
                .log("File ${header.CamelFileName} routed as ${header.ediFormat}");

        // Outbound SFTP delivery — write transformed JSON to partner drop zones
        from("direct:sftp-deliver")
                .routeId("sftp-deliver-outbound").autoStartup(false)
                .log("Delivering ${header.CamelFileName} to partner SFTP")
                .toD("sftp:{{edi.sftp.host}}:{{edi.sftp.port}}/outbound/${header.partnerId}"
                        + "?username={{edi.sftp.username}}"
                        + "&password={{edi.sftp.password}}");
    }
}
