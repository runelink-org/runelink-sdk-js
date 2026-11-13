import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NewMessageSchema,
  NewServerChannelSchema,
  MessageUpdateSchema,
  ServerChannelUpdateSchema,
  WsRequestSchema,
  WsReplySchema,
  WsUpdateSchema,
} from "../dist/index.js";

const id = "00000000-0000-4000-8000-000000000001";
const timestamp = "2026-11-13T00:00:00.123456Z";
const metadata = { kind: "tool_invocation", nested: { enabled: true }, args: [1, null] };

test("creation and patches preserve missing, null, and object metadata", () => {
  for (const fields of [{}, { metadata: null }, { metadata: {} }, { metadata }]) {
    const message = NewMessageSchema.parse({ author: { name: "test", host: "localhost" }, body: "hello", ...fields });
    const channel = NewServerChannelSchema.parse({ kind: "text", title: "test", description: null, parent_channel_id: null, ...fields });
    for (const parsed of [message, channel]) {
      assert.deepEqual(parsed.metadata, fields.metadata);
      assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(parsed)), "metadata"), Object.hasOwn(fields, "metadata"));
    }
    const patch = { expected_updated_at: timestamp, ...fields };
    assert.deepEqual(MessageUpdateSchema.parse(patch), patch);
    assert.deepEqual(ServerChannelUpdateSchema.parse(patch), patch);
    const request = { type: "messages_update", data: { message_id: id, message_update: patch, target_host: null } };
    assert.deepEqual(WsRequestSchema.parse(request), request);
  }
  for (const value of [[], "text", 1, true]) {
    assert.equal(MessageUpdateSchema.safeParse({ expected_updated_at: timestamp, metadata: value }).success, false);
    assert.equal(ServerChannelUpdateSchema.safeParse({ expected_updated_at: timestamp, metadata: value }).success, false);
  }
});

test("metadata survives reply and pushed update validation", () => {
  const message = { id, text_channel_id: id, author: null, reply_to: null, body: "hello", deleted_at: null, created_at: timestamp, updated_at: timestamp, metadata };
  const channel = { id, server_id: id, kind: "category", title: "test", description: null, parent_channel_id: null, position: 0, created_at: timestamp, updated_at: timestamp, metadata };
  assert.deepEqual(WsReplySchema.parse({ type: "messages_get_by_id", data: message }).data.metadata, metadata);
  assert.deepEqual(WsUpdateSchema.parse({ type: "message_upserted", data: message }).data.metadata, metadata);
  assert.deepEqual(WsReplySchema.parse({ type: "channels_get_by_id", data: channel }).data.metadata, metadata);
  assert.deepEqual(WsUpdateSchema.parse({ type: "channel_upserted", data: channel }).data.metadata, metadata);
});
