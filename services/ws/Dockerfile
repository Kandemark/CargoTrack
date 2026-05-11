# Multi-stage build for the Elixir/Phoenix WebSocket service.
#
# Stage 1 — builder: fetches deps, compiles .beam files, assembles a release.
# Stage 2 — runtime: slim image with only the release artifact and the Erlang
#   runtime. No build tools, no source code.

# ── Builder ──────────────────────────────────────────────────────────────────
FROM hexpm/elixir:1.19.0-erlang-27.0-alpine-3.23.3 AS builder

WORKDIR /app

# Install build dependencies.  hex is the package manager, rebar3 compiles
# native Erlang deps (not needed by our current dep tree but kept for safety).
RUN mix local.hex --force && mix local.rebar --force

# Cache deps separately from source so dependency fetch only re-runs when
# mix.exs/mix.lock change, not on every source edit.
COPY mix.exs mix.lock* ./
RUN HEX_HTTP_TIMEOUT=120 mix deps.get --only prod || HEX_HTTP_TIMEOUT=120 mix deps.get --only prod || HEX_HTTP_TIMEOUT=120 mix deps.get --only prod

# Copy the rest of the source and compile for production.
COPY config config
COPY lib lib
RUN mix compile --no-debug-info

# Assemble a self-contained release.  The release includes ERTS (the Erlang
# runtime) so the runtime stage doesn't need Elixir installed at all.
RUN mix release cargotrack_ws --path /opt/release

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM alpine:3.23

# Erlang runtime libraries needed by the release.
# ncurses-libs / libcrypto3 / libstdc++ are pulled in by ERTS crypto & asn1.
RUN apk add --no-cache ncurses-libs libcrypto3 libstdc++ openssl

# Copy the release from the builder stage.
COPY --from=builder /opt/release /opt/cargotrack_ws

EXPOSE 4000

# Start the release.  The eval runs runtime.exs, then starts the supervision tree.
ENTRYPOINT ["/opt/cargotrack_ws/bin/cargotrack_ws"]
CMD ["start"]
