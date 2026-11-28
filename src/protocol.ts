import * as Schema from "effect/Schema";
import { MessageUpdateSchema } from "./schema/message.js";
import { ServerUpdateSchema } from "./schema/server.js";
import { ServerChannelUpdateSchema } from "./schema/channel.js";
import { HostSchema } from "./schema/host.js";
import { Uuid } from "./schema/primitives.js";
import {
  AuthTokenPasswordRequestSchema,
  AuthTokenRefreshRequestSchema,
  ChosenPresenceStatusSchema,
  FullServerMembershipSchema,
  JwksResponseSchema,
  MessageSchema,
  NewMessageSchema,
  NewServerMembershipSchema,
  NewServerChannelSchema,
  NewServerSchema,
  NewUserSchema,
  OidcDiscoveryDocumentSchema,
  MessageRefSchema,
  ServerChannelIdSchema,
  ServerChannelRefSchema,
  ServerRefSchema,
  TextChannelRefSchema,
  ServerChannelMoveSchema,
  ServerChannelSchema,
  ServerMemberSchema,
  ServerMembershipSchema,
  ServerSchema,
  ServerWithChannelsSchema,
  SignupRequestSchema,
  TokenResponseSchema,
  UserPresenceStatusSchema,
  UserRefSchema,
  UserSchema,
} from "./schema/index.js";
import {
  CapabilityHelloSchema,
  CapabilityWelcomeSchema,
} from "./capability.js";

export const RequestIdSchema = Uuid;
export const EventIdSchema = Uuid;

export const WsErrorSchema = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
  details: Schema.Unknown,
});

function unitVariant<const Type extends string>(type: Type) {
  return Schema.Struct({
    type: Schema.Literal(type),
  });
}

function dataVariant<const Type extends string, Data extends Schema.Top>(
  type: Type,
  data: Data
) {
  return Schema.Struct({
    type: Schema.Literal(type),
    data,
  });
}

const TargetHostSchema = Schema.NullOr(HostSchema);

const ChosenPresenceStatusDataSchema = Schema.Struct({
  status: ChosenPresenceStatusSchema,
});

export const WsConnectionStateSchema = Schema.Union([
  unitVariant("unauthenticated"),
  dataVariant(
    "authenticated",
    Schema.Struct({
      user_ref: UserRefSchema,
    })
  ),
]);

export const AuthTokenAccessRequestSchema = Schema.Struct({
  access_token: Schema.String,
});

