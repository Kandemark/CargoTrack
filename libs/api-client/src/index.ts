/**
 * @cargotrack/api-client
 *
 * Typed API client for the CargoTrack logistics backbone.
 * Combines the base client factory from @cargotrack/shared-types with
 * prediction, WebSocket, and convenience methods for all domain APIs.
 *
 * @example
 * ```ts
 * import { createCargoTrackClient } from "@cargotrack/api-client";
 *
 * const api = createCargoTrackClient({
 *   baseURL: "https://api.cargotrack.io",
 *   getAccessToken: () => localStorage.getItem("access_token"),
 *   onUnauthorized: () => router.push("/login"),
 * });
 *
 * // REST
 * const { data } = await api.shipments.list({ status: "IN_TRANSIT" });
 *
 * // ML predictions
 * const risk = await api.predictions.delay({
 *   corridor: "Mombasa-Nairobi",
 *   weight_tonnes: 24,
 * });
 *
 * // Real-time
 * const ws = api.ws.create();
 * ws.on("shipment:state_changed", (msg) => console.log(msg));
 * ```
 */

// Re-export everything from the shared types package
export {
  createApiClient,
  createAuthApi,
  createShipmentsApi,
  createDashboardApi,
} from "@cargotrack/shared-types/api";
export type {
  ApiClientConfig,
  User,
  TokenPair,
  Route,
  Shipment,
  ShipmentListItem,
  ShipmentStatus,
  TrackEvent,
  TrackingEvent,
  DelayPrediction,
  AlertSeverity,
  Alert,
  DashboardSummary,
  CarrierPerformance,
  DashboardResponse,
  PaginatedResponse,
} from "@cargotrack/shared-types/api";

// ML Predictions
export {
  createPredictionsApi,
} from "./predictions";
export type {
  DelayPredictionRequest,
  DelayPredictionResponse,
  DemandForecastRequest,
  DemandForecastResponse,
  PricingRequest,
  PricingResponse,
  TheftRiskRequest,
  TheftRiskResponse,
  DriverScoreRequest,
  DriverScoreResponse,
  BorderDelayRequest,
  BorderDelayResponse,
  FuelOptimizeRequest,
  FuelOptimizeResponse,
  ContainerMatchRequest,
  ContainerMatchResponse,
  ShipmentPredictionResponse,
  PredictionsApi,
} from "./predictions";

// WebSocket real-time client
export {
  CargoTrackWebSocket,
  createCargoTrackWs,
} from "./ws";
export type {
  WsEvent,
  WsMessage,
  WsClientOptions,
} from "./ws";

// ── Convenience: all-in-one client factory ─────────────────────────────────

import type { AxiosInstance } from "axios";
import {
  createApiClient,
  createAuthApi,
  createShipmentsApi,
  createDashboardApi,
} from "@cargotrack/shared-types/api";
import type { ApiClientConfig } from "@cargotrack/shared-types/api";
import { createPredictionsApi } from "./predictions";
import type { PredictionsApi } from "./predictions";
import { createCargoTrackWs } from "./ws";
import type { WsClientOptions } from "./ws";

export interface CargoTrackClient {
  /** Raw axios instance — use for custom requests. */
  axios: AxiosInstance;
  /** Auth: login, register, refresh, logout. */
  auth: ReturnType<typeof createAuthApi>;
  /** Shipments: CRUD, tracking events, status transitions. */
  shipments: ReturnType<typeof createShipmentsApi>;
  /** Dashboard: KPIs, carrier performance, summary cards. */
  dashboard: ReturnType<typeof createDashboardApi>;
  /** ML predictions: delay, demand, pricing, theft, driver, border, fuel, containers. */
  predictions: PredictionsApi;
  /** WebSocket factory for real-time events. */
  ws: {
    /** Create a new WebSocket connection. Call .connect() to start. */
    create: (opts?: Partial<WsClientOptions>) => ReturnType<typeof createCargoTrackWs>;
  };
}

export function createCargoTrackClient(config: ApiClientConfig): CargoTrackClient {
  const axios = createApiClient(config);

  return {
    axios,
    auth: createAuthApi(axios),
    shipments: createShipmentsApi(axios),
    dashboard: createDashboardApi(axios),
    predictions: createPredictionsApi(axios),
    ws: {
      create: (opts) => createCargoTrackWs({
        url: opts?.url ?? config.baseURL.replace(/^http/, "ws") + "/ws",
        token: opts?.token ?? (() => {
          // Best-effort token extraction from the configured getter
          const t = config.getAccessToken?.();
          return t instanceof Promise ? null : (t ?? null);
        }),
        ...opts,
      }),
    },
  };
}
