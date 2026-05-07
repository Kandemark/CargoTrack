defmodule CargoTrackWsWeb.Socket do
  use Phoenix.Socket

  # ── Channels ────────────────────────────────────────────────────────────────
  channel "/ws/notifications/*", CargoTrackWsWeb.Channels.Notification
  channel "/ws/chat/*",          CargoTrackWsWeb.Channels.Chat
  channel "/ws/video/*",         CargoTrackWsWeb.Channels.Video

  # ── Auth ────────────────────────────────────────────────────────────────────

  @impl true
  def connect(params, socket) do
    token = params["token"]

    if token && token != "" do
      case CargoTrackWsWeb.Auth.verify_token(token) do
        {:ok, user} ->
          {:ok,
           socket
           |> assign(:user_id, user["user_id"])
           |> assign(:username, user["username"] || user["user_id"])}

        {:error, _reason} ->
          :error
      end
    else
      # Accept without auth — client must send {"type": "auth", "token": "..."}
      # as its first message.  Channels enforce this via handle_in/3.
      {:ok, socket}
    end
  end

  @impl true
  def id(socket), do: "cargotrack_ws:#{socket.assigns[:user_id] || "anon"}"
end
