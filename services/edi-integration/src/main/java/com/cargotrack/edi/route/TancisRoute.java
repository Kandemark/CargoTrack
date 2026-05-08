package com.cargotrack.edi.route;

import com.cargotrack.edi.config.EdiGatewayConfig;
import com.cargotrack.edi.processor.TancisXmlTransformer;
import org.apache.camel.LoggingLevel;
import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

/**
 * TANCIS (Tanzania Customs Integrated System) integration route.
 *
 * TANCIS is the Tanzania Revenue Authority's customs management system
 * deployed at Dar es Salaam port, Zanzibar, and all border crossings
 * (Namanga, Taveta/Holili, Mutukula, Rusumo, Tunduma).
 *
 * Protocol: SOAP XML / REST over HTTPS with OAuth2 bearer tokens
 * Operations:
 *   - lodgeDeclaration    — SAD import/export/transit entry
 *   - queryAssessment     — check duty & tax assessment
 *   - queryRelease        — check release status
 *   - submitManifest      — cargo manifest
 *   - receiveAssessmentNotice — async callback
 *
 * Border crossings served:
 *   - Namanga (Kenya-Tanzania)
 *   - Taveta/Holili (Kenya-Tanzania)
 *   - Mutukula (Tanzania-Uganda)
 *   - Rusumo (Tanzania-Rwanda)
 *   - Tunduma (Tanzania-Zambia / SADC corridor)
 */
@Component
public class TancisRoute extends RouteBuilder {

    private final EdiGatewayConfig config;
    private final TancisXmlTransformer transformer;

    public TancisRoute(EdiGatewayConfig config,
                       TancisXmlTransformer transformer) {
        this.config = config;
        this.transformer = transformer;
    }

    @Override
    public void configure() {
        var tancis = config.getCustomsSystems().get("tancis");
        if (tancis == null) return;

        errorHandler(deadLetterChannel("kafka:cargotrack.edi.dlq")
            .maximumRedeliveries(tancis.getMaxRetries())
            .redeliveryDelay(tancis.getRetryBackoffMs())
            .retryAttemptedLogLevel(LoggingLevel.WARN));

        // ── Submit declaration ─────────────────────────────────────────
        from("kafka:cargotrack.customs.declaration.submit"
            + "?groupId=edi-tancis"
            + "&autoOffsetReset=earliest")
            .routeId("tancis-submit-declaration")
            .filter().jsonpath("$.customsSystem == 'TANCIS'")
            .log("TANCIS: lodging declaration ${body}")
            .unmarshal().json(com.cargotrack.edi.model.CustomsDeclaration.class)
            .process(transformer::buildLodgeDeclarationRequest)
            .setHeader("Content-Type", constant("application/xml;charset=UTF-8"))
            .setHeader("Authorization", simple("Bearer {{cargotrack.edi.tancis-oauth-token}}"))
            .to(tancis.getBaseUrl() + "/services/declaration/lodge"
                + "?httpMethod=POST"
                + "&throwExceptionOnFailure=false"
                + "&connectTimeout=" + tancis.getConnectTimeoutMs()
                + "&readTimeout=" + tancis.getReadTimeoutMs())
            .process(transformer::parseLodgeDeclarationResponse)
            .marshal().json()
            .to("kafka:cargotrack.customs.declaration.status");

        // ── Query assessment ────────────────────────────────────────────
        from("direct:tancis-query-assessment")
            .routeId("tancis-query-assessment")
            .log("TANCIS: querying assessment for ${header.declarationId}")
            .setHeader("Authorization", simple("Bearer {{cargotrack.edi.tancis-oauth-token}}"))
            .toD(tancis.getBaseUrl() + "/services/declaration/${header.declarationId}/assessment"
                + "?httpMethod=GET"
                + "&connectTimeout=" + tancis.getConnectTimeoutMs())
            .process(transformer::parseAssessmentResponse)
            .marshal().json()
            .to("kafka:cargotrack.customs.declaration.assessed");

        // ── Query release status ───────────────────────────────────────
        from("direct:tancis-query-release")
            .routeId("tancis-query-release")
            .log("TANCIS: checking release status for ${header.declarationId}")
            .setHeader("Authorization", simple("Bearer {{cargotrack.edi.tancis-oauth-token}}"))
            .toD(tancis.getBaseUrl() + "/services/release/${header.declarationId}"
                + "?httpMethod=GET"
                + "&connectTimeout=" + tancis.getConnectTimeoutMs())
            .process(transformer::parseReleaseResponse)
            .marshal().json()
            .to("kafka:cargotrack.customs.declaration.released");

        // ── Scheduled polling for in-progress declarations ─────────────
        from("quartz://tancis/assess-poll?cron=" + tancis.getPollenCron())
            .routeId("tancis-poll-assessments")
            .to("jpa:com.cargotrack.edi.model.CustomsDeclaration"
                + "?query=select d from CustomsDeclaration d"
                + " where d.customsSystem = 'TANCIS'"
                + " and d.status = 'SUBMITTED'")
            .split(body())
            .setHeader("declarationId", simple("${body.declarationId}"))
            .to("direct:tancis-query-assessment");

        from("quartz://tancis/release-poll?cron=" + tancis.getPollenCron())
            .routeId("tancis-poll-releases")
            .to("jpa:com.cargotrack.edi.model.CustomsDeclaration"
                + "?query=select d from CustomsDeclaration d"
                + " where d.customsSystem = 'TANCIS'"
                + " and d.status = 'ASSESSED'")
            .split(body())
            .setHeader("declarationId", simple("${body.declarationId}"))
            .to("direct:tancis-query-release");

        // ── Assessment notice callback (from TANCIS) ────────────────────
        from("jetty:http://0.0.0.0:{{cargotrack.edi.callback-port}}/tancis/assessment-notice"
            + "?httpMethodRestrict=POST")
            .routeId("tancis-assessment-callback")
            .log("TANCIS: received assessment notice")
            .process(transformer::parseAssessmentNotice)
            .marshal().json()
            .to("kafka:cargotrack.customs.declaration.assessed");
    }
}
