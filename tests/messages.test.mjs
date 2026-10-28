import assert from "node:assert/strict";
import { test } from "node:test";
import { MessageSchema, NewMessageSchema, WsReplySchema, WsUpdateSchema } from "../dist/index.js";

const base = {
  id: "00000000-0000-4000-8000-000000000001",
  text_channel_id: "00000000-0000-4000-8000-000000000002",
  author: null,
  reply_to: "00000000-0000-4000-8000-000000000003",
  created_at: "2026-10-19T12:00:00Z",
  updated_at: "2026-10-19T12:00:00Z",
};

test("message state validates body and deletion together", () => {
  const active = MessageSchema.parse({ ...base, body: "hello", deleted_at: null });
  assert.equal(active.body, "hello");
  assert.equal(active.deleted_at, null);
  const deleted = MessageSchema.parse({ ...base, body: null, deleted_at: base.updated_at });
  assert.equal(deleted.body, null);
  assert.ok(deleted.deleted_at instanceof Date);
  for (const fields of [
    { body: null, deleted_at: null },
    { body: "leaked text", deleted_at: base.updated_at },
    { body: "hello" },
    { body: null, deleted_at: false },
    { body: null, deleted_at: 0 },
  ]) {
    assert.equal(MessageSchema.safeParse({ ...base, ...fields }).success, false);
  }
});

test("deletions carry tombstones in replies and updates", () => {
  const data = { ...base, body: null, deleted_at: base.updated_at };
  assert.equal(WsReplySchema.parse({ type: "messages_delete", data }).data.body, null);
  assert.equal(WsUpdateSchema.parse({ type: "message_upserted", data }).data.body, null);
});

test("new messages accept omitted, null, and explicit reply targets", () => {
  const message = { author: { name: "test", host: "localhost" }, body: "hello" };
  for (const reply of [{}, { reply_to: null }, { reply_to: base.id }]) {
    assert.ok(NewMessageSchema.safeParse({ ...message, ...reply }).success);
  }
});


test("edit tokens retain microseconds through parsing and serialization", () => {
  const timestamp = "2026-10-28T12:00:00.123456Z";
  const message = MessageSchema.parse({ ...base, updated_at: timestamp, body: "hello", deleted_at: null, edited_at: timestamp });
  assert.equal(message.update_version, timestamp);
  assert.equal(message.updated_at.toISOString(), "2026-10-28T12:00:00.123Z");
  assert.equal(MessageSchema.parse(message).update_version, timestamp);
  assert.equal(MessageSchema.parse(JSON.parse(JSON.stringify(message))).update_version, timestamp);
});
