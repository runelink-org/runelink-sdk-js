import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLIENT_WS_SUPPORTED_CAPABILITIES,
  FullServerMembershipSchema,
  LocalAccountSchema,
  MessageSchema,
  MessageUpdateSchema,
  RefreshTokenSchema,
  ServerChannelSchema,
  ServerChannelUpdateSchema,
  ServerMemberSchema,
  ServerMembershipSchema,
  ServerSchema,
  ServerUpdateSchema,
  UserSchema,
} from "../dist/index.js";

const timestamp = "2026-10-28T12:00:00.123456789Z";
const user = {
  name: "test",
  host: "localhost",
  role: "admin",
  created_at: timestamp,
  updated_at: timestamp,
  synced_at: timestamp,
};
const server = {
  id: "00000000-0000-4000-8000-000000000001",
  host: "localhost",
  title: "Test server",
  description: null,
  created_at: timestamp,
  updated_at: timestamp,
};
const channel = {
  id: "00000000-0000-4000-8000-000000000002",
  server_id: server.id,
  kind: "category",
  title: "Test category",
  description: null,
  parent_channel_id: null,
  position: 0,
  created_at: timestamp,
  updated_at: timestamp,
};
const membership = {
  server,
  user_ref: { name: user.name, host: user.host },
  role: "admin",
  joined_at: timestamp,
  updated_at: timestamp,
  synced_at: timestamp,
};
const message = {
  id: channel.id,
  text_channel_id: channel.id,
  author: user,
  reply_to: null,
  body: "Test message",
  created_at: timestamp,
  updated_at: timestamp,
  edited_at: timestamp,
  deleted_at: null,
};

for (const [name, schema, data] of [
  ["user", UserSchema, user],
  ["server", ServerSchema, server],
  ["category", ServerChannelSchema, channel],
  [
    "channel",
    ServerChannelSchema,
    { ...channel, kind: "text", text_channel_id: channel.id },
  ],
  ["membership", ServerMembershipSchema, membership],
  [
    "full membership",
    FullServerMembershipSchema,
    {
      server,
      user,
      role: "admin",
      joined_at: timestamp,
      updated_at: timestamp,
      synced_at: timestamp,
    },
  ],
  [
    "member",
    ServerMemberSchema,
    { user, role: "admin", joined_at: timestamp, updated_at: timestamp },
  ],
  [
    "local account",
    LocalAccountSchema,
    {
      user_name: user.name,
      user_host: user.host,
      password_hash: "test",
      created_at: timestamp,
      updated_at: timestamp,
    },
  ],
  ["message", MessageSchema, message],
  [
    "deleted message",
    MessageSchema,
    { ...message, body: null, deleted_at: timestamp },
  ],
  [
    "refresh token",
    RefreshTokenSchema,
    {
      token: "test",
      user_name: user.name,
      user_host: user.host,
      client_id: "test",
      issued_at: timestamp,
      expires_at: timestamp,
      revoked: false,
    },
  ],
]) {
  test(`${name} preserves timestamps as precise strings`, () => {
    const parsed = schema.parse(data);
    assert.equal("update_version" in parsed, false);
    assert.deepEqual(parsed, data);
    assert.deepEqual(schema.parse(parsed), data);
    assert.deepEqual(schema.parse(JSON.parse(JSON.stringify(parsed))), data);
    for (const [field, value] of Object.entries(data)) {
      if (!field.endsWith("_at") || value === null) continue;
      for (const invalid of [0, new Date(timestamp), "invalid"]) {
        assert.equal(
          schema.safeParse({ ...data, [field]: invalid }).success,
          false,
          field
        );
      }
    }
  });
}

test("optional timestamps preserve null and reject malformed values", () => {
  assert.equal(UserSchema.parse({ ...user, synced_at: null }).synced_at, null);
  assert.equal(
    ServerMembershipSchema.parse({ ...membership, synced_at: null }).synced_at,
    null
  );
  assert.equal(
    MessageSchema.parse({ ...message, edited_at: null }).edited_at,
    null
  );
  for (const edited_at of [false, 0, new Date(timestamp), "invalid"]) {
    assert.equal(
      MessageSchema.safeParse({ ...message, edited_at }).success,
      false
    );
  }
});

test("edit requests accept the original updated_at without conversion", () => {
  for (const [schema, fields] of [
    [MessageUpdateSchema, { body: "Edited message" }],
    [ServerChannelUpdateSchema, { title: "Edited channel" }],
    [ServerUpdateSchema, { description: "Edited description" }],
  ]) {
    assert.equal(
      schema.parse({ ...fields, expected_updated_at: timestamp })
        .expected_updated_at,
      timestamp
    );
  }
});

test("editing capabilities stay on October 28", () => {
  for (const capability of [
    "messages.update",
    "channels.update",
    "servers.update",
  ]) {
    assert.deepEqual(CLIENT_WS_SUPPORTED_CAPABILITIES[capability], [
      "2026.10.28",
    ]);
  }
});
