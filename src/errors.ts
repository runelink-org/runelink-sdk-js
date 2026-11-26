import * as Schema from "effect/Schema";

/** The host replied to a request with an error. */
export class RunelinkRequestError extends Schema.TaggedError<RunelinkRequestError>()(
  "RunelinkRequestError",
  {
    code: Schema.String,
    hostMessage: Schema.String,
    details: Schema.Unknown,
  }
) {
  override get message(): string {
    const suffix =
      this.details == null ? "" : ` (${JSON.stringify(this.details)})`;
    return `[${this.code}] ${this.hostMessage}${suffix}`;
  }
}

/**
 * The host rejected capability negotiation, or this client rejected the host's
 * reply. Reconnecting will not help until one side is updated, so automatic
 * reconnection stops.
 */
export class RunelinkIncompatibleHostError extends Schema.TaggedError<RunelinkIncompatibleHostError>()(
  "RunelinkIncompatibleHostError",
  {
    // The host, or the websocket URL for URL connections
    host: Schema.String,
    reason: Schema.String,
  }
) {
  override get message(): string {
    const suffix = this.reason.length > 0 ? `: ${this.reason}` : "";
    return `${this.host} is incompatible with this client${suffix}`;
  }
}

/**
 * A request needs a capability that this client does not offer, or that the
 * host did not agree to. It fails without closing the connection.
 */
export class RunelinkUnsupportedCapabilityError extends Schema.TaggedError<RunelinkUnsupportedCapabilityError>()(
  "RunelinkUnsupportedCapabilityError",
  {
    host: Schema.String,
    capability: Schema.String,
    // Why the host did not agree to it, or omitted when this client lacks it
    issue: Schema.optional(Schema.String),
  }
) {
  override get message(): string {
    return this.issue === undefined
      ? `This client does not support the ${this.capability} capability`
      : `${this.host}: ${this.issue}`;
  }
}

/** The websocket closed or could not open. */
export class RunelinkConnectionError extends Schema.TaggedError<RunelinkConnectionError>()(
  "RunelinkConnectionError",
  {
    code: Schema.Number,
    reason: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  }
) {
  override get message(): string {
    const suffix = this.reason.length > 0 ? `: ${this.reason}` : "";
    return `WebSocket closed (${this.code})${suffix}`;
  }
}

/** `disconnect` cancelled the connection attempt or request. */
export class RunelinkDisconnectedError extends Schema.TaggedError<RunelinkDisconnectedError>()(
  "RunelinkDisconnectedError",
  {}
) {
  override get message(): string {
    return "WebSocket disconnected";
  }
}

/** The host sent a message this client cannot use. */
export class RunelinkProtocolError extends Schema.TaggedError<RunelinkProtocolError>()(
  "RunelinkProtocolError",
  {
    reason: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  }
) {
  override get message(): string {
    return this.reason;
  }
}

/** A request failed validation before it was sent. */
export class RunelinkInvalidRequestError extends Schema.TaggedError<RunelinkInvalidRequestError>()(
  "RunelinkInvalidRequestError",
  {
    requestType: Schema.String,
    cause: Schema.Defect(),
  }
) {
  override get message(): string {
    return `Invalid ${this.requestType} request`;
  }
}

/** Why `connect` failed. */
export type RunelinkConnectError =
  | RunelinkConnectionError
  | RunelinkIncompatibleHostError
  | RunelinkDisconnectedError;

/** Why a request failed. */
export type RunelinkRequestFailure =
  | RunelinkConnectError
  | RunelinkRequestError
  | RunelinkUnsupportedCapabilityError
  | RunelinkInvalidRequestError
  | RunelinkProtocolError;

/** Problems reported on the `errors` stream, outside of any one request. */
export type RunelinkConnectionIssue =
  | RunelinkConnectionError
  | RunelinkIncompatibleHostError
  | RunelinkProtocolError;
