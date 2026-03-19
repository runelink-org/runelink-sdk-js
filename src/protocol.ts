import { z } from "zod";
import {
  AuthTokenPasswordRequestSchema,
  AuthTokenRefreshRequestSchema,
  ChannelSchema,
  FullServerMembershipSchema,
  JwksResponseSchema,
  MessageSchema,
  NewChannelSchema,
  NewMessageSchema,
  NewServerMembershipSchema,
  NewServerSchema,
  NewUserSchema,
  OidcDiscoveryDocumentSchema,
  ServerMemberSchema,
  ServerMembershipSchema,
  ServerSchema,
  ServerWithChannelsSchema,
  SignupRequestSchema,
  TokenResponseSchema,
  UserRefSchema,
  UserSchema,
} from "./schema";

export const PROTOCOL_VERSION = "1.0.0";

export const RequestIdSchema = z.uuid();
export const EventIdSchema = z.uuid();

export const WsErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().nullable(),
});

function unitVariant<Type extends string>(type: Type) {
  return z.object({
    type: z.literal(type),
  });
}

function dataVariant<Type extends string, Schema extends z.ZodType>(
  type: Type,
  data: Schema
) {
  return z.object({
    type: z.literal(type),
    data,
  });
}

const TargetHostSchema = z.string();

export const WsConnectionStateSchema = z.discriminatedUnion("type", [
  unitVariant("unauthenticated"),
  dataVariant(
    "authenticated",
    z.object({
      user_ref: UserRefSchema,
    })
  ),
]);

export const AuthTokenAccessRequestSchema = z.object({
  access_token: z.string(),
});

