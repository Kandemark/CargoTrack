# Multi-stage build for the Elixir/Phoenix WebSocket service.
#
# Stage 1 — builder: fetches deps, compiles .beam files, assembles a release.
# Stage 2 — runtime: slim image with only the release artifact and the Erlang
#   runtime. No build tools, no source code.

# ── Builder ──────────────────────────────────────────────────────────────────
FROM hexpm/elixir:1.18.3-erlang-27.3.3-alpine-3.21.3 AS builder

WORKDIR /app

# Install build dependencies.  hex is the package manager, rebar3 compiles
# native Erlang deps (not needed by our current dep tree but kept for safety).
RUN mix local.hex --force && mix local.rebar --force

# Cache deps separately from source so dependency fetch only re-runs when
# mix.exs/mix.lock change, not on every source edit.
# Refresh the Hex registry so we resolve the latest patch versions.
COPY mix.exs mix.lock* ./
RUN mix local.hex --force && HEX_HTTP_TIMEOUT=120 mix deps.get --only prod || HEX_HTTP_TIMEOUT=120 mix deps.get --only prod || HEX_HTTP_TIMEOUT=120 mix deps.get --only prod

# Copy the rest of the source and compile for production.
COPY config config
COPY lib lib
RUN mix compile --no-debug-info

# Assemble a self-contained release.  The release includes ERTS (the Erlang
# runtime) so the runtime stage doesn't need Elixir installed at all.
RUN mix release cargotrack_ws --path /opt/release

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM alpine:3.23

RUN apk add --no-cache ncurses-libs libcrypto3 libstdc++ openssl \
    && addgroup -S -g 1000 app \
    && adduser -S -u 1000 -G app app

COPY --from=builder /opt/release /opt/cargotrack_ws
RUN chown -R app:app /opt/cargotrack_ws

USER app
EXPOSE 4000

ENTRYPOINT ["/opt/cargotrack_ws/bin/cargotrack_ws"]
CMD ["start"]
