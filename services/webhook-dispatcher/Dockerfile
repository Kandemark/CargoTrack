# CargoTrack Webhook Dispatcher Service
# Kafka consumer → HMAC-signed outbound webhooks with circuit breaker
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download 2>/dev/null || true
COPY . .
RUN CGO_ENABLED=0 go build -o webhook-dispatcher .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/webhook-dispatcher /usr/local/bin/webhook-dispatcher
ENTRYPOINT ["webhook-dispatcher"]
