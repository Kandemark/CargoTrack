defmodule CargoTrackWsWeb.Channels.Video do
  use Phoenix.Channel

  @impl true
  def join("ws:video:" <> conversation_id, _message, socket) do
    if socket.assigns[:user_id] do
      Phoenix.PubSub.subscribe(CargoTrackWs.PubSub, "video:#{conversation_id}")
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
        Phoenix.PubSub.subscribe(CargoTrackWs.PubSub, "video:#{conversation_id}")
        {:reply, {:ok, %{type: "auth_success", user_id: user["user_id"]}},
         socket |> assign(:user_id, user["user_id"]) |> assign(:username, user["username"])}

      {:error, _reason} ->
        {:reply, {:error, %{type: "auth_error", detail: "Invalid token"}}, socket}
    end
  end

  def handle_in("auth", _payload, socket) do
    {:reply, {:error, %{type: "auth_error", detail: "Token required"}}, socket}
  end

  # ── WebRTC Signaling ────────────────────────────────────────────────────────

  def handle_in("call", %{"callee_id" => callee_id}, socket) do
    payload = %{
      call_id: System.unique_integer([:positive]),
      caller_id: socket.assigns[:user_id],
      caller_name: socket.assigns[:username],
      conversation_id: String.to_integer(socket.assigns[:conversation_id] || "0"),
    }
    broadcast!(socket, "incoming_call", Map.put(payload, :callee_id, callee_id))
    {:noreply, socket}
  end

  def handle_in("accept", %{"call_id" => call_id}, socket) do
    broadcast!(socket, "call_accepted", %{
      call_id: call_id,
      conversation_id: String.to_integer(socket.assigns[:conversation_id] || "0"),
      accepted_by: socket.assigns[:user_id],
    })
    {:noreply, socket}
  end

  def handle_in("signal", payload, socket) do
    # Relay SDP offer/answer or ICE candidate to other participants
    broadcast!(socket, "signal", %{
      from_id: socket.assigns[:user_id],
      from_name: socket.assigns[:username],
      conversation_id: String.to_integer(socket.assigns[:conversation_id] || "0"),
      sdp: payload["sdp"],
      candidate: payload["candidate"],
    })
    {:noreply, socket}
  end

  def handle_in("end", %{"call_id" => call_id}, socket) do
    broadcast!(socket, "call_ended", %{
      call_id: call_id,
      by_id: socket.assigns[:user_id],
      conversation_id: String.to_integer(socket.assigns[:conversation_id] || "0"),
    })
    {:noreply, socket}
  end

  def handle_in("missed", %{"call_id" => call_id}, socket) do
    broadcast!(socket, "call_missed", %{
      call_id: call_id,
      conversation_id: String.to_integer(socket.assigns[:conversation_id] || "0"),
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
