package com.cargotrack.edi.route;

import com.cargotrack.edi.config.EdiGatewayConfig;
import com.cargotrack.edi.processor.AsycudaEdifactTransformer;
import org.apache.camel.LoggingLevel;
import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

/**
 * ASYCUDA World integration route.
 *
 * ASYCUDA (Automated System for Customs Data) is UNCTAD's customs management
 * system deployed in Uganda, Rwanda, Burundi, and 90+ developing countries.
 * It uses EDIFACT messaging (CUSCAR, CUSDEC, CUSRES) over SFTP batch file
 * transfer, with optional AS2 for real-time exchange.
 *
 * Operations:
 *   - CUSDEC (Customs Declaration) — import/export/transit
 *   - CUSCAR (Customs Cargo Report) — manifest submission
 *   - CUSRES (Customs Response) — assessment, clearance, rejection
 *
 * File naming: [UNLOCode]_[MsgType]_[Date]_[SeqNo].[ext]
 *   Example: KAMBA_CUSDEC_20260508_0001.edi
 */
@Component
public class AsycudaRoute extends RouteBuilder {

    private final EdiGatewayConfig config;
    private final AsycudaEdifactTransformer transformer;

    public AsycudaRoute(EdiGatewayConfig config,
                        AsycudaEdifactTransformer transformer) {
        this.config = config;
        this.transformer = transformer;
    }

    @Override
    public void configure() {
        var asycuda = config.getCustomsSystems().get("asycuda");
        if (asycuda == null || asycuda.getSftpHost() == null || asycuda.getSftpHost().isBlank()) return;

        errorHandler(deadLetterChannel("file:{{cargotrack.edi.dlq-dir}}/asycuda")
            .maximumRedeliveries(asycuda.getMaxRetries())
            .redeliveryDelay(asycuda.getRetryBackoffMs())
            .retryAttemptedLogLevel(LoggingLevel.WARN));

        // ── SFTP poll: incoming CUSRES (customs response) files ────────
        from("sftp://" + asycuda.getSftpUser()
            + "@" + asycuda.getSftpHost() + ":" + asycuda.getSftpPort()
            + asycuda.getSftpPickupDir()
            + "?password=" + asycuda.getSftpPassword()
            + "&include=.*CUSRES.*|.*CUSREP.*"
            + "&delete=true"
            + "&delay=30000"
            + "&bridgeErrorHandler=true")
            .routeId("asycuda-poll-cusres")
            .log("ASYCUDA: received CUSRES file ${header.CamelFileName}")
            .process(transformer::parseEdifactResponse)
            .marshal().json()
            .to("kafka:cargotrack.customs.declaration.status");

        // ── SFTP poll: incoming CUSREP (status report) files ──────────
        from("sftp://" + asycuda.getSftpUser()
            + "@" + asycuda.getSftpHost() + ":" + asycuda.getSftpPort()
            + asycuda.getSftpPickupDir()
            + "?password=" + asycuda.getSftpPassword()
            + "&include=.*STATUS.*|.*REPORT.*"
            + "&delete=true"
            + "&delay=60000")
            .routeId("asycuda-poll-status")
            .log("ASYCUDA: received status report ${header.CamelFileName}")
            .process(transformer::parseEdifactStatusReport)
            .marshal().json()
            .to("kafka:cargotrack.customs.status.update");

        // ── Submit CUSDEC (customs declaration) ─────────────────────────
        from("kafka:cargotrack.customs.declaration.submit"
            + "?groupId=edi-asycuda"
            + "&autoOffsetReset=earliest")
            .routeId("asycuda-submit-cusdec")
            .filter().jsonpath("$.customsSystem == 'ASYCUDA'")
            .log("ASYCUDA: generating CUSDEC for declaration ${body}")
            .unmarshal().json(com.cargotrack.edi.model.CustomsDeclaration.class)
            .process(transformer::buildCusdecEdifact)
            .setHeader("CamelFileName", simple(
                "${body.customsOffice}_CUSDEC_${date:now:yyyyMMdd}_${date:now:HHmmss}.edi"))
            .to("sftp://" + asycuda.getSftpUser()
                + "@" + asycuda.getSftpHost() + ":" + asycuda.getSftpPort()
                + asycuda.getSftpDropDir()
                + "?password=" + asycuda.getSftpPassword());

        // ── Submit CUSCAR (cargo manifest) ─────────────────────────────
        from("kafka:cargotrack.customs.manifest.submit"
            + "?groupId=edi-asycuda"
            + "&autoOffsetReset=earliest")
            .routeId("asycuda-submit-cuscar")
            .log("ASYCUDA: generating CUSCAR for manifest ${body}")
            .unmarshal().json(com.cargotrack.edi.model.CargoManifest.class)
            .process(transformer::buildCuscarEdifact)
            .setHeader("CamelFileName", simple(
                "${body.portOfDischarge}_CUSCAR_${date:now:yyyyMMdd}_${date:now:HHmmss}.edi"))
            .to("sftp://" + asycuda.getSftpUser()
                + "@" + asycuda.getSftpHost() + ":" + asycuda.getSftpPort()
                + asycuda.getSftpDropDir()
                + "?password=" + asycuda.getSftpPassword());

        // ── AS2 transport for countries that support it ────────────────
        if (asycuda.getAs2Url() != null && !asycuda.getAs2Url().isBlank()) {
            from("direct:asycuda-as2-send")
                .routeId("asycuda-as2-submit")
                .log("ASYCUDA: sending via AS2 to ${header.as2-recipient}")
                .to("as2://" + asycuda.getAs2Url()
                    + "?requestUri=" + asycuda.getAs2Url()
                    + "&subject=CargoTrack-EDI"
                    + "&from=" + asycuda.getAs2Id()
                    + "&signingCertificateChain=" + asycuda.getAs2Certificate()
                    + "&signingPrivateKey=" + asycuda.getAs2PrivateKey()
                    + "&dispositionNotificationTo=cargotrack@edigateway.local");
        }
    }
}
