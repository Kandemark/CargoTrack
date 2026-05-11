package com.cargotrack.edi.processor;

import com.cargotrack.edi.model.CustomsDeclaration;
import com.cargotrack.edi.model.CustomsDeclaration.AssessmentChannel;
import com.cargotrack.edi.model.CustomsDeclaration.DeclarationStatus;
import com.cargotrack.edi.model.CustomsStatusResponse;
import org.apache.camel.Exchange;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;

import javax.xml.parsers.DocumentBuilderFactory;
import java.math.BigDecimal;

/**
 * Transforms between TANCIS XML messages and internal canonical models.
 *
 * TANCIS (Tanzania Customs Integrated System) uses a TRA XML schema
 * with namespaces: http://gov.tz.tra/tancis/declaration
 *
 * Message formats:
 *   - DeclarationLodgeRequest  — SAD import/export/transit entry
 *   - DeclarationLodgeResponse — acknowledgment with TANCIS ref
 *   - AssessmentNotice — duty/tax assessment result
 *   - ReleaseResponse — release order from customs
 */
@Component
public class TancisXmlTransformer {

    public void buildLodgeDeclarationRequest(Exchange exchange) {
        var decl = exchange.getIn().getBody(CustomsDeclaration.class);

        var xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        xml.append("<tancis:DeclarationLodgeRequest");
        xml.append(" xmlns:tancis=\"http://gov.tz.tra/tancis/declaration\">");

        // Header
        xml.append("<tancis:DeclarationType>").append(mapTancisType(decl.getType())).append("</tancis:DeclarationType>");
        xml.append("<tancis:CustomsOffice>").append(e(decl.getCustomsOffice())).append("</tancis:CustomsOffice>");
        xml.append("<tancis:RegimeCode>").append(e(decl.getRegimeCode())).append("</tancis:RegimeCode>");

        // Parties
        xml.append("<tancis:Declarant>");
        xml.append("<tancis:Tin>").append(e(decl.getDeclarantTin())).append("</tancis:Tin>");
        xml.append("<tancis:Name>").append(e(decl.getDeclarantName())).append("</tancis:Name>");
        xml.append("</tancis:Declarant>");

        xml.append("<tancis:Importer>");
        xml.append("<tancis:Tin>").append(e(decl.getImporterTin())).append("</tancis:Tin>");
        xml.append("<tancis:Name>").append(e(decl.getImporterName())).append("</tancis:Name>");
        xml.append("</tancis:Importer>");

        xml.append("<tancis:Exporter>");
        xml.append("<tancis:Tin>").append(e(decl.getExporterTin())).append("</tancis:Tin>");
        xml.append("<tancis:Name>").append(e(decl.getExporterName())).append("</tancis:Name>");
        xml.append("</tancis:Exporter>");

        // Origin/Destination
        xml.append("<tancis:CountryOfOrigin>").append(e(decl.getCountryOfOrigin())).append("</tancis:CountryOfOrigin>");
        xml.append("<tancis:CountryOfExport>").append(e(decl.getCountryOfExport())).append("</tancis:CountryOfExport>");
        xml.append("<tancis:CountryOfDestination>").append(e(decl.getCountryOfDestination())).append("</tancis:CountryOfDestination>");

        // Transport
        xml.append("<tancis:TransportMode>").append(e(decl.getTransportMode())).append("</tancis:TransportMode>");
        xml.append("<tancis:VehicleRegistration>").append(e(decl.getVehicleRegistration())).append("</tancis:VehicleRegistration>");
        xml.append("<tancis:BorderCrossing>").append(e(decl.getBorderCrossing())).append("</tancis:BorderCrossing>");

        // Financials
        xml.append("<tancis:TotalCustomsValue>").append(decl.getTotalCustomsValue()).append("</tancis:TotalCustomsValue>");
        xml.append("<tancis:CurrencyCode>").append(e(decl.getCurrencyCode())).append("</tancis:CurrencyCode>");

        // Line items
        xml.append("<tancis:LineItems>");
        if (decl.getLineItems() != null) {
            for (var item : decl.getLineItems()) {
                xml.append("<tancis:LineItem>");
                xml.append("<tancis:LineNumber>").append(item.getLineNumber()).append("</tancis:LineNumber>");
                xml.append("<tancis:HSCode>").append(e(item.getHsCode())).append("</tancis:HSCode>");
                xml.append("<tancis:Description>").append(e(item.getGoodsDescription())).append("</tancis:Description>");
                xml.append("<tancis:Quantity>").append(item.getQuantity()).append("</tancis:Quantity>");
                xml.append("<tancis:UnitOfMeasure>").append(e(item.getUnitOfMeasure())).append("</tancis:UnitOfMeasure>");
                xml.append("<tancis:GrossWeightKg>").append(item.getGrossWeightKg()).append("</tancis:GrossWeightKg>");
                xml.append("<tancis:NetWeightKg>").append(item.getNetWeightKg()).append("</tancis:NetWeightKg>");
                xml.append("<tancis:ItemValue>").append(item.getItemValue()).append("</tancis:ItemValue>");
                xml.append("<tancis:Currency>").append(e(item.getCurrencyCode())).append("</tancis:Currency>");
                xml.append("</tancis:LineItem>");
            }
        }
        xml.append("</tancis:LineItems>");

        // External reference
        xml.append("<tancis:ShipmentReference>").append(e(decl.getShipmentTrackingNo())).append("</tancis:ShipmentReference>");

        xml.append("</tancis:DeclarationLodgeRequest>");

        exchange.getIn().setBody(xml.toString());
    }