export const WsRequestSchema = Schema.Union([
  unitVariant("ping"),
  unitVariant("oidc_discovery"),
  unitVariant("oidc_jwks"),
  unitVariant("connection_state"),
  dataVariant("auth_signup", SignupRequestSchema),
  dataVariant("auth_token_password", AuthTokenPasswordRequestSchema),
  dataVariant("auth_token_refresh", AuthTokenRefreshRequestSchema),
  dataVariant("auth_token_access", AuthTokenAccessRequestSchema),
  unitVariant("auth_userinfo"),
  unitVariant("auth_register_client"),
  dataVariant("users_create", NewUserSchema),
  dataVariant(
    "users_get_all",
    Schema.Struct({
      target_host: TargetHostSchema,
    })
  ),
  dataVariant(
    "users_get_by_ref",
    Schema.Struct({
      user_ref: UserRefSchema,
    })
  ),
  dataVariant(
    "users_get_associated_hosts",
    Schema.Struct({
      user_ref: UserRefSchema,
      target_host: TargetHostSchema,
    })
  ),
  dataVariant(
    "users_delete",
    Schema.Struct({
      user_ref: UserRefSchema,
    })
  ),
  dataVariant(
    "memberships_get_by_user",
    Schema.Struct({
      user_ref: UserRefSchema,
    })
  ),
  dataVariant(
    "memberships_get_members_by_server",
    Schema.Struct({
      server_ref: ServerRefSchema,
    })
  ),
  dataVariant(
    "memberships_get_by_user_and_server",
    Schema.Struct({
      server_ref: ServerRefSchema,
      user_ref: UserRefSchema,
    })
  ),
  dataVariant(
    "memberships_upsert",
    Schema.Struct({
      new_membership: NewServerMembershipSchema,
    })
  ),
  dataVariant(
    "memberships_delete",
    Schema.Struct({
      server_ref: ServerRefSchema,
      user_ref: UserRefSchema,
    })
  ),
  dataVariant(
    "servers_update",
    Schema.Struct({
      server_ref: ServerRefSchema,
      server_update: ServerUpdateSchema,
    })
  ),
  dataVariant(
    "servers_create",
    Schema.Struct({
      new_server: NewServerSchema,
      target_host: TargetHostSchema,
    })
  ),
  dataVariant(
    "servers_get_all",
    Schema.Struct({
      target_host: TargetHostSchema,
    })
  ),
  dataVariant(
    "servers_get_by_id",
    Schema.Struct({
      server_ref: ServerRefSchema,
    })
  ),
  dataVariant(
    "servers_get_with_channels",
    Schema.Struct({
      server_ref: ServerRefSchema,
    })
  ),
  dataVariant(
    "servers_delete",
    Schema.Struct({
      server_ref: ServerRefSchema,
    })
  ),
  dataVariant(
    "channels_update",
    Schema.Struct({
      channel_ref: ServerChannelRefSchema,
      channel_update: ServerChannelUpdateSchema,
    })
  ),
  dataVariant(
    "channels_create",
    Schema.Struct({
      server_ref: ServerRefSchema,
      new_channel: NewServerChannelSchema,
    })
  ),
  dataVariant(
    "channels_get_all",
    Schema.Struct({
      target_host: TargetHostSchema,
    })
  ),
  dataVariant(
    "channels_get_by_server",
    Schema.Struct({
      server_ref: ServerRefSchema,
    })
  ),
  dataVariant(
    "channels_get_by_id",
    Schema.Struct({
      channel_ref: ServerChannelRefSchema,
    })
  ),
  dataVariant(
    "channels_delete",
    Schema.Struct({
      channel_ref: ServerChannelRefSchema,
    })
  ),
  dataVariant(
    "channels_move",
    Schema.Struct({
      channel_ref: ServerChannelRefSchema,
      channel_move: ServerChannelMoveSchema,
    })
  ),
  dataVariant(
    "messages_update",
    Schema.Struct({
      message_ref: MessageRefSchema,
      message_update: MessageUpdateSchema,
    })
  ),
  dataVariant(
    "messages_create",
    Schema.Struct({
      text_channel_ref: TextChannelRefSchema,
      new_message: NewMessageSchema,
    })
  ),
  dataVariant(
    "messages_get_all",
    Schema.Struct({
      target_host: TargetHostSchema,
    })
  ),
  dataVariant(
    "messages_get_by_server",
    Schema.Struct({
      server_ref: ServerRefSchema,
    })
  ),
  dataVariant(
    "messages_get_by_text_channel",
    Schema.Struct({
      text_channel_ref: TextChannelRefSchema,
    })
  ),
  dataVariant(
    "messages_get_by_id",
    Schema.Struct({
      message_ref: MessageRefSchema,
    })
  ),
  dataVariant(
    "messages_delete",
    Schema.Struct({
      message_ref: MessageRefSchema,
    })
  ),
  dataVariant("presence_status_update", ChosenPresenceStatusDataSchema),
]);

