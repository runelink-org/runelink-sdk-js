import * as Schema from "effect/Schema";
import { ServerChannelSchema } from "./channel.js";
import { detailsUpdateFields } from "./edit.js";
import { ExactStruct, NullDefault, Timestamp, Uuid } from "./primitives.js";
import { UserRefSchema, UserSchema } from "./user.js";

export const ServerSchema = Schema.Struct({
  id: Uuid,
  host: Schema.String,
  title: Schema.String,
  description: NullDefault(Schema.String),
  created_at: Timestamp,
  // Preserve sub-millisecond precision for edit preconditions.
  updated_at: Timestamp,
});

export const NewServerSchema = Schema.Struct({
  title: Schema.String,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  // Also create the default channels: a "general" text channel.
  default_channels: Schema.optional(Schema.Boolean),
});

export const ServerWithChannelsSchema = Schema.Struct({
  server: ServerSchema,
  channels: Schema.Array(ServerChannelSchema),
});

export const ServerRoleSchema = Schema.Literals(["member", "admin"]);

export const ServerMembershipSchema = Schema.Struct({
  server: ServerSchema,
  user_ref: UserRefSchema,
  role: ServerRoleSchema,
  joined_at: Timestamp,
  updated_at: Timestamp,
  synced_at: Schema.NullOr(Timestamp),
});

export const FullServerMembershipSchema = Schema.Struct({
  server: ServerSchema,
  user: UserSchema,
  role: ServerRoleSchema,
  joined_at: Timestamp,
  updated_at: Timestamp,
  synced_at: Schema.NullOr(Timestamp),
});

export const ServerMemberSchema = Schema.Struct({
  user: UserSchema,
  role: ServerRoleSchema,
  joined_at: Timestamp,
  updated_at: Timestamp,
});

export const NewServerMembershipSchema = Schema.Struct({
  user_ref: UserRefSchema,
  server_id: Uuid,
  server_host: Schema.String,
  role: ServerRoleSchema,
});

export type Server = typeof ServerSchema.Type;
export type NewServer = typeof NewServerSchema.Type;
export type ServerWithChannels = typeof ServerWithChannelsSchema.Type;
export type ServerRole = typeof ServerRoleSchema.Type;
export type ServerMembership = typeof ServerMembershipSchema.Type;
export type FullServerMembership = typeof FullServerMembershipSchema.Type;
export type ServerMember = typeof ServerMemberSchema.Type;
export type NewServerMembership = typeof NewServerMembershipSchema.Type;

export const ServerUpdateSchema = ExactStruct(detailsUpdateFields);
export type ServerUpdate = typeof ServerUpdateSchema.Type;
