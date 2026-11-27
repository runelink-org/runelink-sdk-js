import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import * as Schema from "effect/Schema";
import {
  ServerSchema,
  ServerChannelSchema,
  NewServerSchema,
  NewServerChannelSchema,
  ServerUpdateSchema,
  ServerChannelUpdateSchema,
  WsReplySchema,
  WsUpdateSchema,
} from "../src/index.ts";
import { parseVariant } from "./schema-assertions.ts";

function parse<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  value: unknown
) {
  return Schema.decodeUnknownSync(schema)(value);
}

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

it("missing and null resource descriptions retain the SDK's null representation", () => {
  for (const fields of [
    {},
    { description: null },
    { description: "Details" },
  ]) {
    for (const [schema, base] of [
      [ServerSchema, server],
      [ServerChannelSchema, channel],
    ] as const) {
      assert.equal(
        parse(schema, { ...base, ...fields }).description,
        fields.description ?? null
      );
    }
    for (const [type, data] of [
      ["server_upserted", server],
      ["channel_upserted", channel],
    ] as const) {
      assert.equal(
        parseVariant(WsUpdateSchema, { type, data: { ...data, ...fields } })
          .data.description,
        fields.description ?? null
      );
    }
    const result = parseVariant(WsReplySchema, {
      type: "servers_get_with_channels",
      data: {
        server: { ...server, ...fields },
        channels: [{ ...channel, ...fields }],
      },
    });
    assert.equal(result.data.server.description, fields.description ?? null);
    assert.equal(
      result.data.channels[0].description,
      fields.description ?? null
    );
  }
});

it("creation omits unused descriptions and edits preserve explicit null", () => {
  for (const schema of [NewServerSchema, NewServerChannelSchema]) {
    const parsed = parse(schema, channel);
    assert.equal(
      Object.hasOwn(JSON.parse(JSON.stringify(parsed)), "description"),
      false
    );
    assert.equal(
      parse(schema, { ...channel, description: null }).description,
      null
    );
  }
  for (const schema of [ServerUpdateSchema, ServerChannelUpdateSchema]) {
    for (const fields of [
      {},
      { description: null },
      { description: "Details" },
    ]) {
      const patch = { expected_updated_at: timestamp, ...fields };
      assert.deepEqual(JSON.parse(JSON.stringify(parse(schema, patch))), patch);
    }
  }
});
