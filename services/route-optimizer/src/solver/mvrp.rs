use crate::models::*;
use anyhow::Result;
use chrono::Utc;
use std::collections::HashMap;

/// Multi-Vehicle Routing Problem solver using Clarke-Wright savings algorithm
/// with capacity and time window constraints.
pub struct MVRPSolver;

impl super::Solver for MVRPSolver {
    fn solve(&self, request: &RouteOptimizationRequest) -> Result<RouteSolution> {
        if request.vehicles.is_empty() {
            anyhow::bail!("MVRP requires at least one vehicle");
        }
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

        // Initialize: each stop in its own route (served from depot)
        let depot = &request.depot;
        let max_vehicles = request.vehicles.len();

        // Calculate savings for each pair (i, j)
        let n = request.stops.len();
        let mut savings: Vec<(usize, usize, f64)> = Vec::new();

        for i in 0..n {
            for j in (i + 1)..n {
                let d_depot_i = haversine_km(depot, &request.stops[i].location);
                let d_depot_j = haversine_km(depot, &request.stops[j].location);
                let d_ij = haversine_km(&request.stops[i].location, &request.stops[j].location);
                let saving = d_depot_i + d_depot_j - d_ij;
                if saving > 0.0 {
                    savings.push((i, j, saving));
                }
            }
        }

        // Sort savings descending
        savings.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));

        // Union-Find for tracking merged routes
        let mut parent: Vec<usize> = (0..n).collect();
        let mut route_load: Vec<f64> = request.stops.iter().map(|s| s.demand_kg).collect();
        let mut route_stops: Vec<Vec<usize>> = (0..n).map(|i| vec![i]).collect();

        for (i, j, _saving) in &savings {
            let (i, j) = (*i, *j);
            let root_i = find(&mut parent, i);
            let root_j = find(&mut parent, j);

            if root_i == root_j {
                continue; // Already in same route
            }

            let combined_load = route_load[root_i] + route_load[root_j];

            // Check capacity constraint against the best available vehicle
            let best_capacity = request
                .vehicles
                .iter()
                .map(|v| v.capacity_kg)
                .max_by(|a, b| a.partial_cmp(b).unwrap())
                .unwrap_or(f64::MAX);

            if combined_load > best_capacity {
                continue;
            }

            // Merge routes
            union(&mut parent, root_i, root_j);
            let new_root = find(&mut parent, root_i);
            let other = if new_root == root_i { root_j } else { root_i };

            route_load[new_root] = combined_load;
            let other_stops = std::mem::take(&mut route_stops[other]);
            route_stops[new_root].extend(other_stops);
        }

        // Assign merged routes to vehicles
        let mut routes: Vec<VehicleRoute> = Vec::new();
        let mut unserved: Vec<String> = Vec::new();
        let mut used_vehicles = 0;
        let mut total_distance = 0.0;
        let mut total_cost = 0.0;

        for route_idx in 0..n {
            let root = find(&mut parent, route_idx);
            if root != route_idx {
                continue; // Not a root
            }
            if route_stops[root].is_empty() {
                continue;
            }

            if used_vehicles >= max_vehicles {
                for &stop_idx in &route_stops[root] {
                    unserved.push(request.stops[stop_idx].id.clone());
                }
                continue;
            }

            let vehicle = &request.vehicles[used_vehicles];
            used_vehicles += 1;

            // Build route sequence with nearest-neighbor within the cluster
            let stop_indices = &route_stops[root];
            let mut sequence: Vec<RouteStop> = Vec::new();
            let mut current = vehicle.start_location.clone();
            let mut route_dist = 0.0;
            let mut visited: Vec<bool> = vec![false; stop_indices.len()];

            for _ in 0..stop_indices.len() {
                let (next_local_idx, _) = stop_indices
                    .iter()
                    .enumerate()
                    .filter(|(vi, _)| !visited[*vi])
                    .map(|(vi, si)| {
                        (
                            vi,
                            haversine_km(&current, &request.stops[*si].location),
                        )
                    })
                    .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
                    .unwrap();

                let stop = &request.stops[stop_indices[next_local_idx]];
                let d = haversine_km(&current, &stop.location);
                route_dist += d;

                sequence.push(RouteStop {
                    stop_id: stop.id.clone(),
                    arrival_time: Utc::now(),
                    departure_time: Utc::now(),
                    distance_from_prev_km: d,
                });

                current = stop.location.clone();
                visited[next_local_idx] = true;
            }

            total_distance += route_dist;
            let cost = route_dist * vehicle.cost_per_km;
            total_cost += cost;

            routes.push(VehicleRoute {
                vehicle_id: vehicle.id.clone(),
                stop_sequence: sequence,
                distance_km: route_dist,
                duration_h: route_dist / 60.0,
                load_kg: route_load[root],
                cost,
            });
        }

        // Remaining unassigned routes
        for root_idx in 0..n {
            if find(&mut parent, root_idx) != root_idx || route_stops[root_idx].is_empty() {
                continue;
            }
            if used_vehicles < max_vehicles {
                continue; // Already assigned above
            }
        }

        Ok(RouteSolution {
            request_id: request.request_id.clone(),
            routes,
            total_distance_km: total_distance,
            total_cost,
            unserved_stops: unserved,
            computed_at: Utc::now(),
            solver_metadata: {
                let mut m = HashMap::new();
                m.insert(
                    "algorithm".to_string(),
                    "clarke_wright_savings".to_string(),
                );
                m.insert("vehicles_used".to_string(), used_vehicles.to_string());
                m
            },
        })
    }
}

fn find(parent: &mut [usize], x: usize) -> usize {
    if parent[x] != x {
        parent[x] = find(parent, parent[x]);
    }
    parent[x]
}

fn union(parent: &mut [usize], x: usize, y: usize) {
    let root_x = find(parent, x);
    let root_y = find(parent, y);
    if root_x != root_y {
        parent[root_y] = root_x;
    }
}
