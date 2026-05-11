FROM rust:1.86-alpine AS builder
RUN apk add --no-cache musl-dev cmake make g++ openssl-dev curl-dev zlib-dev zlib-static
WORKDIR /app
COPY . .
RUN cargo build --release

FROM alpine:3.21
RUN apk add --no-cache ca-certificates libgcc
COPY --from=builder /app/target/release/gps-ingest /usr/local/bin/gps-ingest
EXPOSE 1883
ENTRYPOINT ["gps-ingest"]
