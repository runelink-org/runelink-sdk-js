import assert from "node:assert/strict";
import { test } from "node:test";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import {
  MessageSchema,
  NewMessageSchema,
  WsReplySchema,
  WsUpdateSchema,
} from "../dist/index.js";

function parse(schema, value) {
  return Schema.decodeUnknownSync(schema)(value);
}
function ok(schema, value) {
  return Exit.isSuccess(Schema.decodeUnknownExit(schema)(value));
}

const base = {
  id: "00000000-0000-4000-8000-000000000001",
  text_channel_id: "00000000-0000-4000-8000-000000000002",
  author: null,
  reply_to: "00000000-0000-4000-8000-000000000003",
  created_at: "2026-10-19T12:00:00Z",
  updated_at: "2026-10-19T12:00:00Z",
};

test("message state validates body and deletion together", () => {
  const active = parse(MessageSchema, {
    ...base,
    body: "hello",
    deleted_at: null,
  });
  assert.equal(active.body, "hello");
  assert.equal(active.deleted_at, null);
  const deleted = parse(MessageSchema, {
    ...base,
    body: null,
    deleted_at: base.updated_at,
  });
  assert.equal(deleted.body, null);
  assert.equal(deleted.deleted_at, base.updated_at);
  for (const fields of [
    { body: null, deleted_at: null },
    { body: "leaked text", deleted_at: base.updated_at },
    { body: "hello" },
    { body: null, deleted_at: false },
    { body: null, deleted_at: 0 },
  ]) {
    assert.equal(
      ok(MessageSchema, { ...base, ...fields }),
      false
    );
  }
});

test("deletions carry tombstones in replies and updates", () => {
  const data = { ...base, body: null, deleted_at: base.updated_at };
  assert.equal(
    parse(WsReplySchema, { type: "messages_delete", data }).data.body,
    null
  );
  assert.equal(
    parse(WsUpdateSchema, { type: "message_upserted", data }).data.body,
    null
  );
});

test("new messages accept omitted, null, and explicit reply targets", () => {
  const message = {
    author: { name: "test", host: "localhost" },
    body: "hello",
  };
  for (const reply of [{}, { reply_to: null }, { reply_to: base.id }]) {
    assert.ok(ok(NewMessageSchema, { ...message, ...reply }));
  }
});

test("updated_at retains microseconds through parsing and serialization", () => {
  const timestamp = "2026-10-28T12:00:00.123456Z";
  const message = parse(MessageSchema, {
    ...base,
    updated_at: timestamp,
    body: "hello",
    deleted_at: null,
    edited_at: timestamp,
  });
  assert.equal(message.updated_at, timestamp);
  assert.equal(message.created_at, base.created_at);
  assert.equal(message.edited_at, timestamp);
  assert.equal("update_version" in message, false);
  assert.equal(parse(MessageSchema, message).updated_at, timestamp);
  assert.equal(
    parse(MessageSchema, JSON.parse(JSON.stringify(message))).updated_at,
    timestamp
  );
});