    public void parseLodgeDeclarationResponse(Exchange exchange) throws Exception {
        var body = exchange.getIn().getBody(String.class);
        var doc = parseXml(body);

        var status = "REJECTED".equalsIgnoreCase(xpath(doc, "//Status")) ?
            DeclarationStatus.REJECTED : DeclarationStatus.SUBMITTED;

        var response = CustomsDeclaration.builder()
            .customsSystem("TANCIS")
            .declarationId(xpath(doc, "//DeclarationId"))
            .externalRef(xpath(doc, "//TancisReference"))
            .status(status)
            .rejectionReason(xpath(doc, "//RejectionReason"))
            .build();

        exchange.getIn().setBody(response);
    }

    public void parseAssessmentResponse(Exchange exchange) throws Exception {
        var body = exchange.getIn().getBody(String.class);
        var doc = parseXml(body);

        var builder = CustomsDeclaration.builder()
            .customsSystem("TANCIS")
            .declarationId(xpath(doc, "//DeclarationId"))
            .status(DeclarationStatus.ASSESSED)
            .dutyAmount(parseBigDecimal(xpath(doc, "//DutyAmount")))
            .vatAmount(parseBigDecimal(xpath(doc, "//VatAmount")))
            .exciseAmount(parseBigDecimal(xpath(doc, "//ExciseAmount")))
            .totalTaxAmount(parseBigDecimal(xpath(doc, "//TotalTaxAmount")));

        var channel = xpath(doc, "//AssessmentChannel");
        if (channel != null) {
            try { builder.assessmentChannel(AssessmentChannel.valueOf(channel)); }
            catch (IllegalArgumentException e) { /* keep null */ }
        }

        exchange.getIn().setBody(builder.build());
    }

    public void parseReleaseResponse(Exchange exchange) throws Exception {
        var body = exchange.getIn().getBody(String.class);
        var doc = parseXml(body);

        var response = CustomsStatusResponse.builder()
            .customsSystem("TANCIS")
            .declarationId(xpath(doc, "//DeclarationId"))
            .status("RELEASED".equalsIgnoreCase(xpath(doc, "//ReleaseStatus")) ? "CLEARED" : "PENDING")
            .releaseOrderNumber(xpath(doc, "//ReleaseOrderNumber"))
            .remarks(xpath(doc, "//Remarks"))
            .rawResponse(body)
            .build();

        exchange.getIn().setBody(response);
    }

    public void parseAssessmentNotice(Exchange exchange) throws Exception {
        var body = exchange.getIn().getBody(String.class);
        var doc = parseXml(body);

        var response = CustomsDeclaration.builder()
            .customsSystem("TANCIS")
            .declarationId(xpath(doc, "//DeclarationId"))
            .status(DeclarationStatus.ASSESSED)
            .dutyAmount(parseBigDecimal(xpath(doc, "//DutyAmount")))
            .vatAmount(parseBigDecimal(xpath(doc, "//VatAmount")))
            .totalTaxAmount(parseBigDecimal(xpath(doc, "//TotalTaxAmount")))
            .assessmentChannel(parseAssessmentChannel(xpath(doc, "//AssessmentChannel")))
            .build();

        exchange.getIn().setBody(response);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private String mapTancisType(CustomsDeclaration.DeclarationType type) {
        if (type == null) return "IM";
        return switch (type) {
            case IMPORT -> "IM";
            case EXPORT -> "EX";
            case TRANSIT -> "TR";
            case WAREHOUSE -> "WH";
            case TEMPORARY -> "TP";
        };
    }

    private AssessmentChannel parseAssessmentChannel(String channel) {
        if (channel == null) return null;
        try { return AssessmentChannel.valueOf(channel.toUpperCase()); }
        catch (IllegalArgumentException e) { return null; }
    }

    private BigDecimal parseBigDecimal(String s) {
        if (s == null || s.isBlank()) return null;
        try { return new BigDecimal(s); }
        catch (NumberFormatException e) { return null; }
    }

    private Document parseXml(String xml) throws Exception {
        var factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setNamespaceAware(true);
        return factory.newDocumentBuilder().parse(
            new org.xml.sax.InputSource(new java.io.StringReader(xml)));
    }

    private String xpath(Document doc, String expr) {
        try {
            var xp = javax.xml.xpath.XPathFactory.newInstance().newXPath();
            var node = (org.w3c.dom.Node) xp.compile(expr).evaluate(doc,
                javax.xml.xpath.XPathConstants.NODE);
            return node != null ? node.getTextContent().trim() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private String e(String s) { return s != null ? s : ""; }
}
