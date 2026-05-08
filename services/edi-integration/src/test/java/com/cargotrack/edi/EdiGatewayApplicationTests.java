package com.cargotrack.edi;

import org.apache.camel.CamelContext;
import org.apache.camel.ProducerTemplate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class EdiGatewayApplicationTests {

    @Autowired
    private CamelContext camelContext;

    @Autowired
    private ProducerTemplate producerTemplate;

    @Test
    void contextLoads() {
        assertThat(camelContext).isNotNull();
        assertThat(camelContext.getName()).isNotEmpty();
    }

    @Test
    void shouldHaveRequiredRoutes() {
        assertThat(camelContext.getRoute("as2-inbound-receiver")).isNotNull();
        assertThat(camelContext.getRoute("process-edifact")).isNotNull();
        assertThat(camelContext.getRoute("process-x12")).isNotNull();
    }

    @Test
    void shouldProcessEdifactMessage() {
        String edifactPayload = "UNB+UNOA:2+SENDER+RECEIVER+20260508:1230+12345678++CARGO'\n"
                + "UNH+1+IFTMIN:D:01B:UN'\n"
                + "BGM+335+SHP-001+9'\n"
                + "DTM+137:20260508:102'\n"
                + "UNT+4+1'\n"
                + "UNZ+1+12345678'";

        String result = producerTemplate.requestBody("direct:process-edifact", edifactPayload, String.class);
        assertThat(result).isNotNull();
        assertThat(result).contains("parsed");
    }

    @Test
    void shouldRouteX12Message() {
        String x12Payload = "ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *20260508*1230*U*00401*000000001*0*P*>~"
                + "GS*QM*SENDER*RECEIVER*20260508*1230*1*X*004010~"
                + "ST*214*0001~B10*SHP-001*SHIPMENT*20260508~SE*4*0001~GE*1*1~IEA*1*000000001~";

        String result = producerTemplate.requestBody("direct:process-x12", x12Payload, String.class);
        assertThat(result).isNotNull();
        assertThat(result).contains("ANSI_X12");
    }
}