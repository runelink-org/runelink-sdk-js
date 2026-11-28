import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import {
  WsRequestSchema,
  WsUpdateSchema,
  channelServerRef,
  resourceKey,
  textChannelRef,
} from "../src/index.ts";
import { ok } from "./schema-assertions.ts";

const id = "00000000-0000-4000-8000-000000000001";
const ref = { host: "localhost", id };
const user_ref = { name: "alice", host: "localhost" };
const updateAt = "2026-11-27T00:00:00Z";

it("resources with the same ID on different hosts have different keys", () => {
  assert.notEqual(
    resourceKey(ref),
    resourceKey({ ...ref, host: "localhost:7001" })
  );
  assert.equal(resourceKey(ref), resourceKey({ ...ref }));
});

it("requests name resources by ref instead of an ID and target host", () => {
  const legacy = { target_host: ref.host };
  const update = { expected_updated_at: updateAt };
  for (const [type, data, old] of [
    ["servers_get_by_id", { server: ref }, { server_id: id, ...legacy }],
    ["channels_get_by_id", { channel: ref }, { channel_id: id, ...legacy }],
    [
      "messages_get_by_text_channel",
      { text_channel: ref },
      { text_channel_id: id, ...legacy },
    ],
    [
      "messages_update",
      { message: ref, message_update: update },
      { message_id: id, message_update: update, ...legacy },
    ],
    [
      "memberships_upsert",
      { new_membership: { user_ref, server: ref, role: "member" } },
      {
        server_id: id,
        new_membership: {
          user_ref,
          server_id: id,
          server_host: ref.host,
          role: "member",
        },
      },
    ],
  ] as const) {
    assert.ok(ok(WsRequestSchema, { type, data }), type);
    assert.equal(ok(WsRequestSchema, { type, data: old }), false, type);
  }
});

it("deletions name their server by ref", () => {
  for (const update of [
    { type: "server_deleted", data: { server: ref } },
    { type: "channel_deleted", data: { server: ref, channel_id: id } },
    { type: "membership_deleted", data: { server: ref, user_ref } },
  ]) {
    assert.ok(ok(WsUpdateSchema, update));
    assert.equal(
      ok(WsUpdateSchema, { ...update, data: { ...update.data, server: id } }),
      false
    );
  }
});
