import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ServerSchema,
  ServerChannelSchema,
  NewServerSchema,
  NewServerChannelSchema,
  ServerUpdateSchema,
  ServerChannelUpdateSchema,
  WsReplySchema,
  WsUpdateSchema,
} from "../dist/index.js";

const timestamp = "2026-11-13T00:00:00Z";
const server = {
  id: "00000000-0000-4000-8000-000000000001",
  host: "localhost",
  title: "test",
  created_at: timestamp,
  updated_at: timestamp,
};
const channel = {
  ...server,
  server_id: server.id,
  kind: "category",
  parent_channel_id: null,
  position: 0,
};

test("missing and null resource descriptions retain the SDK's null representation", () => {
  for (const fields of [{}, { description: null }, { description: "Details" }]) {
    for (const [schema, base] of [[ServerSchema, server], [ServerChannelSchema, channel]]) {
      assert.equal(schema.parse({ ...base, ...fields }).description, fields.description ?? null);
    }
    for (const [type, data] of [["server_upserted", server], ["channel_upserted", channel]]) {
      assert.equal(WsUpdateSchema.parse({ type, data: { ...data, ...fields } }).data.description, fields.description ?? null);
    }
    const result = WsReplySchema.parse({ type: "servers_get_with_channels", data: { server: { ...server, ...fields }, channels: [{ ...channel, ...fields }] } });
    assert.equal(result.data.server.description, fields.description ?? null);
    assert.equal(result.data.channels[0].description, fields.description ?? null);
  }
});

test("creation omits unused descriptions and edits preserve explicit null", () => {
  for (const schema of [NewServerSchema, NewServerChannelSchema]) {
    const parsed = schema.parse(channel);
    assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(parsed)), "description"), false);
    assert.equal(schema.parse({ ...channel, description: null }).description, null);
  }
  for (const schema of [ServerUpdateSchema, ServerChannelUpdateSchema]) {
    for (const fields of [{}, { description: null }, { description: "Details" }]) {
      const patch = { expected_updated_at: timestamp, ...fields };
      assert.deepEqual(JSON.parse(JSON.stringify(schema.parse(patch))), patch);
    }
  }
});
