defmodule CargoTrackWs.Application do
  use Application

  @impl true
  def start(_type, _args) do
    port = String.to_integer(System.get_env("WS_PORT", "4000"))
    redis_url = System.get_env("REDIS_URL", "redis://localhost:6379/0")

    children = [
      # Redis client for Pub/Sub bridge with Django Channels
      {Redix, {redis_url, [name: :redix]}},

      # Phoenix PubSub for local node distribution
      {Phoenix.PubSub, name: CargoTrackWs.PubSub},

      # WebSocket endpoint
      {Bandit, scheme: :http, port: port, plug: CargoTrackWsWeb.Endpoint},
    ]

    opts = [strategy: :one_for_one, name: CargoTrackWs.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
