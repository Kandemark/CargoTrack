package com.cargotrack.edi.processor;

import com.cargotrack.edi.model.CustomsDeclaration;
import com.cargotrack.edi.model.CustomsDeclaration.AssessmentChannel;
import com.cargotrack.edi.model.CustomsDeclaration.DeclarationStatus;
import com.cargotrack.edi.model.CustomsStatusResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.camel.Exchange;
import org.springframework.stereotype.Component;

/**
 * Parses TradeNet SOAP XML responses into the internal canonical model.
 *
 * Handles three response types:
 *   1. SubmitDeclarationResponse  — declaration acknowledgment with ID
 *   2. QueryDeclarationStatusResponse — current status in the clearance pipeline
 *   3. ClearanceNotification — async callback when clearance/release is granted
 */
@Component
public class TradeNetResponseParser {

    private final ObjectMapper mapper = new ObjectMapper();

    public void parseSubmitResponse(Exchange exchange) throws Exception {
        var body = exchange.getIn().getBody(String.class);
        var response = CustomsDeclaration.builder()
            .customsSystem("TRADENET")
            .status(DeclarationStatus.SUBMITTED);

        // Extract declaration ID from SOAP response
        var doc = parseXml(body);
        var declId = xpath(doc, "//DeclarationId");
        response.declarationId(declId);

        var status = xpath(doc, "//Status");
        if ("REJECTED".equalsIgnoreCase(status)) {
            response.status(DeclarationStatus.REJECTED);
            response.rejectionReason(xpath(doc, "//Reason"));
        }

        var channel = xpath(doc, "//AssessmentChannel");
        if (channel != null) {
            try { response.assessmentChannel(AssessmentChannel.valueOf(channel)); }
            catch (IllegalArgumentException e) { /* keep null */ }
        }

        exchange.getIn().setBody(response.build());
    }

    public void parseStatusResponse(Exchange exchange) throws Exception {
        var body = exchange.getIn().getBody(String.class);
        var doc = parseXml(body);

        var response = CustomsStatusResponse.builder()
            .customsSystem("TRADENET")
            .declarationId(xpath(doc, "//DeclarationId"))
            .status(xpath(doc, "//Status"))
            .assessmentChannel(xpath(doc, "//AssessmentChannel"))
            .customsOfficer(xpath(doc, "//OfficerName"))
            .releaseOrderNumber(xpath(doc, "//ReleaseOrderNumber"))
            .remarks(xpath(doc, "//Remarks"))
            .rawResponse(body)
            .build();

        exchange.getIn().setBody(response);
    }

    public void parseClearanceNotification(Exchange exchange) throws Exception {
        var body = exchange.getIn().getBody(String.class);
        var doc = parseXml(body);

        var response = CustomsStatusResponse.builder()
            .customsSystem("TRADENET")
            .declarationId(xpath(doc, "//DeclarationId"))
            .status("CLEARED")
            .releaseOrderNumber(xpath(doc, "//ReleaseOrderNumber"))
            .remarks("Clearance granted via TradeNet callback")
            .rawResponse(body)
            .build();

        exchange.getIn().setBody(response);
    }

    private org.w3c.dom.Document parseXml(String xml) throws Exception {
        var factory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        var builder = factory.newDocumentBuilder();
        var source = new org.xml.sax.InputSource(new java.io.StringReader(xml));
        return builder.parse(source);
    }

    private String xpath(org.w3c.dom.Document doc, String expr) {
        try {
            var xp = javax.xml.xpath.XPathFactory.newInstance().newXPath();
            var node = (org.w3c.dom.Node) xp.compile(expr).evaluate(doc,
                javax.xml.xpath.XPathConstants.NODE);
            return node != null ? node.getTextContent().trim() : null;
        } catch (Exception e) {
            return null;
        }
    }
}
