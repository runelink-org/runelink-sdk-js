import {
  type ClientToServerMessage,
  type ServerToClientMessage,
  ClientToServerMessageSchema,
  ServerToClientMessageSchema,
} from "./protocol";
import type { ZodError } from "zod";

function formatZodError(error: ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

export class RunelinkConnection {
  private url: string;
  private ws: WebSocket | null = null;
  private onError?: (error: Error) => void;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => resolve();
      this.ws.onerror = (event) => {
        const error = new Error(`WebSocket error: ${event.type}`);
        this.onError?.(error);
        reject(error);
      };
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: ClientToServerMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }

    const result = ClientToServerMessageSchema.safeParse(message);
    if (!result.success) {
      throw new Error(`Invalid message: ${formatZodError(result.error)}`);
    }

    this.ws.send(JSON.stringify(message));
  }

  onMessage(handler: (message: ServerToClientMessage) => void): void {
    if (this.ws) {
      this.ws.onmessage = (event) => {
        let data: unknown;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          const error = new Error(
            `Failed to parse message: ${e instanceof Error ? e.message : String(e)}`
          );
          this.onError?.(error);
          return;
        }

        const result = ServerToClientMessageSchema.safeParse(data);
        if (!result.success) {
          const error = new Error(`Invalid message received: ${formatZodError(result.error)}`);
          this.onError?.(error);
          return;
        }

        handler(result.data);
      };
    }
  }

  onValidationError(handler: (error: Error) => void): void {
    this.onError = handler;
  }
}
