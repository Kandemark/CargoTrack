mod cache;
mod config;
mod models;
mod server;
mod solver;

use cache::lru::hash_request;
use cache::SolutionCache;
use config::Config;
use models::RouteOptimizationRequest;
use solver::mvrp::MVRPSolver;
use solver::tsp::TSPSolver;
use solver::Solver;
use std::io::{self, Read};
use std::net::SocketAddr;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env();

    if config.log_json {
        tracing_subscriber::fmt()
            .json()
            .with_env_filter(
                tracing_subscriber::EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| "info".into()),
            )
            .init();
    } else {
        tracing_subscriber::fmt()
            .with_env_filter(
                tracing_subscriber::EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| "info".into()),
            )
            .init();
    }

    info!("CargoTrack Route Optimization Engine starting");

    // CLI mode: read JSON from stdin (for batch / one-shot use)
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && args[1] == "cli" {
        return run_cli(&config);
    }

    // gRPC server mode (default)
    run_grpc(config).await
}

fn run_cli(config: &Config) -> anyhow::Result<()> {
    let cache = SolutionCache::new(config.cache_capacity);

    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;

    let request: RouteOptimizationRequest = serde_json::from_str(&input)?;
    info!(
        "Processing request {}: {} stops, {} vehicles",
        request.request_id,
        request.stops.len(),
        request.vehicles.len()
    );

    let request_hash = hash_request(&input);
    if let Some(cached) = cache.get(&request_hash) {
        info!("Cache hit for request {}", request.request_id);
        println!("{}", serde_json::to_string(&cached)?);
        return Ok(());
    }

    let solution = if request.vehicles.len() == 1 {
        info!("Using TSP solver (single vehicle)");
        TSPSolver.solve(&request)?
    } else {
        info!(
            "Using MVRP solver ({} vehicles)",
            request.vehicles.len()
        );
        MVRPSolver.solve(&request)?
    };

    cache.put(request_hash, solution.clone());

    println!("{}", serde_json::to_string(&solution)?);
    info!(
        "Solved: {:.2} km, {:.2} cost, {} routes, {} unserved",
        solution.total_distance_km,
        solution.total_cost,
        solution.routes.len(),
        solution.unserved_stops.len()
    );

    Ok(())
}

async fn run_grpc(config: Config) -> anyhow::Result<()> {
    let cache = SolutionCache::new(config.cache_capacity);
    let addr: SocketAddr = format!("0.0.0.0:{}", config.grpc_port).parse()?;

    let svc = server::OptimizerService::new(cache);

    info!("gRPC server listening on {}", addr);

    tonic::transport::Server::builder()
        .add_service(svc.into_server())
        .serve(addr)
        .await?;

    Ok(())
}
