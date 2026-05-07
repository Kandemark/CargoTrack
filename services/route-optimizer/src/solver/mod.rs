pub mod tsp;
pub mod mvrp;

use crate::models::*;
use anyhow::Result;

pub trait Solver: Send + Sync {
    fn solve(&self, request: &RouteOptimizationRequest) -> Result<RouteSolution>;
}
