import Config

# Base config shared across all environments.
# Runtime overrides go in runtime.exs.

config :cargotrack_ws, CargoTrackWsWeb.Endpoint,
  # WebSocket-only — no HTTP server-side sessions, so a static secret is fine.
  # Override in production via SECRET_KEY_BASE env var.
  secret_key_base: "ws-dev-secret-change-in-production",
  pubsub_server: CargoTrackWs.PubSub,
  render_errors: [accepts: ~w(json)]

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]
