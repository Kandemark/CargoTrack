package com.cargotrack.edi.route;

import com.cargotrack.edi.config.EdiGatewayConfig;
import com.cargotrack.edi.processor.TradeNetRequestBuilder;
import com.cargotrack.edi.processor.TradeNetResponseParser;
import org.apache.camel.LoggingLevel;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.dataformat.JaxbDataFormat;
import org.springframework.stereotype.Component;

/**
 * TradeNet (Kenya Single Window) integration route.
 *
 * TradeNet is Kenya's national electronic single window system operated by
 * KenTrade. It connects to 40+ government agencies (KEBS, KRA, KPA, NEMA,
 * Port Health, etc.) and handles customs declarations, permits, and cargo
 * clearance at Mombasa port, JKIA, and border crossings (Busia, Malaba).
 *
 * Protocol: SOAP XML over HTTPS with mutual TLS
 * Operations:
 *   - SubmitImportDeclaration   — lodge SAD/import entry
 *   - SubmitExportDeclaration   — lodge export entry
 *   - SubmitTransitDeclaration  — lodge transit bond
 *   - QueryDeclarationStatus    — check progress
 *   - ReceiveClearanceNotification — async callback
 */
@Component
public class TradeNetRoute extends RouteBuilder {

    private final EdiGatewayConfig config;
    private final TradeNetRequestBuilder requestBuilder;
    private final TradeNetResponseParser responseParser;

    public TradeNetRoute(EdiGatewayConfig config,
                         TradeNetRequestBuilder requestBuilder,
                         TradeNetResponseParser responseParser) {
        this.config = config;
        this.requestBuilder = requestBuilder;
        this.responseParser = responseParser;
    }

    @Override
    public void configure() {
        var tradenet = config.getCustomsSystems().get("tradenet");
        if (tradenet == null) return;

        var jaxb = new JaxbDataFormat();
        jaxb.setContextPath("com.cargotrack.edi.tradenet");

        // Circuit breaker for the upstream customs system
        var cb = circuitBreaker()
            .resilience4jConfiguration()
            .timeoutEnabled(true)
            .timeoutDuration(tradenet.getConnectTimeoutMs())
            .minimumNumberOfCalls(3)
            .failureRateThreshold(50)
            .waitDurationInOpenState(30_000)
            .end();

        // Dead-letter channel for failed customs submissions
        errorHandler(deadLetterChannel("kafka:cargotrack.edi.dlq")
            .maximumRedeliveries(tradenet.getMaxRetries())
            .redeliveryDelay(tradenet.getRetryBackoffMs())
            .retryAttemptedLogLevel(LoggingLevel.WARN));

        // ── Submit declaration ─────────────────────────────────────────
        from("kafka:cargotrack.customs.declaration.submit"
            + "?groupId=edi-tradenet"
            + "&autoOffsetReset=earliest")
            .routeId("tradenet-submit-declaration")
            .log("TradeNet: submitting declaration ${body}")
            .unmarshal().json(com.cargotrack.edi.model.CustomsDeclaration.class)
            .process(requestBuilder::buildSubmitRequest)
            .marshal(jaxb)
            .setHeader("Content-Type", constant("text/xml;charset=UTF-8"))
            .setHeader("SOAPAction", constant("SubmitDeclaration"))
            .to(tradenet.getBaseUrl() + "/declaration/submit"
                + "?httpMethod=POST"
                + "&throwExceptionOnFailure=false"
                + "&connectTimeout=" + tradenet.getConnectTimeoutMs()
                + "&readTimeout=" + tradenet.getReadTimeoutMs())
            .unmarshal(jaxb)
            .process(responseParser::parseSubmitResponse)
            .marshal().json()
            .to("kafka:cargotrack.customs.declaration.status");

        // ── Query declaration status ────────────────────────────────────
        from("direct:tradenet-query-status")
            .routeId("tradenet-query-status")
            .log("TradeNet: querying status for ${header.declarationId}")
            .process(requestBuilder::buildStatusQuery)
            .marshal(jaxb)
            .setHeader("Content-Type", constant("text/xml;charset=UTF-8"))
            .to(tradenet.getBaseUrl() + "/declaration/status"
                + "?httpMethod=POST"
                + "&throwExceptionOnFailure=false"
                + "&connectTimeout=" + tradenet.getConnectTimeoutMs())
            .unmarshal(jaxb)
            .process(responseParser::parseStatusResponse)
            .marshal().json()
            .to("kafka:cargotrack.customs.declaration.status");

        // ── Scheduled status polling for in-progress declarations ──────
        from("quartz://tradenet/status-poll?cron=" + tradenet.getPollenCron())
            .routeId("tradenet-poll-in-progress")
            .to("jpa:com.cargotrack.edi.model.CustomsDeclaration"
                + "?query=select d from CustomsDeclaration d"
                + " where d.customsSystem = 'TRADENET'"
                + " and d.status in ('SUBMITTED','UNDER_REVIEW','ASSESSED')")
            .split(body())
            .setHeader("declarationId", simple("${body.declarationId}"))
            .to("direct:tradenet-query-status");

        // ── Receive clearance notification (SOAP callback) ─────────────
        from("jetty:http://0.0.0.0:{{cargotrack.edi.callback-port}}/tradenet/notification"
            + "?httpMethodRestrict=POST")
            .routeId("tradenet-clearance-callback")
            .log("TradeNet: received clearance notification")
            .unmarshal(jaxb)
            .process(responseParser::parseClearanceNotification)
            .marshal().json()
            .to("kafka:cargotrack.customs.declaration.cleared")
            .setHeader("Content-Type", constant("text/xml;charset=UTF-8"))
            .transform(constant("<Ack><Status>OK</Status></Ack>"));
    }
}
