package com.cargotrack.edi.processor;

import com.cargotrack.edi.model.CargoManifest;
import com.cargotrack.edi.model.CargoManifest.ManifestLineItem;
import com.cargotrack.edi.model.CustomsDeclaration;
import com.cargotrack.edi.model.CustomsDeclaration.DeclarationLineItem;
import com.cargotrack.edi.model.CustomsStatusResponse;
import org.apache.camel.Exchange;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Transforms between EDIFACT messages and internal canonical models.
 *
 * EDIFACT message types handled:
 *   CUSCAR — Customs Cargo Report (manifest)
 *   CUSDEC — Customs Declaration
 *   CUSRES — Customs Response (assessment/clearance/rejection)
 *
 * Segment structure follows UN/EDIFACT D.21B standard.
 * Separators: segment='\\'' component='+' element=':'
 */
@Component
public class AsycudaEdifactTransformer {

    private static final String SEG_SEP = "'";
    private static final String COMP_SEP = "+";
    private static final DateTimeFormatter DTM_FMT =
        DateTimeFormatter.ofPattern("yyyyMMddHHmm");

    // ── CUSDEC Builder ───────────────────────────────────────────────────

    public void buildCusdecEdifact(Exchange exchange) {
        var decl = exchange.getIn().getBody(CustomsDeclaration.class);
        var sb = new StringBuilder();

        // UNB — Interchange header
        sb.append("UNB+UNOA:3+CARGOTRACK+ASYCUDA+").append(nowDTM()).append("+").append(seqNo()).append("'");

        // UNH — Message header
        sb.append("UNH+").append(seqNo()).append("+CUSDEC:D:21B:UN:EAN008'");

        // BGM — Beginning of message
        sb.append("BGM+").append(mapDocType(decl.getType())).append("+").append(decl.getDeclarationId()).append("+9'");

        // DTM — Document date
        sb.append("DTM+137:").append(submittedDTM(decl)).append(":203'");

        // NAD — Declarant
        sb.append("NAD+DEC+").append(decl.getDeclarantTin()).append("::160'");
        sb.append("NAD+IM+").append(decl.getImporterTin()).append("::160'");
        sb.append("NAD+EX+").append(decl.getExporterTin()).append("::160'");

        // TDT — Transport details
        sb.append("TDT+20+").append(decl.getVehicleRegistration()).append("+++").append(decl.getTransportMode()).append("'");

        // LOC — Locations
        sb.append("LOC+27+").append(decl.getCustomsOffice()).append("'");
        sb.append("LOC+35+").append(decl.getCountryOfOrigin()).append("'");
        sb.append("LOC+36+").append(decl.getCountryOfExport()).append("'");

        // GID — Goods item details (line items)
        if (decl.getLineItems() != null) {
            for (int i = 0; i < decl.getLineItems().size(); i++) {
                var item = decl.getLineItems().get(i);
                sb.append("GID+").append(i + 1).append("'");

                // FTX — Goods description
                sb.append("FTX+AAA+++").append(escapeEdifact(item.getGoodsDescription())).append("'");

                // MEA — Measurements (weight)
                sb.append("MEA+WT+AAE+KGM:").append(item.getGrossWeightKg()).append("'");
                if (item.getNetWeightKg() != null) {
                    sb.append("MEA+WT+AAC+KGM:").append(item.getNetWeightKg()).append("'");
                }

                // PCD — Customs commodity code (HS code)
                sb.append("PCD+").append(item.getHsCode()).append("'");

                // MOA — Monetary amounts
                sb.append("MOA+146:").append(item.getItemValue()).append("'");
            }
        }

        // MOA — Total customs value
        sb.append("MOA+39:").append(decl.getTotalCustomsValue()).append("'");

        // UNT — Message trailer
        sb.append("UNT+").append(countSegments(sb)).append("+").append(seqNo()).append("'");

        // UNZ — Interchange trailer
        sb.append("UNZ+1+").append(seqNo()).append("'");

        exchange.getIn().setBody(sb.toString());
    }

    // ── CUSCAR Builder ───────────────────────────────────────────────────

