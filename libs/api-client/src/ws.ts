/**
 * @cargotrack/api-client/ws
 *
 * WebSocket client for CargoTrack real-time events.
 * Connects to the Elixir Phoenix Channel server for live updates:
 *   - Shipment state changes
 *   - GPS position updates
 *   - Alert notifications
 *   - Chat messages
 *   - Marketplace bid updates
 */
export type WsEvent =
  | "shipment:state_changed"
  | "shipment:delayed"
  | "shipment:delivered"
  | "gps:position_changed"
  | "gps:geofence_enter"
  | "gps:geofence_exit"
  | "alert:triggered"
  | "chat:message"
  | "marketplace:bid_placed"
  | "marketplace:bid_accepted"
  | "notification:new";

export interface WsMessage<T = unknown> {
  event: WsEvent;
  payload: T;
  timestamp: string;
}

type MessageHandler<T = unknown> = (message: WsMessage<T>) => void;

export interface WsClientOptions {
  /** WebSocket URL, e.g. "wss://ws.cargotrack.io/ws" */
  url: string;
  /** JWT access token for authentication */
  token: string | (() => string | null);
  /** Automatically reconnect on close (default: true) */
  autoReconnect?: boolean;
  /** Max reconnection attempts (default: 10, 0 = infinite) */
  maxReconnectAttempts?: number;
  /** Delay between reconnection attempts in ms (default: 2000) */
  reconnectDelay?: number;
  /** Called when connection is established */
  onConnect?: () => void;
  /** Called when connection is lost */
  onDisconnect?: (reason: string) => void;
  /** Called on authentication failure */
  onAuthError?: () => void;
}

export class CargoTrackWebSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private opts: Required<WsClientOptions>;

  constructor(opts: WsClientOptions) {
    this.opts = {
      url: opts.url,
      token: opts.token,
      autoReconnect: opts.autoReconnect ?? true,
      maxReconnectAttempts: opts.maxReconnectAttempts ?? 10,
      reconnectDelay: opts.reconnectDelay ?? 2000,
      onConnect: opts.onConnect ?? (() => {}),
      onDisconnect: opts.onDisconnect ?? (() => {}),
      onAuthError: opts.onAuthError ?? (() => {}),
    };
  }

  /** Open the WebSocket connection and authenticate. */
  connect(): void {
    if (this.destroyed) return;

    const token = typeof this.opts.token === "function"
      ? this.opts.token()
      : this.opts.token;

    this.ws = new WebSocket(`${this.opts.url}?token=${token}`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.opts.onConnect();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: WsMessage = JSON.parse(event.data as string);
        const listeners = this.handlers.get(msg.event);
        if (listeners) {
          listeners.forEach((handler) => handler(msg));
        }
      } catch {
        // Ignore non-JSON messages (heartbeats, etc.)
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.opts.onDisconnect(event.reason || "connection closed");
      if (this.opts.autoReconnect && !this.destroyed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire next — no need to duplicate reconnect logic
    };
  }

  /** Subscribe to a specific event type. Returns unsubscribe function. */
  on<T = unknown>(event: WsEvent, handler: MessageHandler<T>): () => void {
    let listeners = this.handlers.get(event);
    if (!listeners) {
      listeners = new Set();
      this.handlers.set(event, listeners);
    }
    listeners.add(handler as MessageHandler);
    return () => {
      listeners?.delete(handler as MessageHandler);
    };
  }

  /** Send a message to the server (chat, etc.). */
  send(event: string, payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, payload }));
    }
  }

  /** Close the connection and stop reconnecting. */
  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close(1000, "client disconnect");
    this.ws = null;
    this.handlers.clear();
  }

  /** Current connection state. */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.opts.maxReconnectAttempts > 0 && this.reconnectAttempts >= this.opts.maxReconnectAttempts) {
      console.warn("[CargoTrackWS] max reconnect attempts reached");
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(this.opts.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}

/**
 * Create a pre-configured WebSocket client for CargoTrack.
 *
 * @example
 * ```ts
 * const ws = createCargoTrackWs({
 *   url: "wss://ws.cargotrack.io/ws",
 *   token: () => localStorage.getItem("access_token"),
 *   onConnect: () => console.log("live"),
 * });
 *
 * ws.on("shipment:state_changed", (msg) => {
 *   console.log("Shipment updated:", msg.payload);
 * });
 *
 * ws.connect();
 * ```
 */
export function createCargoTrackWs(opts: WsClientOptions): CargoTrackWebSocket {
  return new CargoTrackWebSocket(opts);
}
