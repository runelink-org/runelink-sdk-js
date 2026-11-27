import assert from "node:assert/strict";
import { inspect } from "node:util";
import { it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Socket from "effect/socket/Socket";
import * as Stream from "effect/Stream";
import {
  describeCapabilityIssue,
  RunelinkConnection,
  WsRequestEnvelopeSchema,
  type RunelinkConnectionIssue,
} from "../src/index.ts";

const v1 = "2026.10.16",
  v2 = "2026.10.17",
  v3 = "2026.10.18";
it("capability diagnostics distinguish missing, legacy, age, mixed, and empty offers", () => {
  for (const [offered, supported, reason] of [
    [[v2], null, "unknown"],
    [[v2], [], "missing"],
    [[v2], [v1], "outdated-host"],
    [[v1], [v2], "outdated-client"],
    [[v2], [v1, v3], "incompatible"],
    [[], [v1], "incompatible"],
    [["2026.10.16.10"], ["2026.10.16.2"], "outdated-host"],
  ] as const)
    assert.equal(
      describeCapabilityIssue("messages.read", offered, supported).reason,
      reason
    );
});

// Exercise real connection lifecycle with controlled wire messages: the fake
// host opens, then answers the hello with `welcome`.
const decodeRequest = Schema.decodeUnknownOption(
  Schema.fromJsonString(WsRequestEnvelopeSchema)
);

class FakeSocket extends EventTarget {
  static last: FakeSocket;
  readonly welcome: object;
  readyState = 0;
  requests: string[] = [];
  constructor(welcome: object) {
    super();
    FakeSocket.last = this;
    this.welcome = welcome;
    queueMicrotask(() => {
      this.readyState = 1;
      this.dispatchEvent(new Event("open"));
    });
  }
  send(text: string | Uint8Array<ArrayBuffer>) {
    const raw =
      typeof text === "string" ? text : new TextDecoder().decode(text);
    const request = decodeRequest(raw);
    if (Option.isSome(request)) {
      this.requests.push(request.value.data.request_id);
      return;
    }
    const message: unknown = JSON.parse(raw);
    if (
      typeof message !== "object" ||
      message === null ||
      !("type" in message) ||
      message.type !== "hello"
    )
      return;
    const data = JSON.stringify({ type: "welcome", data: this.welcome });
    queueMicrotask(() =>
      this.dispatchEvent(Object.assign(new Event("message"), { data }))
    );
  }
  reply(requestId: string | undefined, reply: object) {
    const data = JSON.stringify({
      type: "reply",
      data: { request_id: requestId, event_id: requestId, reply },
    });
    this.dispatchEvent(Object.assign(new Event("message"), { data }));
  }
  error(requestId: string | undefined, error: object) {
    const data = JSON.stringify({
      type: "error",
      data: { request_id: requestId, event_id: requestId, error },
    });
    this.dispatchEvent(Object.assign(new Event("message"), { data }));
  }
  close(code = 1000, reason = "") {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.dispatchEvent(Object.assign(new Event("close"), { code, reason }));
  }
}
function connection(welcome: object) {
  return RunelinkConnection.make({
    url: "ws://localhost:7000/ws",
    autoReconnect: false,
    capabilities: { "messages.read": ["2026.10.19"], ping: [v1] },
  }).pipe(
    Effect.provideService(
      Socket.WebSocketConstructor,
      () => new FakeSocket(welcome)
    )
  );
}
// Sends a ping and returns its fiber and request ID once it is on the wire
const pendingPing = Effect.fn("ConnectionTest.pendingPing")(function* (
  conn: RunelinkConnection.RunelinkConnection["Service"],
  socket: FakeSocket
) {
  const fiber = yield* Effect.forkScoped(conn.request({ type: "ping" }), {
    startImmediately: true,
  });
  yield* Effect.yieldNow;
  return { fiber, id: socket.requests.at(-1) };
});
const base = {
  negotiation_version: 1,
  server_version: "test",
  capabilities: { ping: v1 },
};
it.effect(
  "new and legacy welcomes expose reasons, preserve names, and clear on disconnect",
  () =>
    Effect.gen(function* () {
      for (const rejected of [
        undefined,
        { "messages.read": [v1] },
        { "messages.read": [] },
      ]) {
        yield* Effect.scoped(
          Effect.gen(function* () {
            const conn = yield* connection({
              ...base,
              ...(rejected === undefined
                ? {}
                : { rejected_capabilities: rejected }),
            });
            yield* conn.connect;
            const issues = Option.getOrThrow(yield* conn.capabilityIssues);
            assert.deepEqual(
              issues.map((issue) => issue.capability),
              ["messages.read"]
            );
            assert.equal(
              issues[0].reason,
              rejected === undefined
                ? "unknown"
                : rejected["messages.read"].length
                  ? "outdated-host"
                  : "missing"
            );
            yield* conn.disconnect;
            assert.ok(Option.isNone(yield* conn.capabilityIssues));
          })
        );
      }
    })
);
it.effect("malformed rejection partitions fail negotiation", () =>
  Effect.gen(function* () {
    for (const rejected of [
      {},
      { ping: [], "messages.read": [] },
      { "messages.read": ["2026.10.19"] },
      { "messages.read": [], unknown: [] },
    ] as const) {
      yield* Effect.scoped(
        Effect.gen(function* () {
          const conn = yield* connection({
            ...base,
            rejected_capabilities: rejected,
          });
          const error = yield* Effect.flip(conn.connect);
          assert.equal(error._tag, "RunelinkIncompatibleHostError");
          yield* conn.disconnect;
        })
      );
    }
  })
);
it.effect("errors report URLs without credentials, query, or fragment", () =>
  Effect.gen(function* () {
    for (const [url, host] of [
      [
        "ws://bot:pw@localhost:7000/ws?access_token=x#y",
        "ws://localhost:7000/ws",
      ],
      ["/ws?access_token=x", "(redacted URL)"],
      ["bot:pw@localhost:7000/ws", "(redacted URL)"],
      ["bot:/pw@localhost:7000/ws", "(redacted URL)"],
      ["file:pw@localhost/ws", "(redacted URL)"],
      ["ws+unix:///tmp/sock:/ws?access_token=x", "ws+unix:///tmp/sock:/ws"],
      ["WS://LOCALHOST:7000/ws", "WS://LOCALHOST:7000/ws"],
    ] as const) {
      yield* Effect.scoped(
        Effect.gen(function* () {
          let dialed;
          const conn = yield* RunelinkConnection.make({
            url,
            autoReconnect: false,
          }).pipe(
            Effect.provideService(Socket.WebSocketConstructor, (dialUrl) => {
              dialed = dialUrl;
              return new FakeSocket({ ...base, rejected_capabilities: {} });
            })
          );
          const error = yield* Effect.flip(conn.connect);
          assert.equal(dialed, url);
          assert.equal(error._tag, "RunelinkIncompatibleHostError");
          assert.equal(error.host, host);
          assert.ok(error.message.startsWith(`${host} is incompatible`));
        })
      );
    }
  })
);
it.effect(
  "connection error causes leave out the socket and its message for URLs with secrets",
  () =>
    Effect.gen(function* () {
      function failingSocket(dialUrl: string) {
        const socket = Object.assign(new EventTarget(), {
          url: dialUrl,
          readyState: 0,
          close() {},
          send() {
            assert.fail("Socket failed to open");
          },
        });
        queueMicrotask(() =>
          socket.dispatchEvent(
            Object.assign(new Event("error"), {
              error: new Error(`connect ECONNREFUSED ${dialUrl}`),
            })
          )
        );
        return socket;
      }
      const secretUrl =
        "ws://bot:pw@localhost:7000/ws?access_token=secret-token#frag";
      for (const [url, makeSocket, cause] of [
        [secretUrl, failingSocket, "An error occurred during Open: Error"],
        [
          secretUrl,
          () => {
            throw new SyntaxError(`Invalid URL: ${secretUrl}`);
          },
          "SyntaxError",
        ],
        [
          secretUrl,
          () => {
            throw {
              get error() {
                throw new Error("getter");
              },
            };
          },
          undefined,
        ],
        [
          "ws://localhost:7000/ws",
          failingSocket,
          "An error occurred during Open",
        ],
      ] as const) {
        yield* Effect.scoped(
          Effect.gen(function* () {
            const conn = yield* RunelinkConnection.make({
              url,
              autoReconnect: false,
            }).pipe(
              Effect.provideService(Socket.WebSocketConstructor, makeSocket)
            );
            const error = yield* Effect.flip(conn.connect);
            assert.equal(error._tag, "RunelinkConnectionError");
            assert.equal(
              cause === undefined
                ? error.cause
                : error.cause instanceof Error
                  ? error.cause.message
                  : undefined,
              cause
            );
            if (url === secretUrl)
              assert.ok(
                !inspect(error, { depth: Infinity }).includes("secret-token")
              );
            else {
              assert.ok(Socket.isSocketError(error.cause));
              const reason = error.cause.reason;
              assert.ok("cause" in reason && reason.cause instanceof Event);
              assert.equal(reason.cause.type, "error");
            }
          })
        );
      }
    })
);
it.effect(
  "requests match replies, ignore late replies, and fail when the socket closes",
  () =>
    Effect.gen(function* () {
      const conn = yield* connection(base);
      const firstIssue = yield* Deferred.make<RunelinkConnectionIssue>();
      yield* conn.errors.pipe(
        Stream.runForEach((issue) => Deferred.succeed(firstIssue, issue)),
        Effect.forkScoped({ startImmediately: true })
      );
      yield* conn.connect;
      const socket = FakeSocket.last;
      const pending = pendingPing(conn, socket);

      let request = yield* pending;
      socket.reply(request.id, { type: "pong" });
      assert.equal((yield* Fiber.join(request.fiber)).type, "pong");

      request = yield* pending;
      socket.reply(request.id, { type: "users_delete" });
      assert.equal(
        (yield* Effect.flip(Fiber.join(request.fiber)))._tag,
        "RunelinkProtocolError"
      );

      // A reply that does not decode still settles its request
      request = yield* pending;
      socket.reply(request.id, { type: "unknown_reply" });
      const invalid = yield* Effect.flip(Fiber.join(request.fiber));
      assert.equal(invalid._tag, "RunelinkProtocolError");
      assert.equal(invalid.reason, "Invalid message received");

      request = yield* pending;
      yield* Fiber.interrupt(request.fiber);
      socket.reply(request.id, { type: "pong" });
      // Frames are handled in order, so the first issue is this one if the late
      // reply was ignored
      socket.dispatchEvent(Object.assign(new Event("message"), { data: "{" }));
      const issue = yield* Deferred.await(firstIssue);
      assert.equal(issue._tag, "RunelinkProtocolError");
      assert.equal(issue.reason, "Invalid message received");

      request = yield* pending;
      socket.close(4000, "bye");
      const error = yield* Effect.flip(Fiber.join(request.fiber));
      assert.equal(error.message, "WebSocket closed (4000): bye");
    })
);
it.effect(
  "requests that may not connect fail instead of opening a socket",
  () =>
    Effect.gen(function* () {
      const conn = yield* connection(base);
      const ping = conn.request({ type: "ping" }, { connect: false });
      const before = FakeSocket.last;
      assert.equal(
        (yield* Effect.flip(ping))._tag,
        "RunelinkDisconnectedError"
      );
      assert.equal(FakeSocket.last, before);

      yield* conn.connect;
      const socket = FakeSocket.last;
      const fiber = yield* Effect.forkScoped(ping, { startImmediately: true });
      yield* Effect.yieldNow;
      socket.reply(socket.requests.at(-1), { type: "pong" });
      assert.equal((yield* Fiber.join(fiber)).type, "pong");

      socket.close();
      yield* conn.statusChanges.pipe(
        Stream.takeUntil((status) => status === "disconnected"),
        Stream.runDrain
      );
      assert.equal(
        (yield* Effect.flip(ping))._tag,
        "RunelinkDisconnectedError"
      );
      assert.equal(FakeSocket.last, socket);
    })
);
it.effect("error replies fail with the tagged error for their code", () =>
  Effect.gen(function* () {
    const conn = yield* connection(base);
    yield* conn.connect;
    const socket = FakeSocket.last;
    for (const [code, tag] of [
      ["auth_error", "RunelinkAuthError"],
      ["bad_request", "RunelinkBadRequestError"],
      ["not_found", "RunelinkNotFoundError"],
      ["conflict", "RunelinkConflictError"],
      ["internal_error", "RunelinkInternalError"],
      ["rate_limited", "RunelinkInternalError"],
      ["unsupported_capability", "RunelinkUnsupportedCapabilityError"],
    ]) {
      const { fiber, id } = yield* pendingPing(conn, socket);
      socket.error(id, { code, message: `Host says ${code}`, details: null });
      const error = yield* Effect.flip(Fiber.join(fiber));
      assert.equal(error._tag, tag);
      if (error._tag === "RunelinkInternalError")
        assert.equal(error.code, code);
      if (error._tag === "RunelinkUnsupportedCapabilityError")
        assert.equal(error.capability, "ping");
      else assert.equal(error.message, `Host says ${code}`);
    }
  })
);
it.effect("a socket constructor failure fails connect instead of hanging", () =>
  Effect.gen(function* () {
    const conn = yield* RunelinkConnection.make({
      url: "not a url",
      autoReconnect: false,
    }).pipe(
      Effect.provideService(Socket.WebSocketConstructor, () => {
        throw new SyntaxError("invalid URL");
      })
    );
    assert.equal(
      (yield* Effect.flip(conn.connect))._tag,
      "RunelinkConnectionError"
    );
    assert.equal(yield* conn.status, "disconnected");
  })
);
it.effect(
  "a connection used after its scope closes fails instead of hanging",
  () =>
    Effect.gen(function* () {
      const conn = yield* Effect.scoped(connection(base));
      const error = yield* Effect.flip(conn.connect);
      assert.equal(error._tag, "RunelinkDisconnectedError");
    }),
  { timeout: 1_000 }
);
it.effect(
  "a consumer forked with startImmediately receives the next update",
  () =>
    Effect.gen(function* () {
      const conn = yield* RunelinkConnection.make({
        url: "ws://localhost:7000/ws",
        autoReconnect: false,
        capabilities: { "messages.events": ["2026.10.19"] },
      }).pipe(
        Effect.provideService(
          Socket.WebSocketConstructor,
          () =>
            new FakeSocket({
              ...base,
              capabilities: { "messages.events": "2026.10.19" },
            })
        )
      );
      yield* conn.connect;
      const first = yield* Deferred.make<import("../src/index.ts").WsUpdate>();
      yield* conn.updates.pipe(
        Stream.runForEach((update) => Deferred.succeed(first, update)),
        Effect.forkScoped({ startImmediately: true })
      );
      const id = "00000000-0000-4000-8000-000000000001",
        at = "2026-11-26T00:00:00Z";
      const data = {
        id,
        text_channel_id: id,
        author: null,
        reply_to: null,
        body: "hi",
        deleted_at: null,
        created_at: at,
        updated_at: at,
      };
      FakeSocket.last.dispatchEvent(
        Object.assign(new Event("message"), {
          data: JSON.stringify({
            type: "update",
            data: { event_id: id, update: { type: "message_upserted", data } },
          }),
        })
      );
      const update = yield* Deferred.await(first);
      assert.equal(update.type, "message_upserted");
      assert.equal(update.data.body, "hi");
    }),
  { timeout: 1_000 }
);
