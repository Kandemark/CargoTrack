package com.cargotrack.workflow;

import org.camunda.bpm.engine.ProcessEngine;
import org.camunda.bpm.engine.RuntimeService;
import org.camunda.bpm.engine.runtime.ProcessInstance;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest
class WorkflowEngineApplicationTests {

    @Autowired
    private RuntimeService runtimeService;

    @Autowired
    private ProcessEngine processEngine;

    @MockBean
    private KafkaTemplate<String, String> kafkaTemplate;

    @BeforeEach
    void setUp() {
        when(kafkaTemplate.send(anyString(), anyString(), anyString()))
                .thenReturn(new CompletableFuture<>());
    }

    @Test
    void contextLoads() {
        assertThat(processEngine).isNotNull();
    }

    @Test
    void shouldDeployShipmentLifecycleProcess() {
        long count = processEngine.getRepositoryService()
                .createProcessDefinitionQuery()
                .processDefinitionKey("shipment-lifecycle")
                .count();
        assertThat(count).isGreaterThan(0);
    }

    @Test
    void shouldStartShipmentWorkflow() {
        Map<String, Object> vars = new HashMap<>();
        vars.put("shipmentId", "TEST-SHP-001");
        vars.put("origin", "Mombasa");
        vars.put("destination", "Nairobi");
        vars.put("cargoType", "Container");
        vars.put("declaredValueUsd", 25000.0);
        vars.put("carrierId", "CARRIER-01");
        vars.put("shipperId", "SHIPPER-01");

        ProcessInstance instance = runtimeService
                .startProcessInstanceByKey("shipment-lifecycle", "TEST-SHP-001", vars);

        assertThat(instance).isNotNull();
        assertThat(instance.getBusinessKey()).isEqualTo("TEST-SHP-001");
    }
}