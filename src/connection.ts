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

const DEFAULT_RECONNECT_INITIAL_DELAY_MS = 1_000;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 30_000;
const DEFAULT_RECONNECT_BACKOFF_MULTIPLIER = 2;
const DEFAULT_RECONNECT_JITTER_RATIO = 0.2;

const IncomingEnvelopeSchema = z.discriminatedUnion("type", [
  ClientWsReplyEnvelopeSchema,
  ClientWsErrorEnvelopeSchema,
  ClientWsUpdateEnvelopeSchema,
]);

type PendingRequest = {
  resolve: (reply: ClientWsReply) => void;
  reject: (error: Error) => void;
};

type Listener<T> = (value: T) => void;

export type RunelinkConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export type RunelinkConnectionOptions = {
  autoReconnect?: boolean;
  reconnectInitialDelayMs?: number;
  reconnectMaxDelayMs?: number;
  reconnectBackoffMultiplier?: number;
  reconnectJitterRatio?: number;
  maxReconnectAttempts?: number | null;
};

type NormalizedRunelinkConnectionOptions = {
  autoReconnect: boolean;
  reconnectInitialDelayMs: number;
  reconnectMaxDelayMs: number;
  reconnectBackoffMultiplier: number;
  reconnectJitterRatio: number;
  maxReconnectAttempts: number | null;
};

export class RunelinkRequestError extends Error {
  code: string;
  details: unknown | null;

