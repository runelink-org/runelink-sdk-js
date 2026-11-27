# RuneLink JavaScript SDK

RuneLink JavaScript SDK is a small TypeScript-first client package for building applications that talk to RuneLink over websocket and shared protocol types.

> Status: WIP. The SDK and protocol may change as RuneLink evolves.

## What it includes

- [Effect Schema](https://effect.website/docs/schema/introduction/) schemas and TypeScript types for RuneLink domain objects such as users, servers, channels, messages, and auth payloads
- Schemas and types for client websocket requests, replies, updates, errors, and envelopes
- A `RunelinkConnection` Effect service that:
  - validates outgoing requests and incoming replies and updates
  - negotiates independent versions for each supported capability
  - matches each reply to its request and checks its type
  - fails requests with typed errors, including the host's error replies
  - reconnects automatically with configurable backoff
  - exposes its status, pushed updates, and connection problems as streams

The SDK is built on [Effect](https://effect.website) 4 and has `effect` as a peer dependency, so applications share one copy of it.

## Installation

```bash
pnpm add @runelink/sdk effect
```

## Basic usage

```ts
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Socket from "effect/socket/Socket";
import { RunelinkConnection } from "@runelink/sdk";

const program = Effect.gen(function* () {
  const connection = yield* RunelinkConnection.RunelinkConnection;

  yield* connection.updates.pipe(
    Stream.runForEach((update) => Effect.log("update", update)),
    // Subscribe now, rather than when the scheduler first runs the fiber
    Effect.forkScoped({ startImmediately: true })
  );

  // The reply type follows from the request type
  const reply = yield* connection.request({ type: "ping" });
  yield* Effect.log(reply.type); // "pong"
});

program.pipe(
  Effect.provide(RunelinkConnection.layer({ host: "localhost" })),
  Effect.provide(Socket.layerWebSocketConstructorGlobal),
  Effect.scoped,
  Effect.runPromise
);
```

`RunelinkConnection.layer(options)` provides one connection for the lifetime of the layer. To create connections on demand, such as one per account, use `RunelinkConnection.make(options)` inside a scope; the connection disconnects when the scope closes. Both need a `Socket.WebSocketConstructor`: `Socket.layerWebSocketConstructorGlobal` uses the global `WebSocket` in browsers and Node.

`{ host }` connects to the host's client websocket, trying `wss://host:7000/ws/client` first and falling back to `ws://` if the secure socket never opens. Pass `transportSecurity: "secure-only"` to disable the fallback, or `{ url }` to use a websocket URL directly.

## Connection API

- `connect` opens the websocket if needed and succeeds after capability negotiation. While automatic reconnection is allowed, it waits through failed attempts.
- `disconnect` closes the websocket, stops reconnecting, and fails waiting `connect` and `request` calls with `RunelinkDisconnectedError`. A later `connect` or `request` opens it again.
- `request(request)` connects if needed, validates and sends a `WsRequest`, and succeeds with the matching reply, typed as `ReplyFor<typeof request.type>`. `request(request, { connect: false })` sends only on the socket open when the request starts, and fails with `RunelinkDisconnectedError` instead of connecting if there is none or it has been replaced, for apps that handle reconnecting and authenticating themselves.
- `status` is one of `disconnected`, `connecting`, `connected`, or `reconnecting`, and `statusChanges` streams the current status, then each change.
- `updates` streams validated `WsUpdate` push events from the time the stream starts running, across reconnects. Fork consumers with `{ startImmediately: true }` so they subscribe before the fork returns; otherwise updates that arrive before the fiber first runs are missed.
- `errors` streams problems outside of any one request: closed sockets, incompatible hosts, and messages the SDK cannot use.

The streams end when the connection's scope closes.
- `capabilityIssues` is each offered capability the host did not agree to, with offered and host-supported versions, an actionable reason, and a message, or `Option.none()` before negotiation and after disconnecting. Older hosts produce `unknown` with `supportedVersions: null`; an empty host version list means the capability is missing.

## Errors

Errors are `Schema.TaggedError` classes, so they can be handled with `Effect.catchTags`:

- The host's error replies, each with the host's `hostMessage` and `details`, together the `RunelinkHostError` union:
  - `RunelinkAuthError`: the host did not authenticate the connection or did not allow the request, such as an action that needs a server admin
  - `RunelinkBadRequestError`: the host rejected the request as invalid
  - `RunelinkNotFoundError`: a resource the request names does not exist
  - `RunelinkConflictError`: the request conflicts with the resource's current state, such as an edit of an outdated version or a duplicate
  - `RunelinkInternalError`: the host could not complete the request, such as when a peer host is unavailable, or replied with an error `code` the SDK does not know
- `RunelinkConnectionError`: the websocket closed or could not open, with its close `code` and `reason`
- `RunelinkIncompatibleHostError`: capability negotiation failed
- `RunelinkUnsupportedCapabilityError`: the request needs a capability that this client does not offer or the host did not agree to, or the host replied that it does not support it. It fails without closing the connection.
- `RunelinkDisconnectedError`: `disconnect` cancelled the call, or the connection dropped before the request was sent
- `RunelinkInvalidRequestError`: the request failed validation before it was sent
- `RunelinkProtocolError`: the host sent a message the SDK cannot use, such as a reply of the wrong type

`connect` fails with `RunelinkConnectError` and `request` with `RunelinkRequestFailure`, the unions of the errors each can produce. Requests have no built-in timeout; add one with `Effect.timeout`.

## Reconnection

Connections reconnect with exponential backoff and jitter after a socket fails to open or closes. Requests in flight when a socket closes fail with `RunelinkConnectionError`; they are never resent. Each reconnect negotiates a new socket, so authenticate again after reconnecting.

Available options:

- `autoReconnect`
- `reconnectInitialDelayMs`
- `reconnectMaxDelayMs`
- `reconnectBackoffMultiplier`
- `reconnectJitterRatio`
- `maxReconnectAttempts`
- `transportSecurity`
- `capabilities`

Capability versions use CalVer: `YYYY.MM.DD`, with an optional `.N` revision for additional versions on the same day (for example `2026.10.16.1`). The SDK offers every client capability version it implements by default. Pass a reduced `capabilities` map when a specialized client only implements part of the protocol. Requests whose capability was not negotiated fail locally without closing the connection.

If the host rejects capability negotiation, or this client rejects the host's reply, the connection fails with `RunelinkIncompatibleHostError` and automatic reconnection stops, because retrying will not help until the host or client is updated. A host that does not finish negotiating within 5 seconds is retried normally.

## Working with types and schemas

The SDK exports Effect Schema schemas and their TypeScript types, so you can validate data at runtime and keep your app types aligned with the RuneLink protocol. Decode unknown data with `Schema.decodeUnknownEffect`, or `Schema.decodeUnknownSync` outside of Effect code.

Examples include:

- `UserSchema`, `ServerSchema`, `ServerChannelSchema`, `MessageSchema`
- `WsRequestSchema`, `WsReplySchema`, `WsUpdateSchema`
- `WsEnvelopeSchema`

Protocol timestamps, including `created_at`, `updated_at`, and nullable timestamps such as `edited_at`, stay RFC 3339 strings to preserve the host's full precision. Pass `updated_at` directly as `expected_updated_at` when editing a message, channel, or server. Convert timestamps to JavaScript `Date` objects only for display or date calculations, since that conversion discards sub-millisecond precision.

## Migrating from 0.1

Version 0.1 used Zod schemas and a Promise-based `RunelinkConnection` class. The SDK now uses Effect throughout:

- Schemas keep their names but are Effect Schema schemas: replace `Schema.parse(value)` with `Schema.decodeUnknownSync(Schema)(value)`, or the Effect variants in Effect code. Arrays in decoded values are readonly.
- `new RunelinkConnection(hostOrUrl, options, mode)` is now `RunelinkConnection.make({ host, ...options })` or `RunelinkConnection.make({ url, ...options })`, or `RunelinkConnection.layer(...)`, with a `Socket.WebSocketConstructor` provided.
- `connect()` and `disconnect()` are the `connect` and `disconnect` effects. `send(request)` is `request(request)`, which also checks the reply type.
- `getStatus()` and `subscribeStatus(listener)` are `status` and `statusChanges`, `onUpdate(listener)` is `updates`, and `onError(listener)` is `errors`.
- `getCapabilityIssues()` is `capabilityIssues`. `getNegotiatedCapabilities()` and `getUnsupportedCapabilities()` were removed; use the capabilities on each issue instead.
- Errors are now `Schema.TaggedError` classes with a `_tag`. `RunelinkRequestError` is replaced by a class for each host error code, such as `RunelinkNotFoundError`, whose `message` is the host's message.

## License

MIT

## Development

Use Node.js 22.18+, 24.11+, or 26+ and pnpm 12.16.1. Run `pnpm install`, `pnpm format`, `pnpm build`, and `pnpm test`.

Builds use TypeScript 7 for declarations and esbuild for ESM and CommonJS bundles. Use `pnpm dev` to watch for changes, and stop it before building or packing separately. `pnpm pack` runs a fresh build.

Run `pnpm check:package` to build, pack, and install the package in a clean consumer, then check the ESM import, the CommonJS require, and the TypeScript declarations for both.

## Releasing

Pushing a `v*` tag publishes the package to npm from GitHub Actions using npm trusted publishing, so no npm token is needed.

1. Bump `version` in `package.json` on `main` with a `chore: bump version to X.Y.Z` commit. SDK versions follow semver for the JavaScript API and are independent of the core crates, since capability negotiation handles protocol compatibility. Before 1.0, bump the minor version for breaking changes.
2. Once that commit is on `origin/main`, tag it and push the tag: `git tag vX.Y.Z <commit> && git push origin vX.Y.Z`.
3. The release workflow checks that the tag matches the package version and is on `main`, runs the format check, package check, and tests, then publishes.

A published version can never be reused, so check the version before pushing the tag.

The npm trusted publisher for `@runelink/sdk` must use organization `runelink-org`, repository `runelink-sdk-js`, and workflow `release.yml`, with `npm publish` enabled under allowed actions. npm only checks this configuration when publishing, and a new configuration expires if it is not used within two days, so create or recreate it just before pushing a release tag.