export const WsReplySchema = Schema.Union([
  unitVariant("pong"),
  dataVariant("oidc_discovery", OidcDiscoveryDocumentSchema),
  dataVariant("oidc_jwks", JwksResponseSchema),
  dataVariant("connection_state", WsConnectionStateSchema),
  dataVariant("auth_signup", UserSchema),
  dataVariant("auth_token", TokenResponseSchema),
  dataVariant("auth_token_access", WsConnectionStateSchema),
  dataVariant("users_create", UserSchema),
  dataVariant("users_get_all", Schema.Array(UserSchema)),
  dataVariant("users_get_by_ref", UserSchema),
  dataVariant("users_get_associated_hosts", Schema.Array(HostSchema)),
  unitVariant("users_delete"),
  dataVariant("memberships_get_by_user", Schema.Array(ServerMembershipSchema)),
  dataVariant(
    "memberships_get_members_by_server",
    Schema.Array(ServerMemberSchema)
  ),
  dataVariant("memberships_get_by_user_and_server", ServerMemberSchema),
  dataVariant("memberships_upsert", FullServerMembershipSchema),
  unitVariant("memberships_delete"),
  dataVariant("servers_update", ServerSchema),
  dataVariant("servers_create", ServerSchema),
  dataVariant("servers_get_all", Schema.Array(ServerSchema)),
  dataVariant("servers_get_by_id", ServerSchema),
  dataVariant("servers_get_with_channels", ServerWithChannelsSchema),
  unitVariant("servers_delete"),
  dataVariant("channels_update", ServerChannelSchema),
  dataVariant("channels_create", ServerChannelSchema),
  dataVariant("channels_get_all", Schema.Array(ServerChannelSchema)),
  dataVariant("channels_get_by_server", Schema.Array(ServerChannelSchema)),
  dataVariant("channels_get_by_id", ServerChannelSchema),
  unitVariant("channels_delete"),
  dataVariant("channels_move", Schema.Array(ServerChannelSchema)),
  dataVariant("messages_update", MessageSchema),
  dataVariant("messages_create", MessageSchema),
  dataVariant("messages_get_all", Schema.Array(MessageSchema)),
  dataVariant("messages_get_by_server", Schema.Array(MessageSchema)),
  dataVariant("messages_get_by_text_channel", Schema.Array(MessageSchema)),
  dataVariant("messages_get_by_id", MessageSchema),
  dataVariant("messages_delete", MessageSchema),
  unitVariant("presence_status_update"),
]);

export const WsUpdateSchema = Schema.Union([
  dataVariant("user_upserted", UserSchema),
  dataVariant(
    "user_deleted",
    Schema.Struct({
      user_ref: UserRefSchema,
    })
  ),
  dataVariant("membership_upserted", FullServerMembershipSchema),
  dataVariant(
    "membership_deleted",
    Schema.Struct({
      server_ref: ServerRefSchema,
      user_ref: UserRefSchema,
    })
  ),
  dataVariant("server_upserted", ServerSchema),
  dataVariant(
    "server_deleted",
    Schema.Struct({
      server_ref: ServerRefSchema,
    })
  ),
  dataVariant("channel_upserted", ServerChannelSchema),
  dataVariant(
    "channel_deleted",
    Schema.Struct({
      server_ref: ServerRefSchema,
      channel_id: ServerChannelIdSchema,
    })
  ),
  dataVariant("message_upserted", MessageSchema),
  dataVariant("presence_status_updated", UserPresenceStatusSchema),
  dataVariant("chosen_presence_status_updated", ChosenPresenceStatusDataSchema),
]);

export const WsRequestEnvelopeSchema = dataVariant(
  "request",
  Schema.Struct({
    request_id: RequestIdSchema,
    request: WsRequestSchema,
  })
);

export const WsHelloEnvelopeSchema = dataVariant(
  "hello",
  CapabilityHelloSchema
);

export const WsWelcomeEnvelopeSchema = dataVariant(
  "welcome",
  CapabilityWelcomeSchema
);

export const WsReplyEnvelopeSchema = dataVariant(
  "reply",
  Schema.Struct({
    request_id: RequestIdSchema,
    event_id: EventIdSchema,
    reply: WsReplySchema,
  })
);

export const WsErrorEnvelopeSchema = dataVariant(
  "error",
  Schema.Struct({
    request_id: Schema.NullOr(RequestIdSchema),
    event_id: EventIdSchema,
    error: WsErrorSchema,
  })
);

