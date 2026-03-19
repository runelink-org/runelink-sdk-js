import type { ZodError } from "zod";
import { z } from "zod";
import {
  type ClientWsReply,
  type ClientWsRequest,
  type ClientWsUpdate,
  ClientWsErrorEnvelopeSchema,
  ClientWsReplyEnvelopeSchema,
  ClientWsRequestEnvelopeSchema,
  ClientWsRequestSchema,
  ClientWsUpdateEnvelopeSchema,
} from "./protocol";

type PendingRequest = {
  resolve: (reply: ClientWsReply) => void;
  reject: (error: Error) => void;
};

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

function createWsError(error: {
  code: string;
  message: string;
  details: unknown | null;
}): Error {
  const detailSuffix =
    error.details == null ? "" : ` (${JSON.stringify(error.details)})`;
  return new Error(`[${error.code}] ${error.message}${detailSuffix}`);
}

export class RunelinkConnection {
  private url: string;
  private ws: WebSocket | null = null;
  private onError?: (error: Error) => void;
  private onUpdateHandler?: (update: ClientWsUpdate) => void;
  private pendingRequests = new Map<string, PendingRequest>();

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => resolve();
      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };
      this.ws.onerror = (event) => {
        const error = new Error(`WebSocket error: ${event.type}`);
        this.onError?.(error);
        reject(error);
      };
      this.ws.onclose = () => {
        this.rejectAllPendingRequests(
          new Error("WebSocket connection closed before a reply was received")
        );
        this.ws = null;
      };
    });
  }

  disconnect(): void {
    this.rejectAllPendingRequests(
      new Error("WebSocket disconnected before a reply was received")
    );

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: ClientWsRequest): Promise<ClientWsReply> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }

    const result = ClientWsRequestSchema.safeParse(message);
    if (!result.success) {
      throw new Error(`Invalid message: ${formatZodError(result.error)}`);
    }

    const requestId = crypto.randomUUID();
    const envelope = ClientWsRequestEnvelopeSchema.parse({
      type: "request",
      data: {
        request_id: requestId,
        request: result.data,
      },
    });

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      try {
        this.ws?.send(JSON.stringify(envelope));
      } catch (error) {
        this.pendingRequests.delete(requestId);
        throw error;
      }
    });
  }

  onUpdate(handler: (update: ClientWsUpdate) => void): void {
    this.onUpdateHandler = handler;
  }

  onValidationError(handler: (error: Error) => void): void {
    this.onError = handler;
  }

  private handleMessage(event: MessageEvent): void {
    const data = this.parseEventData(event);
    if (data === null) {
      return;
    }

    const envelopeSchema = z.discriminatedUnion("type", [
      ClientWsReplyEnvelopeSchema,
      ClientWsErrorEnvelopeSchema,
      ClientWsUpdateEnvelopeSchema,
    ]);
    const result = envelopeSchema.safeParse(data);
    if (!result.success) {
      const error = new Error(
        `Invalid message received: ${formatZodError(result.error)}`
      );
      this.onError?.(error);
      return;
    }

    const envelope = result.data;
    if (envelope.type === "update") {
      this.onUpdateHandler?.(envelope.data.update);
      return;
    }

    const requestId = envelope.data.request_id;
    const pendingRequest = requestId
      ? this.pendingRequests.get(requestId)
      : undefined;

    if (!requestId || !pendingRequest) {
      this.onError?.(
        new Error(
          `Received ${envelope.type} for unknown request_id: ${String(
            envelope.data.request_id
          )}`
        )
      );
      return;
    }

    this.pendingRequests.delete(requestId);

    if (envelope.type === "reply") {
      pendingRequest.resolve(envelope.data.reply);
      return;
    }

    pendingRequest.reject(createWsError(envelope.data.error));
  }

  private parseEventData(event: MessageEvent): unknown | null {
    if (typeof event.data !== "string") {
      const error = new Error(
        `Unsupported websocket message type: ${typeof event.data}`
      );
      this.onError?.(error);
      return null;
    }

    try {
      return JSON.parse(event.data);
    } catch (error) {
      const parseError = new Error(
        `Failed to parse message: ${error instanceof Error ? error.message : String(error)}`
      );
      this.onError?.(parseError);
      return null;
    }
  }

  private rejectAllPendingRequests(error: Error): void {
    for (const pendingRequest of this.pendingRequests.values()) {
      pendingRequest.reject(error);
    }

    this.pendingRequests.clear();
  }
}
