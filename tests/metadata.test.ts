import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import {
  NewMessageSchema,
  NewServerChannelSchema,
  MessageUpdateSchema,
  ServerChannelUpdateSchema,
  WsRequestSchema,
  WsReplySchema,
  WsUpdateSchema,
} from "../src/index.ts";
import { parseVariant, parse, ok, roundTripJson } from "./schema-assertions.ts";

const id = "00000000-0000-4000-8000-000000000001";
const timestamp = "2026-11-13T00:00:00.123456Z";
const metadata = {
  kind: "tool_invocation",
  nested: { enabled: true },
  args: [1, null],
};

it("creation and patches preserve missing, null, and object metadata", () => {
  for (const fields of [
    {},
    { metadata: null },
    { metadata: {} },
    { metadata },
  ]) {
    const message = parse(NewMessageSchema, {
      author: { name: "test", host: "localhost" },
      body: "hello",
      ...fields,
    });
    const channel = parse(NewServerChannelSchema, {
      kind: "text",
      title: "test",
      description: null,
      parent_channel_id: null,
      ...fields,
    });
    for (const parsed of [message, channel]) {
      assert.deepEqual(parsed.metadata, fields.metadata);
      assert.equal(
        Object.hasOwn(roundTripJson(parsed), "metadata"),
        Object.hasOwn(fields, "metadata")
      );
    }
    const patch = { expected_updated_at: timestamp, ...fields };
    assert.deepEqual(parse(MessageUpdateSchema, patch), patch);
    assert.deepEqual(parse(ServerChannelUpdateSchema, patch), patch);
    const request = {
      type: "messages_update",
      data: { message_id: id, message_update: patch, target_host: null },
    };
    assert.deepEqual(parse(WsRequestSchema, request), request);
  }
  for (const value of [[], "text", 1, true]) {
    assert.equal(
      ok(MessageUpdateSchema, {
        expected_updated_at: timestamp,
        metadata: value,
      }),
      false
    );
    assert.equal(
      ok(ServerChannelUpdateSchema, {
        expected_updated_at: timestamp,
        metadata: value,
      }),
      false
    );
  }
});

it("metadata survives reply and pushed update validation", () => {
  const message = {
    id,
    text_channel_id: id,
    author: null,
    reply_to: null,
    body: "hello",
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    metadata,
  };
  const channel = {
    id,
    server_id: id,
    kind: "category",
    title: "test",
    description: null,
    parent_channel_id: null,
    position: 0,
    created_at: timestamp,
    updated_at: timestamp,
    metadata,
  };
  assert.deepEqual(
    parseVariant(WsReplySchema, { type: "messages_get_by_id", data: message })
      .data.metadata,
    metadata
  );
  assert.deepEqual(
    parseVariant(WsUpdateSchema, { type: "message_upserted", data: message })
      .data.metadata,
    metadata
  );
  assert.deepEqual(
    parseVariant(WsReplySchema, { type: "channels_get_by_id", data: channel })
      .data.metadata,
    metadata
  );
  assert.deepEqual(
    parseVariant(WsUpdateSchema, { type: "channel_upserted", data: channel })
      .data.metadata,
    metadata
  );
});
