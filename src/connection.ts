import type { RunelinkMessage } from "./protocol";

export class RunelinkConnection {
  private url: string;
  private ws: WebSocket | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => resolve();
      this.ws.onerror = (error) => reject(error);
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: RunelinkMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  onMessage(handler: (message: RunelinkMessage) => void): void {
    if (this.ws) {
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data) as RunelinkMessage;
        handler(message);
      };
    }
  }
}
