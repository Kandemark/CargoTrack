FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download 2>/dev/null || true
COPY . .
RUN CGO_ENABLED=0 go build -o webhook-dispatcher .

FROM alpine:3.22
RUN apk add --no-cache ca-certificates \
    && addgroup -S -g 1000 app \
    && adduser -S -u 1000 -G app app
COPY --from=builder /app/webhook-dispatcher /usr/local/bin/webhook-dispatcher
USER app
ENTRYPOINT ["webhook-dispatcher"]
