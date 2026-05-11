defmodule CargoTrackWs.MixProject do
  use Mix.Project

  def project do
    [
      app: :cargotrack_ws,
      version: "0.1.0",
      elixir: "~> 1.17",
      start_permanent: Mix.env() == :prod,
      releases: [cargotrack_ws: [validate_compile_env: false]],
      deps: deps()
    ]
  end

  def application do
    [
      mod: {CargoTrackWs.Application, []},
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  defp deps do
    [
      {:phoenix, "~> 1.7"},
      {:phoenix_pubsub, "~> 2.1"},
      {:bandit, "~> 1.5"},
      {:websock_adapter, "~> 0.5"},
      {:jason, "~> 1.4"},
      {:joken, "~> 2.6"},
      {:redix, "~> 1.5"},
      {:corsica, "~> 2.1"},
    ]
  end
end