    public void buildCuscarEdifact(Exchange exchange) {
        var manifest = exchange.getIn().getBody(CargoManifest.class);
        var sb = new StringBuilder();

        sb.append("UNB+UNOA:3+CARGOTRACK+ASYCUDA+").append(nowDTM()).append("+").append(seqNo()).append("'");
        sb.append("UNH+").append(seqNo()).append("+CUSCAR:D:21B:UN:EAN008'");

        // BGM
        sb.append("BGM+270+").append(manifest.getManifestNumber()).append("+9'");

        // TDT — Vessel/voyage
        sb.append("TDT+20+").append(safe(manifest.getVesselName())).append("+").append(safe(manifest.getVoyageNumber())).append("'");

        // LOC — Ports
        sb.append("LOC+9+").append(safe(manifest.getPortOfLoading())).append("'");
        sb.append("LOC+11+").append(safe(manifest.getPortOfDischarge())).append("'");

        // DTM — ETA
        if (manifest.getEstimatedArrival() != null) {
            sb.append("DTM+132:").append(manifest.getEstimatedArrival().format(DTM_FMT)).append(":203'");
        }

        // GID — Manifest items
        if (manifest.getItems() != null) {
            for (int i = 0; i < manifest.getItems().size(); i++) {
                var item = manifest.getItems().get(i);
                sb.append("GID+").append(i + 1).append("'");

                // RFF — B/L reference
                sb.append("RFF+BM:").append(safe(item.getBillOfLading())).append("'");

                // EQD — Container
                sb.append("EQD+CN+").append(safe(item.getContainerNumber())).append("'");

                // MEA — Weight
                sb.append("MEA+WT+AAE+KGM:").append(item.getGrossWeightKg()).append("'");

                // NAD — Consignee
                sb.append("NAD+CN+").append(safe(item.getConsignee())).append("'");
            }
        }

        sb.append("UNT+").append(countSegments(sb)).append("+").append(seqNo()).append("'");
        sb.append("UNZ+1+").append(seqNo()).append("'");

        exchange.getIn().setBody(sb.toString());
    }

    // ── CUSRES / Status Parser ──────────────────────────────────────────

    public void parseEdifactResponse(Exchange exchange) {
        var edifact = exchange.getIn().getBody(String.class);

        var response = CustomsStatusResponse.builder()
            .customsSystem("ASYCUDA");

        for (var seg : splitSegments(edifact)) {
            if (seg.startsWith("RFF+DEC:")) {
                response.declarationId(extractComp(seg, 1).replace("DEC:", ""));
            }
            if (seg.startsWith("STS+")) {
                response.status(mapAsycudaStatus(extractComp(seg, 1)));
            }
            if (seg.startsWith("FTX+REG+")) {
                response.remarks(extractComp(seg, 3));
            }
        }

        response.rawResponse(edifact);
        exchange.getIn().setBody(response.build());
    }

    public void parseEdifactStatusReport(Exchange exchange) {
        var edifact = exchange.getIn().getBody(String.class);
        var results = new ArrayList<CustomsStatusResponse>();

        for (var seg : splitSegments(edifact)) {
            if (seg.contains("+DEC+")) {
                var response = CustomsStatusResponse.builder()
                    .customsSystem("ASYCUDA")
                    .declarationId(extractComp(seg, 1))
                    .status("REPORTED")
                    .rawResponse(edifact)
                    .build();
                results.add(response);
            }
        }

        exchange.getIn().setBody(results.isEmpty() ? null : results);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private String nowDTM() {
        return LocalDateTime.now().format(DTM_FMT);
    }

    private String submittedDTM(CustomsDeclaration d) {
        if (d.getSubmittedAt() != null) return d.getSubmittedAt().format(DTM_FMT);
        return nowDTM();
    }

    private int seqNo() { return (int) (System.currentTimeMillis() % 100000); }

    private String mapDocType(CustomsDeclaration.DeclarationType type) {
        if (type == null) return "IM";
        return switch (type) {
            case IMPORT -> "IM";
            case EXPORT -> "EX";
            case TRANSIT -> "TR";
            case WAREHOUSE -> "WH";
            case TEMPORARY -> "TI";
        };
    }

    private String mapAsycudaStatus(String sts) {
        return switch (sts.toUpperCase()) {
            case "10" -> "SUBMITTED";
            case "20" -> "UNDER_REVIEW";
            case "30" -> "ASSESSED";
            case "40" -> "APPROVED";
            case "50" -> "CLEARED";
            case "60" -> "RELEASED";
            case "99" -> "REJECTED";
            default -> sts;
        };
    }

    private List<String> splitSegments(String edifact) {
        return List.of(edifact.split(SEG_SEP));
    }

    private int countSegments(StringBuilder sb) {
        return (int) sb.toString().lines().count();
    }

    private String extractComp(String seg, int idx) {
        var parts = seg.split("\\" + COMP_SEP);
        return idx < parts.length ? parts[idx] : "";
    }

    private String escapeEdifact(String s) {
        if (s == null) return "";
        return s.replace("?", "??").replace("'", "?\\'").replace("+", "?+").replace(":", "?:");
    }

    private String safe(String s) { return s != null ? s : ""; }
}
