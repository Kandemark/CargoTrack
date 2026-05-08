// gRPC server — tonic endpoint for CargoTrack route optimization.
// Listens on GRPC_PORT (default 50051). Health probe on /ready and /health.
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tonic::{Request, Response, Status};
use tracing::{info, warn};

use crate::cache::lru::hash_request;
use crate::cache::SolutionCache;
use crate::models::{self, RouteSolution, VehicleRoute, RouteStop};
use crate::solver::mvrp::MVRPSolver;
use crate::solver::tsp::TSPSolver;
use crate::solver::Solver;

pub mod proto {
    tonic::include_proto!("cargotrack.route_optimizer.v1");
}

use proto::{
    route_optimizer_server::{RouteOptimizer, RouteOptimizerServer},
    HealthRequest, HealthResponse, OptimizeRequest, OptimizeResponse,
};

pub struct OptimizerService {
    cache: Arc<Mutex<SolutionCache>>,
    version: String,
}

impl OptimizerService {
    pub fn new(cache: SolutionCache) -> Self {
        Self {
            cache: Arc::new(Mutex::new(cache)),
            version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }

    pub fn into_server(self) -> RouteOptimizerServer<Self> {
        RouteOptimizerServer::new(self)
    }
}

#[tonic::async_trait]
impl RouteOptimizer for OptimizerService {
    async fn health(
        &self,
        _request: Request<HealthRequest>,
    ) -> Result<Response<HealthResponse>, Status> {
        let cache_size = self.cache.lock().await.len();
        Ok(Response::new(HealthResponse {
            healthy: true,
            version: self.version.clone(),
            cache_size: cache_size as u32,
        }))
    }

    async fn optimize(
        &self,
        request: Request<OptimizeRequest>,
    ) -> Result<Response<OptimizeResponse>, Status> {
        let req = request.into_inner();
        let request_json = serde_json::to_string(&req)
            .map_err(|e| Status::internal(format!("serialization: {e}")))?;

        let model_request = proto_to_model(&req);
        let request_hash = hash_request(&request_json);

        // Check cache
        {
            let cache = self.cache.lock().await;
            if let Some(cached) = cache.get(&request_hash) {
                info!("Cache hit for {}", req.request_id);
                return Ok(Response::new(model_to_proto(&cached)));
            }
        }

        let solution: RouteSolution = if model_request.vehicles.len() == 1 {
            info!(
                "TSP solver on {} ({} stops)",
                req.request_id,
                req.stops.len()
            );
            TSPSolver
                .solve(&model_request)
                .map_err(|e| Status::internal(format!("TSP: {e}")))?
        } else {
            info!(
                "MVRP solver on {} ({} stops, {} vehicles)",
                req.request_id,
                req.stops.len(),
                req.vehicles.len()
            );
            MVRPSolver
                .solve(&model_request)
                .map_err(|e| Status::internal(format!("MVRP: {e}")))?
        };

        // Cache and respond
        {
            let mut cache = self.cache.lock().await;
            cache.put(request_hash, solution.clone());
        }

        info!(
            "Solved {}: {:.2} km, {:.2} cost, {} routes, {} unserved",
            req.request_id,
            solution.total_distance_km,
            solution.total_cost,
            solution.routes.len(),
            solution.unserved_stops.len()
        );

        Ok(Response::new(model_to_proto(&solution)))
    }
}

// ── Conversion helpers ─────────────────────────────────────────────────────

fn proto_to_model(req: &OptimizeRequest) -> models::RouteOptimizationRequest {
    use chrono::DateTime;
    models::RouteOptimizationRequest {
        request_id: req.request_id.clone(),
        depot: models::Location {
            latitude: req.depot.as_ref().map(|p| p.latitude).unwrap_or(0.0),
            longitude: req.depot.as_ref().map(|p| p.longitude).unwrap_or(0.0),
            name: req.depot.as_ref().map(|p| p.name.clone()).unwrap_or_default(),
        },
        stops: req.stops.iter().map(|s| models::Stop {
            id: s.id.clone(),
            location: models::Location {
                latitude: s.location.as_ref().map(|p| p.latitude).unwrap_or(0.0),
                longitude: s.location.as_ref().map(|p| p.longitude).unwrap_or(0.0),
                name: s.location.as_ref().map(|p| p.name.clone()).unwrap_or_default(),
            },
            time_window: s.time_window.as_ref().map(|tw| models::TimeWindow {
                earliest: tw.earliest.parse().unwrap_or_default(),
                latest: tw.latest.parse().unwrap_or_default(),
            }),
            service_time_min: s.service_time_min,
            demand_kg: s.demand_kg,
            shipment_id: s.shipment_id.clone(),
        }).collect(),
        vehicles: req.vehicles.iter().map(|v| models::Vehicle {
            id: v.id.clone(),
            start_location: models::Location {
                latitude: v.start_location.as_ref().map(|p| p.latitude).unwrap_or(0.0),
                longitude: v.start_location.as_ref().map(|p| p.longitude).unwrap_or(0.0),
                name: v.start_location.as_ref().map(|p| p.name.clone()).unwrap_or_default(),
            },
            end_location: v.end_location.as_ref().map(|p| models::Location {
                latitude: p.latitude,
                longitude: p.longitude,
                name: p.name.clone(),
            }),
            capacity_kg: v.capacity_kg,
            available_from: v.available_from.as_ref().and_then(|s| s.parse().ok()),
            available_until: v.available_until.as_ref().and_then(|s| s.parse().ok()),
            cost_per_km: v.cost_per_km,
        }).collect(),
        max_distance_km: req.max_distance_km,
        max_duration_h: req.max_duration_h,
    }
}

fn model_to_proto(solution: &RouteSolution) -> OptimizeResponse {
    OptimizeResponse {
        request_id: solution.request_id.clone(),
        routes: solution.routes.iter().map(|r| proto::VehicleRoute {
            vehicle_id: r.vehicle_id.clone(),
            stop_sequence: r.stop_sequence.iter().map(|s| proto::RouteStop {
                stop_id: s.stop_id.clone(),
                arrival_time: s.arrival_time.to_rfc3339(),
                departure_time: s.departure_time.to_rfc3339(),
                distance_from_prev_km: s.distance_from_prev_km,
            }).collect(),
            distance_km: r.distance_km,
            duration_h: r.duration_h,
            load_kg: r.load_kg,
            cost: r.cost,
        }).collect(),
        total_distance_km: solution.total_distance_km,
        total_cost: solution.total_cost,
        unserved_stops: solution.unserved_stops.clone(),
        computed_at: solution.computed_at.to_rfc3339(),
        solver_metadata: solution.solver_metadata.clone(),
    }
}
