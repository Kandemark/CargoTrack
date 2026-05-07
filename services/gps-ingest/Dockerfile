# CargoTrack GPS Telematics Ingestion Service
# MQTT → Kafka bridge with protocol adapters and geofencing
FROM rust:1.85-alpine AS builder
RUN apk add --no-cache musl-dev cmake make g++ openssl-dev
WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true
COPY src/ src/
RUN cargo build --release

FROM alpine:3.21
RUN apk add --no-cache ca-certificates libgcc
COPY --from=builder /app/target/release/gps-ingest /usr/local/bin/gps-ingest
EXPOSE 1883
ENTRYPOINT ["gps-ingest"]
