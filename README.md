# RuneLink JavaScript SDK

RuneLink JavaScript SDK is a small TypeScript-first client package for building applications that talk to RuneLink over websocket and shared protocol types.

> Status: WIP. The SDK and protocol may change as RuneLink evolves.

## What it includes

- Zod schemas and TypeScript types for RuneLink domain objects such as users, servers, channels, messages, and auth payloads
- Zod schemas and TypeScript types for client websocket requests, replies, updates, errors, and envelopes
- A `RunelinkConnection` class that:
  - validates outgoing websocket requests
  - negotiates independent versions for each supported capability
  - validates incoming websocket replies and updates
  - resolves `send()` calls when the matching reply arrives
  - rejects requests when the server returns a websocket error
  - supports automatic reconnect with configurable backoff
  - exposes connection status subscriptions for app state integration

## Installation

```bash
pnpm add @runelink/sdk
```

## Basic usage

```ts
import { RunelinkConnection } from "@runelink/sdk";

const connection = new RunelinkConnection("localhost", {
  autoReconnect: true,
});

connection.subscribeStatus((status) => {
  console.log("status", status);
});

connection.onUpdate((update) => {
  console.log("update", update);
});

connection.onError((error) => {
  console.error(error);
});

await connection.connect();

const reply = await connection.send({
  type: "ping",
});

console.log(reply);
```

## Connection API

- `connect()` opens the websocket connection and resolves after capability negotiation
- `disconnect()` closes the connection and stops reconnect attempts
- `send(request)` sends a validated `WsRequest` and returns a promise for the matching `WsReply`
- `getStatus()` returns one of `disconnected`, `connecting`, `connected`, or `reconnecting`
- `getNegotiatedCapabilities()` returns the selected capability versions
- `getUnsupportedCapabilities()` returns offered capabilities the host did not agree to
- `subscribeStatus(listener)` lets applications observe connection lifecycle changes
- `onUpdate(listener)` subscribes to validated `WsUpdate` push events
- `onError(listener)` subscribes to connection, parsing, validation, and request errors

## Reconnection

`RunelinkConnection` supports built-in reconnect behavior so applications do not need to reimplement basic websocket recovery logic.

By default, `new RunelinkConnection("example.com")` connects to `ws://example.com:7000/ws/client`.

Available options:

- `autoReconnect`
- `reconnectInitialDelayMs`
- `reconnectMaxDelayMs`
- `reconnectBackoffMultiplier`
- `reconnectJitterRatio`
- `maxReconnectAttempts`
- `capabilities`

Capability versions use CalVer: `YYYY.MM.DD`, with an optional `.N` revision for additional versions on the same day (for example `2026.10.16.1`). The SDK offers every client capability version it implements by default. Pass a reduced `capabilities` map when a specialized client only implements part of the protocol. Requests whose capability was not negotiated fail locally without closing the connection.

If the host rejects capability negotiation, or this client rejects the host's reply, the SDK emits a `RunelinkIncompatibleHostError`. Automatic reconnection stops, because retrying will not help until the host or client is updated.

## Working with types and schemas

The SDK exports both schemas and inferred TypeScript types from `src/schema` and `src/protocol`, so you can validate data at runtime and keep your app types aligned with the RuneLink protocol.

Examples include:

- `UserSchema`, `ServerSchema`, `ServerChannelSchema`, `MessageSchema`
- `WsRequestSchema`, `WsReplySchema`, `WsUpdateSchema`
- `WsEnvelopeSchema`

Protocol timestamps, including `created_at`, `updated_at`, and nullable timestamps such as `edited_at`, stay RFC 3339 strings to preserve the host's full precision. Pass `updated_at` directly as `expected_updated_at` when editing a message, channel, or server. Convert timestamps to JavaScript `Date` objects only for display or date calculations, since that conversion discards sub-millisecond precision.

## License

ISC

## Development

Use Node.js 22.18+, 24.11+, or 26+ and pnpm 12.15.0. Run `pnpm install`, `pnpm format`, `pnpm build`, and `pnpm test`.

The build checks types with TypeScript 7 before bundling. The `typescript` dependency aliases `@typescript/typescript6` because tsup still needs the TypeScript 6 compiler API to generate declarations. The `@typescript/native` alias provides TypeScript 7's `tsc` without conflicting with the compatibility package's `tsc6` executable.