export const WsRequestSchema = z.discriminatedUnion("type", [
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
    z.object({
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "users_get_by_ref",
    z.object({
      user_ref: UserRefSchema,
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "users_get_associated_hosts",
    z.object({
      user_ref: UserRefSchema,
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "users_delete",
    z.object({
      user_ref: UserRefSchema,
    })
  ),
  dataVariant(
    "memberships_get_by_user",
    z.object({
      user_ref: UserRefSchema,
    })
  ),
  dataVariant(
    "memberships_get_members_by_server",
    z.object({
      server_id: z.uuid(),
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "memberships_get_by_user_and_server",
    z.object({
      server_id: z.uuid(),
      user_ref: UserRefSchema,
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "memberships_create",
    z.object({
      server_id: z.uuid(),
      new_membership: NewServerMembershipSchema,
    })
  ),
  dataVariant(
    "memberships_delete",
    z.object({
      server_id: z.uuid(),
      user_ref: UserRefSchema,
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "servers_create",
    z.object({
      new_server: NewServerSchema,
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "servers_get_all",
    z.object({
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "servers_get_by_id",
    z.object({
      server_id: z.uuid(),
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "servers_get_with_channels",
    z.object({
      server_id: z.uuid(),
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "servers_delete",
    z.object({
      server_id: z.uuid(),
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "channels_create",
    z.object({
      server_id: z.uuid(),
      new_channel: NewChannelSchema,
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "channels_get_all",
    z.object({
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "channels_get_by_server",
    z.object({
      server_id: z.uuid(),
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "channels_get_by_id",
    z.object({
      server_id: z.uuid(),
      channel_id: z.uuid(),
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "channels_delete",
    z.object({
      server_id: z.uuid(),
      channel_id: z.uuid(),
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "messages_create",
    z.object({
      server_id: z.uuid(),
      channel_id: z.uuid(),
      new_message: NewMessageSchema,
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "messages_get_all",
    z.object({
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "messages_get_by_server",
    z.object({
      server_id: z.uuid(),
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "messages_get_by_channel",
    z.object({
      server_id: z.uuid(),
      channel_id: z.uuid(),
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "messages_get_by_id",
    z.object({
      server_id: z.uuid(),
      channel_id: z.uuid(),
      message_id: z.uuid(),
      target_host: TargetHostSchema.nullable(),
    })
  ),
  dataVariant(
    "messages_delete",
    z.object({
      server_id: z.uuid(),
      channel_id: z.uuid(),
      message_id: z.uuid(),
      target_host: TargetHostSchema.nullable(),
    })
  ),
]);

export const WsReplySchema = z.discriminatedUnion("type", [
  unitVariant("pong"),
  dataVariant("oidc_discovery", OidcDiscoveryDocumentSchema),
  dataVariant("oidc_jwks", JwksResponseSchema),
  dataVariant("connection_state", WsConnectionStateSchema),
  dataVariant("auth_signup", UserSchema),
  dataVariant("auth_token", TokenResponseSchema),
  dataVariant("auth_token_access", WsConnectionStateSchema),
  dataVariant("users_create", UserSchema),
  dataVariant("users_get_all", z.array(UserSchema)),
  dataVariant("users_get_by_ref", UserSchema),
  dataVariant("users_get_associated_hosts", z.array(z.string())),
  unitVariant("users_delete"),
  dataVariant("memberships_get_by_user", z.array(ServerMembershipSchema)),
  dataVariant("memberships_get_members_by_server", z.array(ServerMemberSchema)),
  dataVariant("memberships_get_by_user_and_server", ServerMemberSchema),
  dataVariant("memberships_create", FullServerMembershipSchema),
  unitVariant("memberships_delete"),
  dataVariant("servers_create", ServerSchema),
  dataVariant("servers_get_all", z.array(ServerSchema)),
  dataVariant("servers_get_by_id", ServerSchema),
  dataVariant("servers_get_with_channels", ServerWithChannelsSchema),
  unitVariant("servers_delete"),
  dataVariant("channels_create", ChannelSchema),
  dataVariant("channels_get_all", z.array(ChannelSchema)),
  dataVariant("channels_get_by_server", z.array(ChannelSchema)),
  dataVariant("channels_get_by_id", ChannelSchema),
  unitVariant("channels_delete"),
  dataVariant("messages_create", MessageSchema),
  dataVariant("messages_get_all", z.array(MessageSchema)),
  dataVariant("messages_get_by_server", z.array(MessageSchema)),
  dataVariant("messages_get_by_channel", z.array(MessageSchema)),
  dataVariant("messages_get_by_id", MessageSchema),
  unitVariant("messages_delete"),
]);

export const WsUpdateSchema = z.discriminatedUnion("type", [
  dataVariant("user_upserted", UserSchema),
  dataVariant(
    "user_deleted",
    z.object({
      user_ref: UserRefSchema,
    })
  ),
  dataVariant("membership_upserted", FullServerMembershipSchema),
  dataVariant(
    "membership_deleted",
    z.object({
      server_id: z.uuid(),
      user_ref: UserRefSchema,
    })
  ),
  dataVariant("server_upserted", ServerSchema),
  dataVariant(
    "server_deleted",
    z.object({
      server_id: z.uuid(),
    })
  ),
  dataVariant("channel_upserted", ChannelSchema),
  dataVariant(
    "channel_deleted",
    z.object({
      server_id: z.uuid(),
      channel_id: z.uuid(),
    })
  ),
  dataVariant("message_upserted", MessageSchema),
  dataVariant(
    "message_deleted",
    z.object({
      server_id: z.uuid(),
      channel_id: z.uuid(),
      message_id: z.uuid(),
    })
  ),
]);

export const WsRequestEnvelopeSchema = z.object({
  type: z.literal("request"),
  data: z.object({
    request_id: RequestIdSchema,
    request: WsRequestSchema,
  }),
});

export const WsReplyEnvelopeSchema = z.object({
  type: z.literal("reply"),
  data: z.object({
    request_id: RequestIdSchema,
    event_id: EventIdSchema,
    reply: WsReplySchema,
  }),
});

export const WsErrorEnvelopeSchema = z.object({
  type: z.literal("error"),
  data: z.object({
    request_id: RequestIdSchema.nullable(),
    event_id: EventIdSchema,
    error: WsErrorSchema,
  }),
});

export const WsUpdateEnvelopeSchema = z.object({
  type: z.literal("update"),
  data: z.object({
    event_id: EventIdSchema,
    update: WsUpdateSchema,
  }),
});

export const WsEnvelopeSchema = z.discriminatedUnion("type", [
  WsRequestEnvelopeSchema,
  WsReplyEnvelopeSchema,
  WsErrorEnvelopeSchema,
  WsUpdateEnvelopeSchema,
]);

export type RequestId = z.infer<typeof RequestIdSchema>;
export type EventId = z.infer<typeof EventIdSchema>;
export type WsError = z.infer<typeof WsErrorSchema>;
export type WsConnectionState = z.infer<typeof WsConnectionStateSchema>;
export type AuthTokenAccessRequest = z.infer<
  typeof AuthTokenAccessRequestSchema
>;
export type WsRequest = z.infer<typeof WsRequestSchema>;
export type WsReply = z.infer<typeof WsReplySchema>;
export type WsUpdate = z.infer<typeof WsUpdateSchema>;
export type WsRequestEnvelope = z.infer<typeof WsRequestEnvelopeSchema>;
export type WsReplyEnvelope = z.infer<typeof WsReplyEnvelopeSchema>;
export type WsErrorEnvelope = z.infer<typeof WsErrorEnvelopeSchema>;
export type WsUpdateEnvelope = z.infer<typeof WsUpdateEnvelopeSchema>;
export type WsEnvelope = z.infer<typeof WsEnvelopeSchema>;
