package com.cargotrack.edi.processor;

import com.cargotrack.edi.model.CustomsDeclaration;
import com.cargotrack.edi.model.CustomsDeclaration.DeclarationLineItem;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import javax.xml.parsers.DocumentBuilderFactory;
import java.time.format.DateTimeFormatter;

/**
 * Builds TradeNet SOAP XML request envelopes for customs declaration
 * submission and status queries.
 *
 * TradeNet uses a SOAP 1.1 envelope with a gov.revenue.customs schema.
 * The request is signed with the trader's digital certificate (handled
 * at the HTTP layer via mutual TLS).
 */
@Component
public class TradeNetRequestBuilder {

    private static final DateTimeFormatter DT_FMT =
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    public void buildSubmitRequest(Exchange exchange) throws Exception {
        var decl = exchange.getIn().getBody(CustomsDeclaration.class);
        var doc = DocumentBuilderFactory.newInstance()
            .newDocumentBuilder().newDocument();

        // SOAP envelope
        var envelope = doc.createElementNS(
            "http://schemas.xmlsoap.org/soap/envelope/", "soap:Envelope");
        doc.appendChild(envelope);

        var body = doc.createElement("soap:Body");
        envelope.appendChild(body);

        var submit = doc.createElementNS(
            "http://gov.ke.kentrade/tradenet/declaration", "td:SubmitDeclaration");
        body.appendChild(submit);

        // Declaration header
        addElement(doc, submit, "td:DeclarationType",
            decl.getType() != null ? decl.getType().name() : "IMPORT");
        addElement(doc, submit, "td:CustomsOffice", decl.getCustomsOffice());
        addElement(doc, submit, "td:RegimeCode", decl.getRegimeCode());
        addElement(doc, submit, "td:DeclarantTin", decl.getDeclarantTin());
        addElement(doc, submit, "td:ImporterTin", decl.getImporterTin());
        addElement(doc, submit, "td:ImporterName", decl.getImporterName());
        addElement(doc, submit, "td:ExporterTin", decl.getExporterTin());
        addElement(doc, submit, "td:ExporterName", decl.getExporterName());
        addElement(doc, submit, "td:CountryOfOrigin", decl.getCountryOfOrigin());
        addElement(doc, submit, "td:CountryOfExport", decl.getCountryOfExport());
        addElement(doc, submit, "td:CountryOfDest", decl.getCountryOfDestination());
        addElement(doc, submit, "td:TransportMode", decl.getTransportMode());
        addElement(doc, submit, "td:VehicleReg", decl.getVehicleRegistration());
        addElement(doc, submit, "td:BorderCrossing", decl.getBorderCrossing());
        addElement(doc, submit, "td:ShipmentRef", decl.getShipmentTrackingNo());
        addElement(doc, submit, "td:TotalCustomsValue",
            decl.getTotalCustomsValue() != null ? decl.getTotalCustomsValue().toPlainString() : "0");
        addElement(doc, submit, "td:CurrencyCode", decl.getCurrencyCode());

        // Line items
        var items = doc.createElement("td:LineItems");
        submit.appendChild(items);
        if (decl.getLineItems() != null) {
            for (var item : decl.getLineItems()) {
                var li = doc.createElement("td:LineItem");
                addElement(doc, li, "td:LineNumber", String.valueOf(item.getLineNumber()));
                addElement(doc, li, "td:HSCode", item.getHsCode());
                addElement(doc, li, "td:GoodsDescription", item.getGoodsDescription());
                addElement(doc, li, "td:Quantity", item.getQuantity() != null ? item.getQuantity().toPlainString() : "1");
                addElement(doc, li, "td:UOM", item.getUnitOfMeasure());
                addElement(doc, li, "td:GrossWeightKg", item.getGrossWeightKg() != null ? item.getGrossWeightKg().toPlainString() : "0");
                addElement(doc, li, "td:NetWeightKg", item.getNetWeightKg() != null ? item.getNetWeightKg().toPlainString() : "0");
                addElement(doc, li, "td:ItemValue", item.getItemValue() != null ? item.getItemValue().toPlainString() : "0");
                addElement(doc, li, "td:Currency", item.getCurrencyCode());
                items.appendChild(li);
            }
        }

        var tf = javax.xml.transform.TransformerFactory.newInstance();
        var transformer = tf.newTransformer();
        var source = new javax.xml.transform.dom.DOMSource(doc);
        var writer = new java.io.StringWriter();
        transformer.transform(source, new javax.xml.transform.stream.StreamResult(writer));
        exchange.getIn().setBody(writer.toString());
    }

    public void buildStatusQuery(Exchange exchange) {
        var declarationId = exchange.getIn().getHeader("declarationId", String.class);
        var xml = String.format(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
            "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">" +
            "<soap:Body>" +
            "<td:QueryDeclarationStatus xmlns:td=\"http://gov.ke.kentrade/tradenet/declaration\">" +
            "<td:DeclarationId>%s</td:DeclarationId>" +
            "</td:QueryDeclarationStatus>" +
            "</soap:Body>" +
            "</soap:Envelope>", declarationId);
        exchange.getIn().setBody(xml);
    }

    private void addElement(Document doc, Element parent, String name, String value) {
        if (value == null) return;
        var el = doc.createElement(name);
        el.setTextContent(value);
        parent.appendChild(el);
    }
}
