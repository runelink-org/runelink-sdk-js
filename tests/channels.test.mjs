import assert from "node:assert/strict";
import { test } from "node:test";
import { ServerChannelSchema, WsReplySchema, WsUpdateSchema } from "../dist/index.js";

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
  assert.ok(ServerChannelSchema.safeParse(category).success);
  assert.equal(ServerChannelSchema.safeParse({ ...category, kind: "text" }).success, false);
  for (const data of [category, { ...category, kind: "text", text_channel_id: category.id }]) {
    assert.equal(WsReplySchema.parse({ type: "channels_create", data }).data.kind, data.kind);
    assert.equal(WsUpdateSchema.parse({ type: "channel_upserted", data }).data.kind, data.kind);
  }
});
