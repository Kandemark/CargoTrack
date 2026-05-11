defmodule CargoTrackWsWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :cargotrack_ws

  # CORS for the Vite dev server (matches Django's CORS_ALLOWED_ORIGINS).
  # Configured via :cargotrack_ws, :cors_origins — see config/runtime.exs.
  plug Corsica,
    origins: (Application.get_env(:cargotrack_ws, :cors_origins, "http://localhost:5173")
              |> String.split(",")
              |> Enum.map(&String.trim/1)),
    allow_credentials: true,
    allow_headers: ["content-type", "authorization"]

  # WebSocket upgrade — matches /ws and any sub-path
  socket "/ws", CargoTrackWsWeb.Socket,
    websocket: true,
    longpoll: false

  # Health check
  plug :health

  defp health(conn, _opts) do
    conn
    |> Plug.Conn.put_resp_content_type("application/json")
    |> Plug.Conn.send_resp(200, ~s({"status":"healthy"}))
    |> Plug.Conn.halt()
  end
end