export const WsUpdateEnvelopeSchema = dataVariant(
  "update",
  Schema.Struct({
    event_id: EventIdSchema,
    update: WsUpdateSchema,
  })
);

export const WsEnvelopeSchema = Schema.Union([
  WsHelloEnvelopeSchema,
  WsWelcomeEnvelopeSchema,
  WsRequestEnvelopeSchema,
  WsReplyEnvelopeSchema,
  WsErrorEnvelopeSchema,
  WsUpdateEnvelopeSchema,
]);

export type RequestId = typeof RequestIdSchema.Type;
export type EventId = typeof EventIdSchema.Type;
export type WsError = typeof WsErrorSchema.Type;
export type WsConnectionState = typeof WsConnectionStateSchema.Type;
export type AuthTokenAccessRequest = typeof AuthTokenAccessRequestSchema.Type;
export type WsRequest = typeof WsRequestSchema.Type;
export type WsReply = typeof WsReplySchema.Type;
export type WsUpdate = typeof WsUpdateSchema.Type;
export type WsRequestEnvelope = typeof WsRequestEnvelopeSchema.Type;
export type WsHelloEnvelope = typeof WsHelloEnvelopeSchema.Type;
export type WsWelcomeEnvelope = typeof WsWelcomeEnvelopeSchema.Type;
export type WsReplyEnvelope = typeof WsReplyEnvelopeSchema.Type;
export type WsErrorEnvelope = typeof WsErrorEnvelopeSchema.Type;
export type WsUpdateEnvelope = typeof WsUpdateEnvelopeSchema.Type;
export type WsEnvelope = typeof WsEnvelopeSchema.Type;

/** The reply type the host sends for each request type. */
export const REPLY_TYPE_BY_REQUEST_TYPE = {
  ping: "pong",
  oidc_discovery: "oidc_discovery",
  oidc_jwks: "oidc_jwks",
  connection_state: "connection_state",
  auth_signup: "auth_signup",
  auth_token_password: "auth_token",
  auth_token_refresh: "auth_token",
  auth_token_access: "auth_token_access",
  auth_userinfo: null,
  auth_register_client: null,
  users_create: "users_create",
  users_get_all: "users_get_all",
  users_get_by_ref: "users_get_by_ref",
  users_get_associated_hosts: "users_get_associated_hosts",
  users_delete: "users_delete",
  memberships_get_by_user: "memberships_get_by_user",
  memberships_get_members_by_server: "memberships_get_members_by_server",
  memberships_get_by_user_and_server: "memberships_get_by_user_and_server",
  memberships_upsert: "memberships_upsert",
  memberships_delete: "memberships_delete",
  servers_update: "servers_update",
  servers_create: "servers_create",
  servers_get_all: "servers_get_all",
  servers_get_by_id: "servers_get_by_id",
  servers_get_with_channels: "servers_get_with_channels",
  servers_delete: "servers_delete",
  channels_update: "channels_update",
  channels_create: "channels_create",
  channels_get_all: "channels_get_all",
  channels_get_by_server: "channels_get_by_server",
  channels_get_by_id: "channels_get_by_id",
  channels_delete: "channels_delete",
  channels_move: "channels_move",
  messages_update: "messages_update",
  messages_create: "messages_create",
  messages_get_all: "messages_get_all",
  messages_get_by_server: "messages_get_by_server",
  messages_get_by_text_channel: "messages_get_by_text_channel",
  messages_get_by_id: "messages_get_by_id",
  messages_delete: "messages_delete",
  presence_status_update: "presence_status_update",
} as const satisfies Record<WsRequest["type"], WsReply["type"] | null>;

/** The reply to a request of the given type. */
export type ReplyFor<Type extends WsRequest["type"]> = Extract<
  WsReply,
  { type: (typeof REPLY_TYPE_BY_REQUEST_TYPE)[Type] }
>;
