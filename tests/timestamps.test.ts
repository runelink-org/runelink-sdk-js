import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
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
} from "../src/index.ts";

function parse<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  value: unknown
) {
  return Schema.decodeUnknownSync(schema)(value);
}
function ok(schema: Schema.ConstraintDecoder<unknown>, value: unknown) {
  return Exit.isSuccess(Schema.decodeUnknownExit(schema)(value));
}

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
] as const) {
  it(`${name} preserves timestamps as precise strings`, () => {
    const parsed = parse(schema, data);
    assert.equal("update_version" in parsed, false);
    assert.deepEqual(parsed, data);
    assert.deepEqual(parse(schema, parsed), data);
    assert.deepEqual(parse(schema, JSON.parse(JSON.stringify(parsed))), data);
    for (const [field, value] of Object.entries(data)) {
      if (!field.endsWith("_at") || value === null) continue;
      for (const invalid of [0, new Date(timestamp), "invalid"]) {
        assert.equal(ok(schema, { ...data, [field]: invalid }), false, field);
      }
    }
  });
}

it("optional timestamps preserve null and reject malformed values", () => {
  assert.equal(parse(UserSchema, { ...user, synced_at: null }).synced_at, null);
  assert.equal(
    parse(ServerMembershipSchema, { ...membership, synced_at: null }).synced_at,
    null
  );
  assert.equal(
    parse(MessageSchema, { ...message, edited_at: null }).edited_at,
    null
  );
  for (const edited_at of [false, 0, new Date(timestamp), "invalid"]) {
    assert.equal(ok(MessageSchema, { ...message, edited_at }), false);
  }
});

it("edit requests accept the original updated_at without conversion", () => {
  for (const [schema, fields] of [
    [MessageUpdateSchema, { body: "Edited message" }],
    [ServerChannelUpdateSchema, { title: "Edited channel" }],
    [ServerUpdateSchema, { description: "Edited description" }],
  ] as const) {
    assert.equal(
      parse(schema, { ...fields, expected_updated_at: timestamp })
        .expected_updated_at,
      timestamp
    );
  }
});

it("metadata and description operations use the new version", () => {
  for (const capability of [
    "messages.update",
    "messages.create",
    "channels.update",
    "channels.create",
    "channels.read",
    "channels.events",
    "channels.move",
    "servers.update",
    "servers.read",
    "servers.events",
    "memberships.read",
    "memberships.write",
    "memberships.events",
  ]) {
    assert.deepEqual(CLIENT_WS_SUPPORTED_CAPABILITIES[capability], [
      "2026.11.13",
    ]);
  }
});
