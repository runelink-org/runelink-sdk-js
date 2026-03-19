# RuneLink JavaScript SDK

RuneLink JavaScript SDK is a small TypeScript-first client package for building applications that talk to RuneLink over websocket and shared protocol types.

> Status: WIP. The SDK and protocol may change as RuneLink evolves.

## What it includes

- Zod schemas and TypeScript types for RuneLink domain objects such as users, servers, channels, messages, and auth payloads
- Zod schemas and TypeScript types for client websocket requests, replies, updates, errors, and envelopes
- A `RunelinkConnection` class that:
  - validates outgoing websocket requests
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

- `connect()` opens the websocket connection
- `disconnect()` closes the connection and stops reconnect attempts
- `send(request)` sends a validated `WsRequest` and returns a promise for the matching `WsReply`
- `getStatus()` returns one of `disconnected`, `connecting`, `connected`, or `reconnecting`
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

## Working with types and schemas

The SDK exports both schemas and inferred TypeScript types from `src/schema` and `src/protocol`, so you can validate data at runtime and keep your app types aligned with the RuneLink protocol.

Examples include:

- `UserSchema`, `ServerSchema`, `ChannelSchema`, `MessageSchema`
- `WsRequestSchema`, `WsReplySchema`, `WsUpdateSchema`
- `WsEnvelopeSchema`

## License

ISC
