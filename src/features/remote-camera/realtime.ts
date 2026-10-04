import { supabaseUrl } from "@/lib/supabase";

type Handler = (event: string, payload: Record<string, unknown>) => void;

const nextRef = (() => {
  let value = 0;
  return () => String(++value);
})();

export class PublicRealtimeChannel {
  private ws: WebSocket | null = null;
  private heartbeat: number | null = null;
  private joinRef = nextRef();
  private joined = false;
  private handlers = new Set<Handler>();

  constructor(private readonly topic: string) {}

  on(handler: Handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.joined) return;

    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_yGWVZRX5EfK-r7T_tG0Gxg_533Lpvjc";
    const wsUrl =
      `wss://${new URL(supabaseUrl).host}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      const timeout = window.setTimeout(() => {
        ws.close();
        reject(new Error("Tempo esgotado ao conectar ao monitor remoto."));
      }, 10000);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          topic: this.topic,
          event: "phx_join",
          payload: {
            config: {
              broadcast: { ack: false, self: true },
              presence: { enabled: false },
              private: false,
            },
          },
          ref: this.joinRef,
          join_ref: this.joinRef,
        }));
      };

      ws.onmessage = (message) => {
        let data: any;
        try {
          data = JSON.parse(message.data);
        } catch {
          return;
        }

        if (data.event === "phx_reply" && data.ref === this.joinRef) {
          window.clearTimeout(timeout);
          if (data.payload?.status === "ok") {
            this.joined = true;
            this.heartbeat = window.setInterval(() => {
              this.sendRaw("phoenix", "heartbeat", {}, null);
            }, 20000);
            resolve();
          } else {
            reject(new Error(data.payload?.response?.reason || "Não foi possível conectar ao monitor remoto."));
          }
          return;
        }

        if (data.event === "broadcast") {
          const event = data.payload?.event;
          const payload = data.payload?.payload;
          if (typeof event === "string" && payload && typeof payload === "object") {
            this.handlers.forEach((handler) => handler(event, payload));
          }
        }
      };

      ws.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Não foi possível conectar ao serviço de monitoramento."));
      };
    });
  }

  send(event: string, payload: Record<string, unknown>) {
    this.sendRaw(this.topic, "broadcast", {
      type: "broadcast",
      event,
      payload,
    }, this.joinRef);
  }

  close() {
    if (this.heartbeat !== null) {
      window.clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRaw(this.topic, "phx_leave", {}, this.joinRef);
      this.ws.close();
    }
    this.ws = null;
    this.joined = false;
  }

  private sendRaw(topic: string, event: string, payload: Record<string, unknown>, joinRef: string | null) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      topic,
      event,
      payload,
      ref: nextRef(),
      ...(joinRef ? { join_ref: joinRef } : {}),
    }));
  }
}
