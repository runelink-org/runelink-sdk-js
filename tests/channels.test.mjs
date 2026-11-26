import assert from "node:assert/strict";
import { test } from "node:test";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import { ServerChannelSchema, WsReplySchema, WsUpdateSchema } from "../dist/index.js";

function parse(schema, value) {
  return Schema.decodeUnknownSync(schema)(value);
}
function ok(schema, value) {
  return Exit.isSuccess(Schema.decodeUnknownExit(schema)(value));
}

const category = {
  id: "00000000-0000-4000-8000-000000000001",
  server_id: "00000000-0000-4000-8000-000000000002",
  kind: "category",
  title: "General",
  description: null,
  parent_channel_id: null,
  position: 0,
  created_at: "2026-10-22T00:00:00Z",
  updated_at: "2026-10-22T00:00:00Z",
};

test("flattened channel content validates in replies and events", () => {
  assert.ok(ok(ServerChannelSchema, category));
  assert.equal(ok(ServerChannelSchema, { ...category, kind: "text" }), false);
  for (const data of [category, { ...category, kind: "text", text_channel_id: category.id }]) {
    assert.equal(parse(WsReplySchema, { type: "channels_create", data }).data.kind, data.kind);
    assert.equal(parse(WsUpdateSchema, { type: "channel_upserted", data }).data.kind, data.kind);
  }
});
