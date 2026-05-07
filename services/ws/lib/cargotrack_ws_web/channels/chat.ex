defmodule CargoTrackWsWeb.Channels.Chat do
  use Phoenix.Channel

  @impl true
  def join("ws:chat:" <> conversation_id, _message, socket) do
    if socket.assigns[:user_id] do
      Phoenix.PubSub.subscribe(CargoTrackWs.PubSub, "chat:#{conversation_id}")
      {:ok, assign(socket, :conversation_id, conversation_id)}
    else
      {:error, %{reason: "authentication required"}}
    end
  end

  # ── Auth ────────────────────────────────────────────────────────────────────

  @impl true
  def handle_in("auth", %{"token" => token}, socket) do
    case CargoTrackWsWeb.Auth.verify_token(token) do
      {:ok, claims} ->
        user = CargoTrackWsWeb.Auth.user_from_claims(claims)
        conversation_id = socket.assigns[:conversation_id] ||
          socket.topic |> String.split(":") |> List.last()
        Phoenix.PubSub.subscribe(CargoTrackWs.PubSub, "chat:#{conversation_id}")
        {:reply, {:ok, %{type: "auth_success", user_id: user["user_id"], conversation_id: String.to_integer(conversation_id)}},
         socket |> assign(:user_id, user["user_id"]) |> assign(:username, user["username"])}

      {:error, _reason} ->
        {:reply, {:error, %{type: "auth_error", detail: "Invalid token"}}, socket}
    end
  end

  def handle_in("auth", _payload, socket) do
    {:reply, {:error, %{type: "auth_error", detail: "Token required"}}, socket}
  end

  # ── Messages ───────────────────────────────────────────────────────────────

  def handle_in("message", %{"content" => content}, socket) do
    if socket.assigns[:user_id] do
      payload = %{
        id: System.unique_integer([:positive]),
        conversation_id: String.to_integer(socket.assigns[:conversation_id]),
        sender_id: socket.assigns[:user_id],
        sender_name: socket.assigns[:username],
        content: content,
        created_at: DateTime.utc_now() |> DateTime.to_iso8601(),
        is_read: false,
      }
      broadcast!(socket, "message", payload)
      {:noreply, socket}
    else
      {:reply, {:error, %{type: "error", detail: "Auth required"}}, socket}
    end
  end

  def handle_in("typing", _payload, socket) do
    broadcast!(socket, "typing", %{
      conversation_id: String.to_integer(socket.assigns[:conversation_id] || "0"),
      user_id: socket.assigns[:user_id],
      user_name: socket.assigns[:username],
    })
    {:noreply, socket}
  end

  def handle_in("read", _payload, socket) do
    broadcast!(socket, "read", %{
      conversation_id: String.to_integer(socket.assigns[:conversation_id] || "0"),
      reader_id: socket.assigns[:user_id],
    })
    {:noreply, socket}
  end

  def handle_in(_event, _payload, socket) do
    if socket.assigns[:user_id] do
      {:noreply, socket}
    else
      {:reply, {:error, %{type: "error", detail: "Auth required", code: "AUTH_REQUIRED"}}, socket}
    end
  end
end