  constructor(code: string, message: string, details: unknown | null) {
    const detailSuffix = details == null ? "" : ` (${JSON.stringify(details)})`;
    super(`[${code}] ${message}${detailSuffix}`);
    this.name = "RunelinkRequestError";
    this.code = code;
    this.details = details;
  }
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeOptions(
  options: RunelinkConnectionOptions
): NormalizedRunelinkConnectionOptions {
  const reconnectInitialDelayMs = Math.max(
    0,
    options.reconnectInitialDelayMs ?? DEFAULT_RECONNECT_INITIAL_DELAY_MS
  );
  const reconnectMaxDelayMs = Math.max(
    reconnectInitialDelayMs,
    options.reconnectMaxDelayMs ?? DEFAULT_RECONNECT_MAX_DELAY_MS
  );
  const reconnectBackoffMultiplier = Math.max(
    1,
    options.reconnectBackoffMultiplier ?? DEFAULT_RECONNECT_BACKOFF_MULTIPLIER
  );
  const reconnectJitterRatio = clamp(
    options.reconnectJitterRatio ?? DEFAULT_RECONNECT_JITTER_RATIO,
    0,
    1
  );
  const maxReconnectAttempts =
    options.maxReconnectAttempts == null
      ? null
      : Math.max(0, options.maxReconnectAttempts);

  return {
    autoReconnect: options.autoReconnect ?? true,
    reconnectInitialDelayMs,
    reconnectMaxDelayMs,
    reconnectBackoffMultiplier,
    reconnectJitterRatio,
    maxReconnectAttempts,
  };
}

export class RunelinkConnection {
  private url: string;
  private options: NormalizedRunelinkConnectionOptions;
  private ws: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private connectPromiseResolve: (() => void) | null = null;
  private connectPromiseReject: ((error: Error) => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private status: RunelinkConnectionStatus = "disconnected";
  private manualDisconnect = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private statusListeners = new Set<Listener<RunelinkConnectionStatus>>();
  private updateListeners = new Set<Listener<ClientWsUpdate>>();
  private errorListeners = new Set<Listener<Error>>();

  constructor(url: string, options: RunelinkConnectionOptions = {}) {
    this.url = url;
    this.options = normalizeOptions(options);
  }

  connect(): Promise<void> {
    this.manualDisconnect = false;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.setStatus("connected");
      return Promise.resolve();
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.clearReconnectTimer();
    const connectPromise = new Promise<void>((resolve, reject) => {
      this.connectPromiseResolve = resolve;
      this.connectPromiseReject = reject;
      this.openSocket();
    }).finally(() => {
      this.clearConnectPromise();
    });
    this.connectPromise = connectPromise;

    return connectPromise;
  }

  disconnect(): void {
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.rejectConnectPromise(
      new Error("WebSocket connection attempt cancelled")
    );
    this.rejectAllPendingRequests(
      new Error("WebSocket disconnected before a reply was received")
    );

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempt = 0;
    this.setStatus("disconnected");
  }

  async send(message: ClientWsRequest): Promise<ClientWsReply> {
    const result = ClientWsRequestSchema.safeParse(message);
    if (!result.success) {
      throw new Error(`Invalid message: ${formatZodError(result.error)}`);
    }

    await this.connect();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }

    const requestId = crypto.randomUUID();
    const envelope = ClientWsRequestEnvelopeSchema.parse({
      type: "request",
      data: {
        request_id: requestId,
        request: result.data,
      },
    });

    const ws = this.ws;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      try {
        ws.send(JSON.stringify(envelope));
      } catch (error) {
        this.pendingRequests.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  getStatus(): RunelinkConnectionStatus {
    return this.status;
  }

  subscribeStatus(listener: Listener<RunelinkConnectionStatus>): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  onUpdate(listener: Listener<ClientWsUpdate>): () => void {
    this.updateListeners.add(listener);
    return () => {
      this.updateListeners.delete(listener);
    };
  }

  onError(listener: Listener<Error>): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  private openSocket(): void {
    if (this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const ws = new WebSocket(this.url);
    let opened = false;

    this.ws = ws;
    this.setStatus(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");

    ws.onopen = () => {
      if (this.ws !== ws) return;
      opened = true;
      this.clearReconnectTimer();
      this.reconnectAttempt = 0;
      this.setStatus("connected");
      this.resolveConnectPromise();
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      this.handleMessage(event);
    };

    ws.onerror = (event) => {
      if (this.ws !== ws) return;
      this.emitError(new Error(`WebSocket error: ${event.type}`));
    };

    ws.onclose = (event) => {
      if (this.ws === ws) {
        this.ws = null;
      }

      if (this.manualDisconnect) {
        this.reconnectAttempt = 0;
        this.setStatus("disconnected");
        return;
      }

      const closeError = new Error(this.formatCloseReason(event));

      if (!opened) {
        if (this.shouldReconnect()) {
          this.emitError(closeError);
          this.scheduleReconnect();
          return;
        }
        this.reconnectAttempt = 0;
        this.setStatus("disconnected");
        this.rejectConnectPromise(closeError);
        return;
      }

      this.rejectAllPendingRequests(
        new Error("WebSocket connection closed before a reply was received")
      );
      this.emitError(closeError);

      if (this.shouldReconnect()) {
        this.scheduleReconnect();
        return;
      }

      this.reconnectAttempt = 0;
      this.setStatus("disconnected");
    };
  }

  private handleMessage(event: MessageEvent): void {
    const data = this.parseEventData(event);
    if (data === null) return;

    const result = IncomingEnvelopeSchema.safeParse(data);
    if (!result.success) {
      this.emitError(
        new Error(`Invalid message received: ${formatZodError(result.error)}`)
      );
      return;
    }

    const envelope = result.data;
    if (envelope.type === "update") {
      this.emitUpdate(envelope.data.update);
      return;
    }

    const requestId = envelope.data.request_id;
    const pendingRequest = requestId
      ? this.pendingRequests.get(requestId)
      : undefined;

    if (!requestId || !pendingRequest) {
      this.emitError(
        new Error(
          `Received ${envelope.type} for unknown request_id: ${String(requestId)}`
        )
      );
      return;
    }

    this.pendingRequests.delete(requestId);

    if (envelope.type === "reply") {
      pendingRequest.resolve(envelope.data.reply);
      return;
    }

    pendingRequest.reject(
      new RunelinkRequestError(
        envelope.data.error.code,
        envelope.data.error.message,
        envelope.data.error.details
      )
    );
  }

  private shouldReconnect(): boolean {
    if (!this.options.autoReconnect || this.manualDisconnect) {
      return false;
    }
    if (this.options.maxReconnectAttempts == null) {
      return true;
    }
    return this.reconnectAttempt < this.options.maxReconnectAttempts;
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectAttempt += 1;
    this.setStatus("reconnecting");
    const delayMs = this.calculateReconnectDelay(this.reconnectAttempt);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delayMs);
  }

  private calculateReconnectDelay(reconnectAttempt: number): number {
    const baseDelay = Math.min(
      this.options.reconnectInitialDelayMs *
        this.options.reconnectBackoffMultiplier **
          Math.max(0, reconnectAttempt - 1),
      this.options.reconnectMaxDelayMs
    );
    const jitter = baseDelay * this.options.reconnectJitterRatio;
    const minDelay = Math.max(0, baseDelay - jitter);
    const maxDelay = baseDelay + jitter;
    return Math.round(minDelay + Math.random() * (maxDelay - minDelay));
  }

  private parseEventData(event: MessageEvent): unknown | null {
    if (typeof event.data !== "string") {
      this.emitError(
        new Error(`Unsupported websocket message type: ${typeof event.data}`)
      );
      return null;
    }
    try {
      return JSON.parse(event.data);
    } catch (error) {
      this.emitError(
        new Error(
          `Failed to parse message: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      return null;
    }
  }

  private formatCloseReason(event: CloseEvent): string {
    const reason = event.reason.trim();
    if (reason.length > 0) {
      return `WebSocket closed (${event.code}): ${reason}`;
    }
    return `WebSocket closed (${event.code})`;
  }

  private setStatus(status: RunelinkConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  private emitUpdate(update: ClientWsUpdate): void {
    for (const listener of this.updateListeners) {
      listener(update);
    }
  }

  private emitError(error: Error): void {
    for (const listener of this.errorListeners) {
      listener(error);
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private resolveConnectPromise(): void {
    if (!this.connectPromiseResolve) return;
    this.connectPromiseResolve();
  }

  private rejectConnectPromise(error: Error): void {
    if (!this.connectPromiseReject) return;
    this.connectPromiseReject(error);
  }

  private clearConnectPromise(): void {
    this.connectPromise = null;
    this.connectPromiseResolve = null;
    this.connectPromiseReject = null;
  }

  private rejectAllPendingRequests(error: Error): void {
    for (const pendingRequest of this.pendingRequests.values()) {
      pendingRequest.reject(error);
    }
    this.pendingRequests.clear();
  }
}
