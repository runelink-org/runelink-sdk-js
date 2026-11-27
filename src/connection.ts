import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FiberHandle from "effect/FiberHandle";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Random from "effect/Random";
import * as Result from "effect/Result";
import * as Scheduler from "effect/Scheduler";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as Socket from "effect/socket/Socket";
import {
  CLIENT_WS_SUPPORTED_CAPABILITIES,
  NEGOTIATION_VERSION,
  type CapabilityIssue,
  type NegotiatedCapabilities,
  type SupportedCapabilities,
  SupportedCapabilitiesSchema,
  describeCapabilityIssue,
  requestCapability,
  updateCapability,
} from "./capability.js";
import {
  RunelinkAuthError,
  RunelinkBadRequestError,
  RunelinkConflictError,
  RunelinkConnectionError,
  RunelinkDisconnectedError,
  RunelinkIncompatibleHostError,
  RunelinkInternalError,
  RunelinkInvalidRequestError,
  RunelinkNotFoundError,
  RunelinkProtocolError,
  RunelinkUnsupportedCapabilityError,
  type RunelinkConnectError,
  type RunelinkConnectionIssue,
  type RunelinkHostError,
  type RunelinkRequestFailure,
} from "./errors.js";
import {
  REPLY_TYPE_BY_REQUEST_TYPE,
  type ReplyFor,
  type WsError,
  type WsReply,
  type WsRequest,
  type WsUpdate,
  WsErrorEnvelopeSchema,
  WsHelloEnvelopeSchema,
  WsReplyEnvelopeSchema,
  WsRequestEnvelopeSchema,
  WsUpdateEnvelopeSchema,
  WsWelcomeEnvelopeSchema,
} from "./protocol.js";
import { getWsUrl } from "./util.js";

const DEFAULT_RECONNECT_INITIAL_DELAY_MS = 1_000;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 30_000;
const DEFAULT_RECONNECT_BACKOFF_MULTIPLIER = 2;
const DEFAULT_RECONNECT_JITTER_RATIO = 0.2;
const NEGOTIATION_TIMEOUT = "5 seconds";
// Close code the host sends when capability negotiation fails
const PROTOCOL_ERROR_CLOSE_CODE = 1002;
// Close code browsers report for sockets that fail without a close frame
const ABNORMAL_CLOSE_CODE = 1006;

const decodeRequestEnvelope = Schema.decodeUnknownEffect(
  WsRequestEnvelopeSchema
);
const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));
const encodeHello = Schema.encodeEffect(
  Schema.fromJsonString(WsHelloEnvelopeSchema)
);
const decodeWelcome = Schema.decodeUnknownOption(
  Schema.fromJsonString(WsWelcomeEnvelopeSchema)
);
const decodeIncoming = Schema.decodeUnknownEffect(
  Schema.fromJsonString(
    Schema.Union([
      WsReplyEnvelopeSchema,
      WsErrorEnvelopeSchema,
      WsUpdateEnvelopeSchema,
    ])
  )
);
const decodeSupportedCapabilities = Schema.decodeUnknownSync(
  SupportedCapabilitiesSchema
);

export type Status =
  "disconnected" | "connecting" | "connected" | "reconnecting";

export type Options = (
  | {
      /** Connects to the host's client websocket, trying `wss` first. */
      readonly host: string;
      readonly url?: undefined;
    }
  | {
      /** Connects to this websocket URL directly. */
      readonly url: string;
      readonly host?: undefined;
    }
) & {
  readonly autoReconnect?: boolean;
  readonly reconnectInitialDelayMs?: number;
  readonly reconnectMaxDelayMs?: number;
  readonly reconnectBackoffMultiplier?: number;
  readonly reconnectJitterRatio?: number;
  readonly maxReconnectAttempts?: number | null;
  /** Whether a host connection may fall back to `ws` if `wss` never opens. */
  readonly transportSecurity?: "secure-only" | "prefer-secure";
  readonly capabilities?: SupportedCapabilities;
};

export type RequestOptions = {
  /**
   * Whether to connect if needed. When false, the request is sent only on the
   * socket that is connected when it starts, and fails with
   * `RunelinkDisconnectedError` if there is none or it has been replaced.
   */
  readonly connect?: boolean;
};

