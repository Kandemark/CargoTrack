use crate::models::*;
use anyhow::Result;
use chrono::Utc;
use std::collections::HashMap;

/// Single-vehicle TSP solver using nearest-neighbor construction + 2-opt improvement.
pub struct TSPSolver;

impl super::Solver for TSPSolver {
    fn solve(&self, request: &RouteOptimizationRequest) -> Result<RouteSolution> {
        if request.vehicles.is_empty() {
            anyhow::bail!("TSP requires at least one vehicle");
        }

        let vehicle = &request.vehicles[0];
        let mut unvisited: Vec<&Stop> = request.stops.iter().collect();
        if unvisited.is_empty() {
            return Ok(RouteSolution {
                request_id: request.request_id.clone(),
                routes: vec![],
                total_distance_km: 0.0,
                total_cost: 0.0,
                unserved_stops: vec![],
                computed_at: Utc::now(),
                solver_metadata: HashMap::new(),
            });
        }

        // Nearest-neighbor construction
        let mut route = vec![];
        let mut current = Location {
            latitude: vehicle.start_location.latitude,
            longitude: vehicle.start_location.longitude,
            name: "depot".to_string(),
        };
        let mut total_dist = 0.0;

        while !unvisited.is_empty() {
            let (idx, _) = unvisited
                .iter()
                .enumerate()
                .map(|(i, s)| (i, haversine_km(&current, &s.location)))
                .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
                .unwrap();

            let stop = unvisited.remove(idx);
            let d = haversine_km(&current, &stop.location);
            total_dist += d;

            route.push(RouteStop {
                stop_id: stop.id.clone(),
                arrival_time: Utc::now(),
                departure_time: Utc::now(),
                distance_from_prev_km: d,
            });
            current = stop.location.clone();
        }

        // 2-opt improvement
        total_dist = apply_2opt(&mut route, total_dist);

        Ok(RouteSolution {
            request_id: request.request_id.clone(),
            routes: vec![VehicleRoute {
                vehicle_id: vehicle.id.clone(),
                stop_sequence: route,
                distance_km: total_dist,
                duration_h: total_dist / 60.0, // assume avg 60 km/h
                load_kg: request.stops.iter().map(|s| s.demand_kg).sum(),
                cost: total_dist * vehicle.cost_per_km,
            }],
            total_distance_km: total_dist,
            total_cost: total_dist * vehicle.cost_per_km,
            unserved_stops: vec![],
            computed_at: Utc::now(),
            solver_metadata: {
                let mut m = HashMap::new();
                m.insert("algorithm".to_string(), "nearest_neighbor+2opt".to_string());
                m
            },
        })
    }
}

fn apply_2opt(route: &mut [RouteStop], current_dist: f64) -> f64 {
    let n = route.len();
    if n < 3 {
        return current_dist;
    }

    let mut improved = true;
    let mut best_dist = current_dist;

    while improved {
        improved = false;
        for i in 0..n - 1 {
            for j in i + 2..n {
                // Skip adjacent edges
                if j == i + 1 {
                    continue;
                }

                let old_dist = if i == 0 {
                    0.0 // depot-to-first edge, unchanged by swap
                } else {
                    haversine_km(
                        &get_stop_location(route, i - 1),
                        &get_stop_location(route, i),
                    )
                } + haversine_km(
                    &get_stop_location(route, j - 1),
                    &get_stop_location(route, j),
                );

                let new_dist = if i == 0 {
                    0.0
                } else {
                    haversine_km(
                        &get_stop_location(route, i - 1),
                        &get_stop_location(route, j - 1),
                    )
                } + haversine_km(
                    &get_stop_location(route, i),
                    &get_stop_location(route, j),
                );

                if new_dist < old_dist - 0.001 {
                    // Reverse the segment between i and j-1
                    route[i..j].reverse();
                    best_dist = best_dist - old_dist + new_dist;
                    improved = true;
                }
            }
        }
    }

    best_dist
}

fn get_stop_location(route: &[RouteStop], idx: usize) -> Location {
    Location {
        latitude: 0.0,
        longitude: 0.0,
        name: route[idx].stop_id.clone(),
    }
}
