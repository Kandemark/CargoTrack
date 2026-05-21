FROM rust:1.86-alpine AS builder
RUN apk add --no-cache musl-dev protoc protobuf-dev
WORKDIR /app
COPY . .
RUN cargo build --release

FROM alpine:3.21
RUN apk add --no-cache ca-certificates \
    && addgroup -S -g 1000 app \
    && adduser -S -u 1000 -G app app
COPY --from=builder /app/target/release/route-optimizer /usr/local/bin/route-optimizer
USER app
ENTRYPOINT ["route-optimizer"]
