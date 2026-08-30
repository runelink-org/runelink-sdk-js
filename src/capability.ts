import { z } from "zod";
import type { WsRequest, WsUpdate } from "./protocol";

export const NEGOTIATION_VERSION = 1;

export const CapabilityVersionSchema = z.number().int().positive().max(65_535);

export const SupportedCapabilitiesSchema = z.record(
  z.string(),
  z.array(CapabilityVersionSchema)
);
export const NegotiatedCapabilitiesSchema = z.record(
  z.string(),
  CapabilityVersionSchema
);

export const CapabilityHelloSchema = z.object({
  negotiation_version: z.literal(NEGOTIATION_VERSION),
  capabilities: SupportedCapabilitiesSchema,
});

export const CapabilityWelcomeSchema = z.object({
  negotiation_version: z.literal(NEGOTIATION_VERSION),
  capabilities: NegotiatedCapabilitiesSchema,
  server_version: z.string(),
});

export type SupportedCapabilities = z.infer<typeof SupportedCapabilitiesSchema>;
export type NegotiatedCapabilities = z.infer<
  typeof NegotiatedCapabilitiesSchema
>;

function freezeCapabilities<T extends Record<string, number[]>>(
  capabilities: T
): Readonly<T> {
  for (const versions of Object.values(capabilities)) Object.freeze(versions);
  return Object.freeze(capabilities);
}

// All current implemented capability protocol versions
const capabilityVersion = {
  system: {
    ping: 1,
    connectionState: 1,
  },
  auth: {
    discovery: 1,
    authenticate: 1,
    signup: 1,
    token: 1,
  },
  users: {
    create: 1,
    read: 1,
    delete: 1,
    events: 1,
  },
  memberships: {
    read: 1,
    write: 1,
    events: 1,
  },
  servers: {
    create: 1,
    read: 1,
    delete: 1,
    events: 1,
  },
  channels: {
    create: 1,
    read: 1,
    delete: 1,
    events: 1,
  },
  messages: {
    create: 1,
    read: 1,
    delete: 1,
    events: 1,
  },
} as const;

// The current supported protocol versions of each capability
// Protocol versions are grouped by capability name here
const capabilityVersions = {
  system: {
    ping: [capabilityVersion.system.ping],
    connectionState: [capabilityVersion.system.connectionState],
  },
  auth: {
    discovery: [capabilityVersion.auth.discovery],
    authenticate: [capabilityVersion.auth.authenticate],
    signup: [capabilityVersion.auth.signup],
    token: [capabilityVersion.auth.token],
    userinfo: [],
    registerClient: [],
  },
  users: {
    create: [capabilityVersion.users.create],
    read: [capabilityVersion.users.read],
    delete: [capabilityVersion.users.delete],
    events: [capabilityVersion.users.events],
  },
  memberships: {
    read: [capabilityVersion.memberships.read],
    write: [capabilityVersion.memberships.write],
    events: [capabilityVersion.memberships.events],
  },
  servers: {
    create: [capabilityVersion.servers.create],
    read: [capabilityVersion.servers.read],
    delete: [capabilityVersion.servers.delete],
    events: [capabilityVersion.servers.events],
  },
  channels: {
    create: [capabilityVersion.channels.create],
    read: [capabilityVersion.channels.read],
    delete: [capabilityVersion.channels.delete],
    events: [capabilityVersion.channels.events],
  },
  messages: {
    create: [capabilityVersion.messages.create],
    read: [capabilityVersion.messages.read],
    delete: [capabilityVersion.messages.delete],
    events: [capabilityVersion.messages.events],
  },
};

const clientWsCapabilityCatalog = freezeCapabilities({
  ping: capabilityVersions.system.ping,
  "connection.state": capabilityVersions.system.connectionState,
  "auth.discovery": capabilityVersions.auth.discovery,
  "auth.authenticate": capabilityVersions.auth.authenticate,
  "auth.signup": capabilityVersions.auth.signup,
  "auth.token": capabilityVersions.auth.token,
  "auth.userinfo": capabilityVersions.auth.userinfo,
  "auth.register-client": capabilityVersions.auth.registerClient,
  "users.create": capabilityVersions.users.create,
  "users.read": capabilityVersions.users.read,
  "users.delete": capabilityVersions.users.delete,
  "memberships.read": capabilityVersions.memberships.read,
  "memberships.write": capabilityVersions.memberships.write,
  "servers.create": capabilityVersions.servers.create,
  "servers.read": capabilityVersions.servers.read,
  "servers.delete": capabilityVersions.servers.delete,
  "channels.create": capabilityVersions.channels.create,
  "channels.read": capabilityVersions.channels.read,
  "channels.delete": capabilityVersions.channels.delete,
  "messages.create": capabilityVersions.messages.create,
  "messages.read": capabilityVersions.messages.read,
  "messages.delete": capabilityVersions.messages.delete,
  "users.events": capabilityVersions.users.events,
  "memberships.events": capabilityVersions.memberships.events,
  "servers.events": capabilityVersions.servers.events,
  "channels.events": capabilityVersions.channels.events,
  "messages.events": capabilityVersions.messages.events,
});

export type ClientWsCapabilityId = keyof typeof clientWsCapabilityCatalog;

export const CLIENT_WS_SUPPORTED_CAPABILITIES: SupportedCapabilities =
  clientWsCapabilityCatalog;

export function requestCapability(request: WsRequest): ClientWsCapabilityId {
  switch (request.type) {
    case "ping":
      return "ping";
    case "oidc_discovery":
    case "oidc_jwks":
      return "auth.discovery";
    case "connection_state":
      return "connection.state";
    case "auth_signup":
      return "auth.signup";
    case "auth_token_password":
    case "auth_token_refresh":
      return "auth.token";
    case "auth_token_access":
      return "auth.authenticate";
    case "auth_userinfo":
      return "auth.userinfo";
    case "auth_register_client":
      return "auth.register-client";
    case "users_create":
      return "users.create";
    case "users_get_all":
    case "users_get_by_ref":
    case "users_get_associated_hosts":
      return "users.read";
    case "users_delete":
      return "users.delete";
    case "memberships_get_by_user":
    case "memberships_get_members_by_server":
    case "memberships_get_by_user_and_server":
      return "memberships.read";
    case "memberships_upsert":
    case "memberships_delete":
      return "memberships.write";
    case "servers_create":
      return "servers.create";
    case "servers_get_all":
    case "servers_get_by_id":
    case "servers_get_with_channels":
      return "servers.read";
    case "servers_delete":
      return "servers.delete";
    case "channels_create":
      return "channels.create";
    case "channels_get_all":
    case "channels_get_by_server":
    case "channels_get_by_id":
      return "channels.read";
    case "channels_delete":
      return "channels.delete";
    case "messages_create":
      return "messages.create";
    case "messages_get_all":
    case "messages_get_by_server":
    case "messages_get_by_channel":
    case "messages_get_by_id":
      return "messages.read";
    case "messages_delete":
      return "messages.delete";
  }
}

export function updateCapability(update: WsUpdate): ClientWsCapabilityId {
  switch (update.type) {
    case "user_upserted":
    case "user_deleted":
      return "users.events";
    case "membership_upserted":
    case "membership_deleted":
      return "memberships.events";
    case "server_upserted":
    case "server_deleted":
      return "servers.events";
    case "channel_upserted":
    case "channel_deleted":
      return "channels.events";
    case "message_upserted":
    case "message_deleted":
      return "messages.events";
  }
}
