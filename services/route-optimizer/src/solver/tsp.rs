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
        if request.stops.is_empty() {
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

        // Build a lookup from stop_id to index for coordinate access during 2-opt
        let stop_lookup: HashMap<&str, &Location> = request
            .stops
            .iter()
            .map(|s| (s.id.as_str(), &s.location))
            .collect();

        // Nearest-neighbor construction
        let mut route: Vec<String> = vec![]; // stop_ids in order
        let mut current = Location {
            latitude: vehicle.start_location.latitude,
            longitude: vehicle.start_location.longitude,
            name: "depot".to_string(),
        };
        let mut total_dist = 0.0;
        let mut unvisited: Vec<&Stop> = request.stops.iter().collect();

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
            route.push(stop.id.clone());
            current = stop.location.clone();
        }

        // 2-opt improvement using actual stop coordinates
        let _ = apply_2opt(&mut route, &stop_lookup, &vehicle.start_location, total_dist);

        // Build RouteStop sequence (distances recalculated from optimised order)
        let start_ref: &Location = &vehicle.start_location;
        let mut sequence: Vec<RouteStop> = Vec::with_capacity(route.len());
        let mut prev = start_ref;
        let mut cumulative_dist = 0.0;
        for stop_id in &route {
            let loc = stop_lookup.get(stop_id.as_str()).copied().unwrap_or(start_ref);
            let d = haversine_km(prev, loc);
            cumulative_dist += d;
            sequence.push(RouteStop {
                stop_id: stop_id.clone(),
                arrival_time: Utc::now(),
                departure_time: Utc::now(),
                distance_from_prev_km: d,
            });
            prev = loc;
        }

        Ok(RouteSolution {
            request_id: request.request_id.clone(),
            routes: vec![VehicleRoute {
                vehicle_id: vehicle.id.clone(),
                stop_sequence: sequence,
                distance_km: cumulative_dist,
                duration_h: cumulative_dist / 60.0,
                load_kg: request.stops.iter().map(|s| s.demand_kg).sum(),
                cost: cumulative_dist * vehicle.cost_per_km,
            }],
            total_distance_km: cumulative_dist,
            total_cost: cumulative_dist * vehicle.cost_per_km,
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

fn apply_2opt(
    route: &mut [String],
    stop_lookup: &HashMap<&str, &Location>,
    depot: &Location,
    current_dist: f64,
) -> f64 {
    let n = route.len();
    if n < 3 {
        return current_dist;
    }

    fn get_loc<'a>(
        route: &[String],
        idx: usize,
        lookup: &HashMap<&str, &'a Location>,
        depot: &'a Location,
    ) -> &'a Location {
        route.get(idx).and_then(|id| lookup.get(id.as_str())).copied().unwrap_or(depot)
    }

    let mut improved = true;
    let mut best_dist = current_dist;

    while improved {
        improved = false;
        for i in 0..n - 1 {
            for j in i + 2..n {
                let a = if i == 0 { depot } else { get_loc(route, i - 1, stop_lookup, depot) };
                let b = get_loc(route, i, stop_lookup, depot);
                let c = get_loc(route, j - 1, stop_lookup, depot);
                let d = get_loc(route, j, stop_lookup, depot);

                let old_dist = haversine_km(a, b) + haversine_km(c, d);
                let new_dist = haversine_km(a, c) + haversine_km(b, d);

                if new_dist < old_dist - 0.001 {
                    route[i..j].reverse();
                    best_dist = best_dist - old_dist + new_dist;
                    improved = true;
                }
            }
        }
    }

    best_dist
}
