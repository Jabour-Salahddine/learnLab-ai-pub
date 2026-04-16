/**
 * LearnLab AI — WebSocket client
 * Manages a single WebSocket connection for TP chat streaming.
 */

const WS_BASE = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";

type ChunkCallback = (chunk: string) => void;
type DoneCallback = () => void;
type ErrorCallback = (error: string) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private onChunkCb: ChunkCallback | null = null;
  private onDoneCb: DoneCallback | null = null;
  private onErrorCb: ErrorCallback | null = null;
  private reconnectAttempts = 0;
  private maxReconnects = 3;

  connect(tp_id: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${WS_BASE}/ws/chat/${tp_id}?token=${token}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onerror = (event) => {
        const msg = "Erreur de connexion WebSocket";
        this.onErrorCb?.(msg);
        reject(new Error(msg));
      };

      this.ws.onclose = (event) => {
        if (event.code !== 1000) {
          this.onErrorCb?.(`Connexion fermée (code ${event.code})`);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type: string;
            content?: string;
            error?: string;
          };
          if (data.type === "chunk" && data.content) {
            this.onChunkCb?.(data.content);
          } else if (data.type === "done") {
            this.onDoneCb?.();
          } else if (data.type === "error") {
            this.onErrorCb?.(data.error ?? "Erreur agent");
          }
        } catch {
          // Non-JSON message, ignore
        }
      };
    });
  }

  sendMessage(question: string, agent: "tuteur" | "explicateur"): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.onErrorCb?.("WebSocket non connecté");
      return;
    }
    this.ws.send(JSON.stringify({ question, agent }));
  }

  onChunk(callback: ChunkCallback): this {
    this.onChunkCb = callback;
    return this;
  }

  onDone(callback: DoneCallback): this {
    this.onDoneCb = callback;
    return this;
  }

  onError(callback: ErrorCallback): this {
    this.onErrorCb = callback;
    return this;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
  }
}
