import * as Schema from "effect/Schema";

// The fields of an error reply from the host
const hostErrorFields = {
  // Written by the host for people to read
  hostMessage: Schema.String,
  details: Schema.Unknown,
};

/**
 * The host did not authenticate the connection, or did not allow the request,
 * such as an action that needs a server admin (`auth_error`).
 */
export class RunelinkAuthError extends Schema.TaggedError<RunelinkAuthError>()(
  "RunelinkAuthError",
  hostErrorFields
) {
  override get message(): string {
    return this.hostMessage;
  }
}

/** The host rejected the request as invalid (`bad_request`). */
export class RunelinkBadRequestError extends Schema.TaggedError<RunelinkBadRequestError>()(
  "RunelinkBadRequestError",
  hostErrorFields
) {
  override get message(): string {
    return this.hostMessage;
  }
}

/** A resource the request names does not exist (`not_found`). */
export class RunelinkNotFoundError extends Schema.TaggedError<RunelinkNotFoundError>()(
  "RunelinkNotFoundError",
  hostErrorFields
) {
  override get message(): string {
    return this.hostMessage;
  }
}

/**
 * The request conflicts with the resource's current state, such as an edit of
 * an outdated version or a duplicate (`conflict`).
 */
export class RunelinkConflictError extends Schema.TaggedError<RunelinkConflictError>()(
  "RunelinkConflictError",
  hostErrorFields
) {
  override get message(): string {
    return this.hostMessage;
  }
}

/**
 * The host could not complete the request, such as when a peer host is
 * unavailable (`internal_error`), or replied with an error `code` this SDK
 * does not know.
 */
export class RunelinkInternalError extends Schema.TaggedError<RunelinkInternalError>()(
  "RunelinkInternalError",
  { code: Schema.String, ...hostErrorFields }
) {
  override get message(): string {
    return this.hostMessage;
  }
}

/**
 * The host replied to a request with an error carrying its `hostMessage` and
 * `details`. An `unsupported_capability` reply is a
 * `RunelinkUnsupportedCapabilityError` instead.
 */
export type RunelinkHostError =
  | RunelinkAuthError
  | RunelinkBadRequestError
  | RunelinkNotFoundError
  | RunelinkConflictError
  | RunelinkInternalError;

/**
 * The host rejected capability negotiation, or this client rejected the host's
 * reply. Reconnecting will not help until one side is updated, so automatic
 * reconnection stops.
 */
export class RunelinkIncompatibleHostError extends Schema.TaggedError<RunelinkIncompatibleHostError>()(
  "RunelinkIncompatibleHostError",
  {
    // The host, or for URL connections the redacted websocket URL
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
    // The host, or for URL connections the redacted websocket URL
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
    // What failed without a close frame, or for a URL with secrets, only its
    // phase and error name
    cause: Schema.optional(Schema.Defect()),
  }
) {
  override get message(): string {
    const suffix = this.reason.length > 0 ? `: ${this.reason}` : "";
    return `WebSocket closed (${this.code})${suffix}`;
  }
}

/**
 * `disconnect` cancelled the connection attempt or request, or there was no
 * connection to send the request on.
 */
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
  | RunelinkHostError
  | RunelinkUnsupportedCapabilityError
  | RunelinkInvalidRequestError
  | RunelinkProtocolError;

/** Problems reported on the `errors` stream, outside of any one request. */
export type RunelinkConnectionIssue =
  | RunelinkConnectionError
  | RunelinkIncompatibleHostError
  | RunelinkProtocolError;
