defmodule CargoTrackWsWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :cargotrack_ws

  # CORS for the Vite dev server (matches Django's CORS_ALLOWED_ORIGINS).
  # Configured via :cargotrack_ws, :cors_origins — see config/runtime.exs.
  plug Corsica,
    origins: (Application.compile_env(:cargotrack_ws, :cors_origins, "http://localhost:5173")
              |> String.split(",")
              |> Enum.map(&String.trim/1)),
    allow_credentials: true,
    allow_headers: ["content-type", "authorization"]

  # WebSocket upgrade — matches /ws and any sub-path
  socket "/ws", CargoTrackWsWeb.Socket,
    websocket: true,
    longpoll: false

  # Route HTTP requests — non-WebSocket traffic (health, metrics, root)
  plug :dispatch

  defp dispatch(%{request_path: "/metrics"} = conn, _opts) do
    metrics = [
      "# HELP erlang_vm_uptime_seconds Erlang VM uptime\n",
      "# TYPE erlang_vm_uptime_seconds gauge\n",
      "erlang_vm_uptime_seconds ", :erlang.statistics(:wall_clock) |> elem(0) |> Kernel./(1000) |> :erlang.float_to_binary([decimals: 0]), "\n",
      "# HELP erlang_vm_process_count Erlang VM process count\n",
      "# TYPE erlang_vm_process_count gauge\n",
      "erlang_vm_process_count ", length(Process.list()) |> Integer.to_string(), "\n",
      "# HELP phoenix_endpoint_healthy Phoenix endpoint health status\n",
      "# TYPE phoenix_endpoint_healthy gauge\n",
      "phoenix_endpoint_healthy 1\n",
    ]

    conn
    |> Plug.Conn.put_resp_content_type("text/plain; version=0.0.4")
    |> Plug.Conn.send_resp(200, metrics)
    |> Plug.Conn.halt()
  end

  defp dispatch(conn, _opts) do
    conn
    |> Plug.Conn.put_resp_content_type("application/json")
    |> Plug.Conn.send_resp(200, ~s({"status":"healthy"}))
    |> Plug.Conn.halt()
  end
end
