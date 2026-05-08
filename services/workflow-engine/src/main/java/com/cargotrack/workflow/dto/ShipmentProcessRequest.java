package com.cargotrack.workflow.dto;

import java.util.Map;

public record ShipmentProcessRequest(
        String shipmentId,
        String origin,
        String destination,
        String cargoType,
        double declaredValueUsd,
        String carrierId,
        String shipperId,
        Map<String, Object> variables
) {}
