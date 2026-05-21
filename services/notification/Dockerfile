FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download 2>/dev/null || true
COPY . .
RUN CGO_ENABLED=0 go build -o notification .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates \
    && addgroup -S -g 1000 app \
    && adduser -S -u 1000 -G app app
COPY --from=builder /app/notification /usr/local/bin/notification
USER app
ENTRYPOINT ["notification"]
