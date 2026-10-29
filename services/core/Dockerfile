FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/core ./cmd/core

# Static binary on distroless: no shell, no package manager, nothing for an
# attacker to use. Migrations are embedded in the binary.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/core /core
EXPOSE 8080
ENTRYPOINT ["/core"]
