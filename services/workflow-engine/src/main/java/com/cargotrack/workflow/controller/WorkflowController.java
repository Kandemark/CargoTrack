package com.cargotrack.workflow.controller;

import com.cargotrack.workflow.service.ShipmentWorkflowService;
import org.camunda.bpm.engine.HistoryService;
import org.camunda.bpm.engine.RuntimeService;
import org.camunda.bpm.engine.TaskService;
import org.camunda.bpm.engine.history.HistoricProcessInstance;
import org.camunda.bpm.engine.task.Task;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/workflows")
public class WorkflowController {

    private final ShipmentWorkflowService workflowService;
    private final RuntimeService runtimeService;
    private final TaskService taskService;
    private final HistoryService historyService;

    public WorkflowController(
            ShipmentWorkflowService workflowService,
            RuntimeService runtimeService,
            TaskService taskService,
            HistoryService historyService
    ) {
        this.workflowService = workflowService;
        this.runtimeService = runtimeService;
        this.taskService = taskService;
        this.historyService = historyService;
    }

    /**
     * Start a shipment lifecycle.
     * POST /api/workflows/shipments
     */
    @PostMapping("/shipments")
    public ResponseEntity<Map<String, Object>> startShipment(@RequestBody Map<String, Object> request) {
        String shipmentId = (String) request.get("shipment_id");
        @SuppressWarnings("unchecked")
        Map<String, Object> variables = (Map<String, Object>) request.getOrDefault("variables", new HashMap<>());

        String instanceId = workflowService.startShipment(shipmentId, variables);

        Map<String, Object> response = new HashMap<>();
        response.put("process_instance_id", instanceId);
        response.put("shipment_id", shipmentId);
        response.put("status", "CREATED");
        return ResponseEntity.ok(response);
    }

    /**
     * Get all active shipment workflow instances.
     * GET /api/workflows/shipments
     */
    @GetMapping("/shipments")
    public ResponseEntity<List<Map<String, Object>>> getActiveShipments() {
        var instances = runtimeService.createProcessInstanceQuery()
                .processDefinitionKey("ShipmentLifecycle")
                .active()
                .list();

        List<Map<String, Object>> result = instances.stream().map(pi -> {
            Map<String, Object> m = new HashMap<>();
            m.put("process_instance_id", pi.getId());
            m.put("business_key", pi.getBusinessKey());
            m.put("variables", runtimeService.getVariables(pi.getId()));
            return m;
        }).toList();

        return ResponseEntity.ok(result);
    }

    /**
     * Get active user tasks (documents to verify, approvals needed).
     * GET /api/workflows/tasks
     */
    @GetMapping("/tasks")
    public ResponseEntity<List<Map<String, Object>>> getTasks() {
        List<Task> tasks = taskService.createTaskQuery().active().list();

        List<Map<String, Object>> result = tasks.stream().map(t -> {
            Map<String, Object> m = new HashMap<>();
            m.put("task_id", t.getId());
            m.put("name", t.getName());
            m.put("process_instance_id", t.getProcessInstanceId());
            m.put("assignee", t.getAssignee());
            m.put("created", t.getCreateTime().toString());
            return m;
        }).toList();

        return ResponseEntity.ok(result);
    }

    /**
     * Complete a user task (e.g., verify documents, approve carrier).
     * POST /api/workflows/tasks/{taskId}/complete
     */
    @PostMapping("/tasks/{taskId}/complete")
    public ResponseEntity<Map<String, String>> completeTask(
            @PathVariable String taskId,
            @RequestBody Map<String, Object> variables
    ) {
        taskService.complete(taskId, variables);
        return ResponseEntity.ok(Map.of("status", "completed", "task_id", taskId));
    }

    /**
     * Get shipment workflow history.
     * GET /api/workflows/shipments/{shipmentId}/history
     */
    @GetMapping("/shipments/{shipmentId}/history")
    public ResponseEntity<List<Map<String, Object>>> getHistory(@PathVariable String shipmentId) {
        List<HistoricProcessInstance> instances = historyService
                .createHistoricProcessInstanceQuery()
                .processInstanceBusinessKey("shipment:" + shipmentId)
                .list();

        List<Map<String, Object>> result = instances.stream().map(pi -> {
            Map<String, Object> m = new HashMap<>();
            m.put("process_instance_id", pi.getId());
            m.put("start_time", pi.getStartTime().toString());
            m.put("end_time", pi.getEndTime() != null ? pi.getEndTime().toString() : null);
            m.put("state", pi.getState());
            return m;
        }).toList();

        return ResponseEntity.ok(result);
    }

    /**
     * Evaluate customs risk.
     * POST /api/workflows/customs-risk
     */
    @PostMapping("/customs-risk")
    public ResponseEntity<Map<String, Object>> evaluateCustomsRisk(@RequestBody Map<String, Object> request) {
        String shipmentId = (String) request.get("shipment_id");
        @SuppressWarnings("unchecked")
        Map<String, Object> input = (Map<String, Object>) request.getOrDefault("input", new HashMap<>());

        Map<String, Object> result = workflowService.evaluateCustomsRisk(shipmentId, input);
        return ResponseEntity.ok(result);
    }
}
