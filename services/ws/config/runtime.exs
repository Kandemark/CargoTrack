import Config

# Runtime configuration — evaluated at startup (or release boot).
# All values come from environment variables so we can override
# per-environment without rebuilding.

port = String.to_integer(System.get_env("WS_PORT", "4000"))
secret_key_base = System.get_env("SECRET_KEY_BASE")
if is_nil(secret_key_base) or secret_key_base == "" do
  raise "SECRET_KEY_BASE environment variable is required but not set"
end
redis_url = System.get_env("REDIS_URL", "redis://localhost:6379/0")
cors_origins = System.get_env("CORS_ORIGINS", "http://localhost:5173")

config :cargotrack_ws, CargoTrackWsWeb.Endpoint,
  http: [port: port],
  secret_key_base: secret_key_base

Application.put_env(:cargotrack_ws, :redis_url, redis_url)
Application.put_env(:cargotrack_ws, :cors_origins, cors_origins)
