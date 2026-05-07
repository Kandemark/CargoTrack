# CargoTrack Notification Dispatch Service
# Multi-channel notification delivery (push, SMS, email, WhatsApp)
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download 2>/dev/null || true
COPY . .
RUN CGO_ENABLED=0 go build -o notification .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/notification /usr/local/bin/notification
ENTRYPOINT ["notification"]
