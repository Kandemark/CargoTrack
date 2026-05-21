defmodule CargoTrackWs.Application do
  use Application

  @impl true
  def start(_type, _args) do
    redis_url = System.get_env("REDIS_URL", "redis://localhost:6379/0")

    port = String.to_integer(System.get_env("WS_PORT", "4000"))

    children = [
      # Redis client for Pub/Sub bridge with Django Channels
      {Redix, {redis_url, [name: :redix]}},

      # Phoenix PubSub for local node distribution
      {Phoenix.PubSub, name: CargoTrackWs.PubSub},

      # Endpoint supervisor — initializes persistent_term config. Without
      # server: true it won't start its own HTTP server; Bandit handles that.
      CargoTrackWsWeb.Endpoint,

      # Bandit HTTP server using the Phoenix Endpoint as its Plug
      {Bandit, scheme: :http, port: port, plug: CargoTrackWsWeb.Endpoint},
    ]

    opts = [strategy: :one_for_one, name: CargoTrackWs.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
