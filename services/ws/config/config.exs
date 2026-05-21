import Config

# Base config shared across all environments.
# secret_key_base is set at runtime via runtime.exs from SECRET_KEY_BASE env var.
# This value is a build-time fallback only — production MUST override via env.

config :cargotrack_ws, CargoTrackWsWeb.Endpoint,
  secret_key_base: "build-time-placeholder-override-via-SECRET_KEY_BASE-env-var",
  pubsub_server: CargoTrackWs.PubSub,
  render_errors: [accepts: ~w(json)]

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]