export class RunelinkConnection extends Context.Service<
  RunelinkConnection,
  {
    /**
     * Opens the websocket if needed and waits for capability negotiation.
     * While reconnecting is allowed, it waits through failed attempts.
     */
    readonly connect: Effect.Effect<void, RunelinkConnectError>;
    /** Closes the websocket, stops reconnecting, and fails waiting calls. */
    readonly disconnect: Effect.Effect<void>;
    /**
     * Connects if needed, unless `options.connect` is false, then sends a
     * validated request and waits for its reply.
     */
    readonly request: <Request extends WsRequest>(
      request: Request,
      options?: RequestOptions
    ) => Effect.Effect<ReplyFor<Request["type"]>, RunelinkRequestFailure>;
    readonly status: Effect.Effect<Status>;
    /** The current status, then each change. */
    readonly statusChanges: Stream.Stream<Status>;
    /**
     * Updates the host pushes from the time the stream starts, across
     * reconnects. Fork consumers with `startImmediately: true` to subscribe
     * before the fork returns.
     */
    readonly updates: Stream.Stream<WsUpdate>;
    /** Problems outside of any one request, such as closes and bad messages. */
    readonly errors: Stream.Stream<RunelinkConnectionIssue>;
    /**
     * Offered capabilities the host did not agree to, or none until
     * negotiation completes.
     */
    readonly capabilityIssues: Effect.Effect<
      Option.Option<ReadonlyArray<CapabilityIssue>>
    >;
  }
>()("@runelink/sdk/RunelinkConnection") {}

type Session = {
  readonly negotiated: NegotiatedCapabilities;
  readonly rejected: SupportedCapabilities | null;
  // Requests awaiting replies. Abandoned requests stay as `null` so their late
  // replies are not reported as unknown.
  readonly pending: Map<string, Deferred.Deferred<WsReply, WsError> | null>;
  readonly write: (text: string) => Effect.Effect<void, Socket.SocketError>;
  // Fails with why the session ended, once the next status is published,
  // since failing resumes the requests' handlers inline
  readonly released: Release;
};

type Release = Deferred.Deferred<never, RunelinkConnectError>;

