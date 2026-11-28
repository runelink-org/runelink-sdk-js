import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import {
  MessageSchema,
  ServerChannelSchema,
  WsRequestSchema,
  WsUpdateSchema,
  channelServerRef,
  resourceKey,
  textChannelRef,
} from "../src/index.ts";
import type {
  ResourceKey,
  ServerId,
  ServerRef,
  TextChannelId,
  TextChannelRef,
} from "../src/index.ts";
import { ok, parse } from "./schema-assertions.ts";

const id = "00000000-0000-4000-8000-000000000001";
const ref = { host: "localhost", id };
const user_ref = { name: "alice", host: "localhost" };
const updateAt = "2026-11-27T00:00:00Z";
const timestamp = "2026-11-27T00:00:00Z";

const channel = parse(ServerChannelSchema, {
  id,
  host: "localhost:7001",
  server_id: "00000000-0000-4000-8000-000000000002",
  kind: "text",
  text_channel_id: "00000000-0000-4000-8000-000000000003",
  title: "general",
  parent_channel_id: null,
  position: 0,
  created_at: timestamp,
  updated_at: timestamp,
});
const message = parse(MessageSchema, {
  id,
  host: "localhost:7001",
  text_channel_id: "00000000-0000-4000-8000-000000000003",
  author: null,
  reply_to: null,
  body: "hi",
  deleted_at: null,
  created_at: timestamp,
  updated_at: timestamp,
});

it("resources with the same ID on different hosts have different keys", () => {
  assert.notEqual(
    resourceKey(channel),
    resourceKey({ ...channel, host: "localhost" })
  );
  assert.equal(resourceKey(channel), resourceKey({ ...channel }));
});

it("refs and keys of one kind of resource can't stand in for another", () => {
  const server: ServerRef = channelServerRef(channel);
  const textChannel: TextChannelRef = textChannelRef(message);
  // @ts-expect-error A message is not a reference to its text channel.
  const fromMessage: TextChannelRef = message;
  // @ts-expect-error A server ID is not a text channel ID.
  const fromServer: TextChannelRef = server;
  // @ts-expect-error A server's key does not index text channels.
  const key: ResourceKey<TextChannelId> = resourceKey(server);
  const serverKey: ResourceKey<ServerId> = resourceKey(server);
  assert.equal(fromMessage.id, message.id);
  assert.equal(fromServer.host, server.host);
  assert.equal(key, serverKey);
  assert.equal(textChannel.id, message.text_channel_id);
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
