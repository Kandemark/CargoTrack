defmodule CargoTrackWsWeb.Channels.Notification do
  use Phoenix.Channel

  @impl true
  def join("ws/notifications:" <> _user_id, _message, socket) do
    if socket.assigns[:user_id] do
      {:ok, socket}
    else
      {:error, %{reason: "authentication required"}}
    end
  end

  # ── Auth message (challenge-response) ──────────────────────────────────────

  @impl true
  def handle_in("auth", %{"token" => token}, socket) do
    case CargoTrackWsWeb.Auth.verify_token(token) do
      {:ok, claims} ->
        user = CargoTrackWsWeb.Auth.user_from_claims(claims)
        Phoenix.PubSub.subscribe(CargoTrackWs.PubSub, "notifications:#{user["user_id"]}")
        {:reply, {:ok, %{type: "auth_success", user_id: user["user_id"]}},
         socket |> assign(:user_id, user["user_id"]) |> assign(:username, user["username"])}

      {:error, _reason} ->
        {:reply, {:error, %{type: "auth_error", detail: "Invalid token"}}, socket}
    end
  end

  def handle_in("auth", _payload, socket) do
    {:reply, {:error, %{type: "auth_error", detail: "Token required"}}, socket}
  end

  # Block other messages before auth
  def handle_in(_event, _payload, socket) do
    if socket.assigns[:user_id] do
      {:noreply, socket}
    else
      {:reply, {:error, %{type: "error", detail: "Auth required", code: "AUTH_REQUIRED"}}, socket}
    end
  end

  # ── Incoming from Redis Pub/Sub bridge ─────────────────────────────────────

  @impl true
  def handle_info({:notification, payload}, socket) do
    push(socket, "notification", payload)
    {:noreply, socket}
  end

  def handle_info({:alert, payload}, socket) do
    push(socket, "alert", payload)
    {:noreply, socket}
  end
end