// How a socket attempt ended
type AttemptEnd = {
  readonly opened: boolean;
  readonly error: RunelinkConnectionError | RunelinkIncompatibleHostError;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeOptions(options: Options) {
  const reconnectInitialDelayMs = Math.max(
    0,
    options.reconnectInitialDelayMs ?? DEFAULT_RECONNECT_INITIAL_DELAY_MS
  );
  const capabilities = Object.fromEntries(
    Object.entries(
      decodeSupportedCapabilities(
        options.capabilities ?? CLIENT_WS_SUPPORTED_CAPABILITIES
      )
    ).filter(([, versions]) => versions.length > 0)
  );
  for (const [capability, versions] of Object.entries(capabilities)) {
    const implementedVersions = CLIENT_WS_SUPPORTED_CAPABILITIES[capability];
    if (
      implementedVersions === undefined ||
      versions.some((version) => !implementedVersions.includes(version))
    ) {
      throw new Error(
        `Capability ${capability} includes a version not implemented by this SDK`
      );
    }
  }
  return {
    autoReconnect: options.autoReconnect ?? true,
    reconnectInitialDelayMs,
    reconnectMaxDelayMs: Math.max(
      reconnectInitialDelayMs,
      options.reconnectMaxDelayMs ?? DEFAULT_RECONNECT_MAX_DELAY_MS
    ),
    reconnectBackoffMultiplier: Math.max(
      1,
      options.reconnectBackoffMultiplier ?? DEFAULT_RECONNECT_BACKOFF_MULTIPLIER
    ),
    reconnectJitterRatio: clamp(
      options.reconnectJitterRatio ?? DEFAULT_RECONNECT_JITTER_RATIO,
      0,
      1
    ),
    maxReconnectAttempts:
      options.maxReconnectAttempts == null
        ? null
        : Math.max(0, options.maxReconnectAttempts),
    transportSecurity: options.transportSecurity ?? "prefer-secure",
    capabilities,
  };
}

function connectionError(error: Socket.SocketError): RunelinkConnectionError {
  return error.reason._tag === "SocketCloseError"
    ? new RunelinkConnectionError({
        code: error.reason.code,
        reason: error.reason.closeReason?.trim() ?? "",
      })
    : new RunelinkConnectionError({
        code: ABNORMAL_CLOSE_CODE,
        reason: "",
        cause: error,
      });
}

/** The error for a host's error reply, by its code. */
function hostError(
  error: WsError,
  host: string,
  capability: string
): RunelinkHostError | RunelinkUnsupportedCapabilityError {
  const fields = { hostMessage: error.message, details: error.details };
  switch (error.code) {
    case "auth_error":
      return new RunelinkAuthError(fields);
    case "bad_request":
      return new RunelinkBadRequestError(fields);
    case "not_found":
      return new RunelinkNotFoundError(fields);
    case "conflict":
      return new RunelinkConflictError(fields);
    case "unsupported_capability":
      return new RunelinkUnsupportedCapabilityError({
        host,
        capability,
        issue: error.message,
      });
    default:
      return new RunelinkInternalError({ code: error.code, ...fields });
  }
}

/** Whether a welcome agrees to and resolves exactly the offered capabilities. */
function isValidWelcome(
  offered: SupportedCapabilities,
  agreed: NegotiatedCapabilities,
  rejected: SupportedCapabilities | undefined
): boolean {
  if (
    !Object.entries(agreed).every(
      ([id, version]) =>
        Object.hasOwn(offered, id) && offered[id].includes(version)
    )
  ) {
    return false;
  }
  // New hosts must resolve every offer exactly once. Legacy hosts omit the
  // entire field, so omission cannot be mistaken for missing support.
  if (rejected === undefined) return true;
  const unagreed = Object.keys(offered).filter(
    (id) => !Object.hasOwn(agreed, id)
  );
  return (
    Object.keys(rejected).length === unagreed.length &&
    unagreed.every(
      (id) =>
        Object.hasOwn(rejected, id) &&
        !rejected[id].some((version) => offered[id].includes(version))
    )
  );
}

/** Creates a connection that disconnects when its scope closes. */
export const make = Effect.fn("RunelinkConnection.make")(function* (
  options: Options
) {
  const config = normalizeOptions(options);
  const host = options.host ?? options.url;
  const webSocketConstructor = yield* Socket.WebSocketConstructor;
  const status = yield* SubscriptionRef.make<Status>("disconnected");
  const updates = yield* PubSub.unbounded<WsUpdate>();
  const issues = yield* PubSub.unbounded<RunelinkConnectionIssue>();
  // The supervisor's handle closes in the connection's own finalizer, after
  // `disconnect`, whatever the outer scope's finalizer strategy
  const loopScope = yield* Scope.make();
  const loop = yield* FiberHandle.make<void>().pipe(Scope.provide(loopScope));
  const turns = yield* Semaphore.make(1);
  const closed = yield* Deferred.make<void>();

  // The negotiated session, if any
  let session: Session | undefined;
  // Callers waiting for the next negotiation, if any
  let ready: Deferred.Deferred<void, RunelinkConnectError> | undefined;
  let looping = false;
  // Connecting outside of a dial completes this, which skips the next reconnect
  // delay. Connecting during a dial joins it, as the old SDK did.
  let wake = Deferred.makeUnsafe<void>();
  let dialing = false;
  let activeUrl = options.url ?? getWsUrl(options.host, true);
  // Host connections may fall back to this if the secure socket never opens
  const insecureUrl =
    options.host !== undefined && config.transportSecurity === "prefer-secure"
      ? getWsUrl(options.host, false)
      : undefined;
  // Attempts' releases that the supervisor has not completed yet, with the
  // error each attempt ended with, if it has
  const unreleased = new Map<Release, RunelinkConnectError | undefined>();
  let hasConnectedOnce = false;
  let reconnectAttempt = 0;

  function settleReady(exit: Exit.Exit<void, RunelinkConnectError>): void {
    const waiting = ready;
    ready = undefined;
    if (waiting !== undefined) Deferred.doneUnsafe(waiting, exit);
  }

  function shouldReconnect(): boolean {
    return (
      config.autoReconnect &&
      (config.maxReconnectAttempts === null ||
        reconnectAttempt < config.maxReconnectAttempts)
    );
  }

  function issueFor(active: Session, capability: string): CapabilityIssue {
    return describeCapabilityIssue(
      capability,
      config.capabilities[capability],
      active.rejected?.[capability] ?? null
    );
  }

  // Untraced: it runs for every frame.
  const handleFrame = Effect.fnUntraced(function* (
    active: Session,
    frame: string | Uint8Array
  ) {
    if (typeof frame !== "string") {
      return yield* PubSub.publish(
        issues,
        new RunelinkProtocolError({
          reason: "Unsupported websocket message type: binary",
        })
      );
    }
    const decoded = yield* Effect.result(decodeIncoming(frame));
    if (Result.isFailure(decoded)) {
      return yield* PubSub.publish(
        issues,
        new RunelinkProtocolError({
          reason: "Invalid message received",
          cause: decoded.failure,
        })
      );
    }
    const envelope = decoded.success;
    if (envelope.type === "update") {
      const capability = updateCapability(envelope.data.update);
      if (
        active.negotiated[capability] !==
        CLIENT_WS_SUPPORTED_CAPABILITIES[capability][0]
      ) {
        return yield* PubSub.publish(
          issues,
          new RunelinkProtocolError({
            reason: `Received update for unnegotiated capability ${capability}`,
          })
        );
      }
      return yield* PubSub.publish(updates, envelope.data.update);
    }
    const requestId = envelope.data.request_id;
    const pending =
      requestId === null ? undefined : active.pending.get(requestId);
    if (requestId === null || pending === undefined) {
      return yield* PubSub.publish(
        issues,
        new RunelinkProtocolError({
          reason: `Received ${envelope.type} for unknown request_id: ${String(requestId)}`,
        })
      );
    }
    // Removing and settling in one step, so an interruption cannot drop it
    active.pending.delete(requestId);
    if (pending === null) return;
    Deferred.doneUnsafe(
      pending,
      envelope.type === "reply"
        ? Exit.succeed(envelope.data.reply)
        : Exit.fail(envelope.data.error)
    );
  });

  // One socket, from opening through negotiation until it closes
  const runAttempt = Effect.fnUntraced(function* (
    url: string,
    released: Release
  ): Effect.fn.Return<never, AttemptEnd, Scope.Scope> {
    const socket = yield* Socket.makeWebSocket(url, {
      // Opening is left to the transport, which has its own timeout
      openTimeout: Duration.infinity,
    }).pipe(
      Effect.provideService(Socket.WebSocketConstructor, webSocketConstructor)
    );
    const reader = yield* socket.reader.pipe(
      // Effect's socket can miss `open` if it yields between checking
      // `readyState` and adding its listener
      Effect.provideService(Scheduler.PreventSchedulerYield, true),
      Effect.mapError((error): AttemptEnd => ({
        opened: false,
        error: connectionError(error),
      }))
    );
    const writer = yield* socket.writer;
    const closed = (error: Socket.SocketError): AttemptEnd => ({
      opened: true,
      error: connectionError(error),
    });
    const incompatible = (reason: string): AttemptEnd => ({
      opened: true,
      error: new RunelinkIncompatibleHostError({ host, reason }),
    });
    // A 1002 only means an incompatible host during negotiation. Later, it is
    // an ordinary protocol error that reconnecting can recover from.
    const negotiationClosed = (error: Socket.SocketError): AttemptEnd =>
      error.reason._tag === "SocketCloseError" &&
      error.reason.code === PROTOCOL_ERROR_CLOSE_CODE
        ? incompatible(error.reason.closeReason?.trim() ?? "")
        : closed(error);
    // Tells the host why this client is closing and fails once the socket
    // closes, as the old SDK did before dialing again
    const closeWith = (reason: string) =>
      writer
        .write(new Socket.CloseEvent(1000, reason))
        .pipe(
          Effect.ignore,
          Effect.andThen(reader.pull.pipe(Effect.forever)),
          Effect.mapError(negotiationClosed)
        );

    const hello = yield* encodeHello({
      type: "hello",
      data: {
        negotiation_version: NEGOTIATION_VERSION,
        capabilities: config.capabilities,
      },
    }).pipe(Effect.orDie);
    yield* writer.write(hello).pipe(Effect.mapError(closed));
    const [welcome, ...frames] = yield* reader.pull.pipe(
      Effect.mapError(negotiationClosed),
      Effect.timeoutOrElse({
        duration: NEGOTIATION_TIMEOUT,
        // A slow host is not evidence of incompatibility, so this ends with
        // however the socket closes, normally following the reconnect path
        orElse: () => closeWith("Capability negotiation timed out"),
      })
    );
    const accepted =
      typeof welcome === "string"
        ? Option.getOrUndefined(decodeWelcome(welcome))?.data
        : undefined;
    if (
      accepted === undefined ||
      !isValidWelcome(
        config.capabilities,
        accepted.capabilities,
        accepted.rejected_capabilities
      )
    ) {
      yield* Effect.ignore(
        closeWith("Invalid capability negotiation response")
      );
      return yield* Effect.fail(
        incompatible("Invalid capability negotiation response")
      );
    }

    const active: Session = {
      negotiated: accepted.capabilities,
      rejected: accepted.rejected_capabilities ?? null,
      pending: new Map(),
      write: writer.write,
      released,
    };
    return yield* Effect.gen(function* () {
      dialing = false;
      hasConnectedOnce = true;
      reconnectAttempt = 0;
      // Installing the session as `connected` is published, so subscribers
      // see both together
      yield* SubscriptionRef.modify(status, (): [void, Status] => {
        session = active;
        return [undefined, "connected"];
      });
      settleReady(Exit.void);
      // The frames that arrived with the welcome are the first batch
      let batch: ReadonlyArray<string | Uint8Array> = frames;
      while (true) {
        for (const frame of batch) yield* handleFrame(active, frame);
        batch = yield* reader.pull.pipe(Effect.mapError(closed));
      }
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          if (session === active) session = undefined;
          active.pending.clear();
        })
      )
    );
  });

  const waitToReconnect = Effect.fnUntraced(function* (release: () => void) {
    reconnectAttempt += 1;
    yield* SubscriptionRef.set(
      status,
      hasConnectedOnce ? "reconnecting" : "connecting"
    );
    release();
    const baseDelay = Math.min(
      config.reconnectInitialDelayMs *
        config.reconnectBackoffMultiplier ** (reconnectAttempt - 1),
      config.reconnectMaxDelayMs
    );
    const jitter = baseDelay * config.reconnectJitterRatio;
    const minDelay = Math.max(0, baseDelay - jitter);
    const delay = Math.round(
      minDelay + (yield* Random.next) * (baseDelay + jitter - minDelay)
    );
    yield* Effect.sleep(delay).pipe(Effect.raceFirst(Deferred.await(wake)));
  });

  // Reports `disconnected` and, in the same step, either keeps the supervisor
  // for a caller that connected after the last attempt (returning true) or
  // retires it, so no caller or replacement supervisor can slip in between.
  // Waiters fail after the report, since failing resumes them inline.
  const retire = (
    error: RunelinkConnectError,
    canRedial: boolean,
    release: () => void
  ) =>
    SubscriptionRef.modify(status, (): [typeof ready | "redial", Status] => {
      reconnectAttempt = 0;
      if (canRedial && Deferred.isDoneUnsafe(wake)) {
        return ["redial", "disconnected"];
      }
      looping = false;
      wake = Deferred.makeUnsafe();
      const waiting = ready;
      ready = undefined;
      return [waiting, "disconnected"];
    }).pipe(
      Effect.map((waiting) => {
        release();
        if (waiting === "redial") return true;
        if (waiting !== undefined)
          Deferred.doneUnsafe(waiting, Exit.fail(error));
        return false;
      }),
      Effect.uninterruptible
    );

  // Decides what follows an attempt, returning whether to dial again
  const afterAttempt = Effect.fnUntraced(function* (
    end: AttemptEnd,
    release: () => void
  ) {
    if (!end.opened && insecureUrl !== undefined && activeUrl !== insecureUrl) {
      activeUrl = insecureUrl;
      return true;
    }
    const retry =
      end.error._tag === "RunelinkConnectionError" && shouldReconnect();
    yield* PubSub.publish(issues, end.error);
    if (retry) {
      yield* waitToReconnect(release);
      return true;
    }
    // A call that failed with this socket may have already connected again
    if (!(yield* retire(end.error, true, release))) return false;
    yield* SubscriptionRef.set(status, "connecting");
    return true;
  });

  // The sole owner of reconnects, running until it gives up or is interrupted
  const supervise = Effect.gen(function* () {
    yield* SubscriptionRef.set(status, "connecting");
    let again = true;
    while (again) {
      wake = Deferred.makeUnsafe();
      dialing = true;
      const released: Release = Deferred.makeUnsafe();
      unreleased.set(released, undefined);
      const release = (error: RunelinkConnectError) => {
        unreleased.delete(released);
        Deferred.doneUnsafe(released, Exit.fail(error));
      };
      again = yield* Effect.gen(function* () {
        const end = yield* Effect.flip(
          Effect.scoped(runAttempt(activeUrl, released))
        );
        dialing = false;
        unreleased.set(released, end.error);
        return yield* afterAttempt(end, () => release(end.error));
      }).pipe(
        // `disconnect` releases interrupted attempts after publishing its status
        Effect.onExit((exit) =>
          Exit.hasInterrupts(exit)
            ? Effect.void
            : Effect.sync(() => release(new RunelinkDisconnectedError()))
        )
      );
    }
  }).pipe(
    // A defect, such as the socket constructor rejecting the URL, also ends it
    Effect.catchDefect((cause) => {
      const error = new RunelinkConnectionError({
        code: ABNORMAL_CLOSE_CODE,
        reason: "",
        cause,
      });
      return PubSub.publish(issues, error).pipe(
        Effect.andThen(retire(error, false, () => {}))
      );
    })
  );

  // Starting the supervisor and disconnecting take turns, and only the wait
  // for negotiation is interruptible, so neither can strand the other
  const connect: Effect.Effect<void, RunelinkConnectError> =
    Effect.uninterruptibleMask((restore) =>
      Effect.suspend(() => {
        if (Deferred.isDoneUnsafe(closed)) {
          return Effect.fail(new RunelinkDisconnectedError());
        }
        if (session !== undefined) return Effect.succeed(undefined);
        if (ready === undefined) {
          ready = Deferred.makeUnsafe();
          if (looping && !dialing) Deferred.doneUnsafe(wake, Exit.void);
        }
        const waiting = ready;
        if (looping) return Effect.succeed(waiting);
        looping = true;
        return FiberHandle.run(loop, supervise).pipe(Effect.as(waiting));
      }).pipe(
        Semaphore.withPermit(turns),
        Effect.flatMap((waiting) =>
          waiting === undefined ? Effect.void : restore(Deferred.await(waiting))
        )
      )
    ).pipe(Effect.withSpan("RunelinkConnection.connect"));

  // Stops the supervisor first so it cannot publish afterwards, and publishes
  // `disconnected` before failing anything
  const disconnect = Effect.gen(function* () {
    yield* FiberHandle.clear(loop);
    looping = false;
    dialing = false;
    reconnectAttempt = 0;
    wake = Deferred.makeUnsafe();
    const waiting = ready;
    ready = undefined;
    yield* SubscriptionRef.set(status, "disconnected");
    for (const [released, error] of unreleased) {
      Deferred.doneUnsafe(
        released,
        Exit.fail(error ?? new RunelinkDisconnectedError())
      );
    }
    unreleased.clear();
    if (waiting !== undefined) {
      Deferred.doneUnsafe(waiting, Exit.fail(new RunelinkDisconnectedError()));
    }
  }).pipe(
    Semaphore.withPermit(turns),
    Effect.uninterruptible,
    Effect.withSpan("RunelinkConnection.disconnect")
  );
  // Closing the scope disposes of the connection and ends its streams
  yield* Effect.addFinalizer(() =>
    Deferred.succeed(closed, undefined).pipe(
      Effect.andThen(disconnect),
      Effect.andThen(Scope.close(loopScope, Exit.void)),
      Effect.andThen(PubSub.shutdown(status.pubsub)),
      Effect.andThen(PubSub.shutdown(updates)),
      Effect.andThen(PubSub.shutdown(issues))
    )
  );

  const sendRequest = Effect.fn("RunelinkConnection.request")(function* (
    input: WsRequest,
    options?: RequestOptions
  ): Effect.fn.Return<WsReply, RunelinkRequestFailure> {
    // A request that does not connect stays on the socket connected when it
    // starts
    const initial = session;
    const invalid = (cause: Schema.SchemaError) =>
      new RunelinkInvalidRequestError({
        requestType: String(input?.type),
        cause,
      });
    const requestId = crypto.randomUUID();
    const envelope = yield* decodeRequestEnvelope({
      type: "request",
      data: { request_id: requestId, request: input },
    }).pipe(Effect.mapError(invalid));
    const request = envelope.data.request;
    // Serialized before connecting, so later changes to the input are not sent
    const text = yield* encodeJson(envelope).pipe(Effect.mapError(invalid));
    if (options?.connect !== false) {
      yield* connect;
    } else if (session !== initial || Deferred.isDoneUnsafe(closed)) {
      return yield* new RunelinkDisconnectedError();
    }
    const active = session;
    if (active === undefined) return yield* new RunelinkDisconnectedError();

    const capability = requestCapability(request);
    const version = CLIENT_WS_SUPPORTED_CAPABILITIES[capability][0];
    if (
      version === undefined ||
      !config.capabilities[capability]?.includes(version)
    ) {
      return yield* new RunelinkUnsupportedCapabilityError({
        host,
        capability,
      });
    }
    if (active.negotiated[capability] !== version) {
      return yield* new RunelinkUnsupportedCapabilityError({
        host,
        capability,
        issue: issueFor(active, capability).message,
      });
    }

    const deferred = yield* Deferred.make<WsReply, WsError>();
    const replied = Deferred.await(deferred).pipe(
      Effect.mapError((error) => hostError(error, host, capability))
    );
    const reply = yield* Effect.acquireUseRelease(
      Effect.sync(() => active.pending.set(requestId, deferred)),
      // The reply or the session's release settles the request. A failed
      // write means the socket closed, which the release reports, and a write
      // can also wait forever on a closed socket.
      () =>
        Effect.raceAllFirst([
          active.write(text).pipe(Effect.ignore, Effect.andThen(Effect.never)),
          replied,
          Deferred.await(active.released).pipe(
            // A reply routed before the release still counts
            Effect.catch((error) =>
              Deferred.isDoneUnsafe(deferred)
                ? replied
                : Effect.fail<RunelinkRequestFailure>(error)
            )
          ),
        ]),
      (_, exit) =>
        Effect.sync(() => {
          if (Exit.hasInterrupts(exit) && active.pending.has(requestId)) {
            active.pending.set(requestId, null);
          } else {
            active.pending.delete(requestId);
          }
        })
    );
    const expected = REPLY_TYPE_BY_REQUEST_TYPE[request.type];
    if (reply.type !== expected) {
      return yield* new RunelinkProtocolError({
        reason: `Unexpected reply type for ${request.type}: expected ${expected}, received ${reply.type}`,
      });
    }
    return reply;
  });

  return RunelinkConnection.of({
    connect,
    disconnect,
    // The reply type was checked against the request type above.
    request: sendRequest as RunelinkConnection["Service"]["request"],
    status: SubscriptionRef.get(status),
    statusChanges: SubscriptionRef.changes(status).pipe(Stream.changes),
    updates: Stream.fromPubSub(updates),
    errors: Stream.fromPubSub(issues),
    capabilityIssues: Effect.sync(() =>
      Option.map(Option.fromUndefinedOr(session), (active) =>
        Object.keys(config.capabilities)
          .filter((id) => !Object.hasOwn(active.negotiated, id))
          .map((capability) => issueFor(active, capability))
      )
    ),
  });
});

export const layer = (options: Options) =>
  Layer.effect(RunelinkConnection, make(options));
