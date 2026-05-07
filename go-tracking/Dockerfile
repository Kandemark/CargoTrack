# CargoTrack Go Tracking Service — Multi-stage Docker build
# ===========================================================
# Stage 1: compile a statically-linked binary
# Stage 2: copy into a scratch/distroless image for a ~12 MB final image

FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download 2>/dev/null || true

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /tracking-server .

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /tracking-server /tracking-server

EXPOSE 8080
USER nonroot:nonroot

ENTRYPOINT ["/tracking-server"]
