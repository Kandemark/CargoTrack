# CargoTrack Route Optimization Engine
# TSP/MVRP solver — stdin JSON → stdout JSON
FROM rust:1.85-alpine AS builder
RUN apk add --no-cache musl-dev
WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true
COPY src/ src/
RUN cargo build --release

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/target/release/route-optimizer /usr/local/bin/route-optimizer
ENTRYPOINT ["route-optimizer"]
