FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download 2>/dev/null || true

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /tracking-server ./cmd/tracking-server/

FROM alpine:3.21

RUN apk add --no-cache ca-certificates \
    && addgroup -S -g 1000 app \
    && adduser -S -u 1000 -G app app

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /tracking-server /tracking-server

USER app
EXPOSE 8080

ENTRYPOINT ["/tracking-server"]
