import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import {
  ServerChannelSchema,
  WsReplySchema,
  WsUpdateSchema,
} from "../src/index.ts";
import { parseVariant, ok } from "./schema-assertions.ts";

const category = {
  id: "00000000-0000-4000-8000-000000000001",
  host: "localhost",
  server_id: "00000000-0000-4000-8000-000000000002",
  kind: "category",
  title: "General",
  description: null,
  parent_channel_id: null,
  position: 0,
  created_at: "2026-10-22T00:00:00Z",
  updated_at: "2026-10-22T00:00:00Z",
};

it("flattened channel content validates in replies and events", () => {
  assert.ok(ok(ServerChannelSchema, category));
  assert.equal(ok(ServerChannelSchema, { ...category, kind: "text" }), false);
  for (const data of [
    category,
    { ...category, kind: "text", text_channel_id: category.id },
  ]) {
    assert.equal(
      parseVariant(WsReplySchema, { type: "channels_create", data }).data.kind,
      data.kind
    );
    assert.equal(
      parseVariant(WsUpdateSchema, { type: "channel_upserted", data }).data
        .kind,
      data.kind
    );
  }
});
