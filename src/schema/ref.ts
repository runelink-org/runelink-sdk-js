import * as Brand from "effect/Brand";
import * as Schema from "effect/Schema";
import { HostSchema, Uuid } from "./primitives.js";

// IDs are only unique among resources of one kind on one host. Each kind has
// its own type, so an ID of one kind can't be used for another.
export const ServerIdSchema = Uuid.pipe(Schema.brand("ServerId"));
export const ServerChannelIdSchema = Uuid.pipe(Schema.brand("ServerChannelId"));
export const TextChannelIdSchema = Uuid.pipe(Schema.brand("TextChannelId"));
export const MessageIdSchema = Uuid.pipe(Schema.brand("MessageId"));

export type ServerId = typeof ServerIdSchema.Type;
export type ServerChannelId = typeof ServerChannelIdSchema.Type;
export type TextChannelId = typeof TextChannelIdSchema.Type;
export type MessageId = typeof MessageIdSchema.Type;

/**
 * A resource's owning host and its ID, which is only unique on that host.
 * Together they identify the resource across hosts.
 */
export interface ResourceRef<Id extends string> {
  readonly host: string;
  readonly id: Id;
}

function resourceRefSchema<Id extends Schema.Top>(id: Id) {
  return Schema.Struct({ host: HostSchema, id });
}

export const ServerRefSchema = resourceRefSchema(ServerIdSchema);
export const ServerChannelRefSchema = resourceRefSchema(ServerChannelIdSchema);
export const TextChannelRefSchema = resourceRefSchema(TextChannelIdSchema);
export const MessageRefSchema = resourceRefSchema(MessageIdSchema);

export type ServerRef = ResourceRef<ServerId>;
export type ServerChannelRef = ResourceRef<ServerChannelId>;
export type TextChannelRef = ResourceRef<TextChannelId>;
export type MessageRef = ResourceRef<MessageId>;

declare const resourceKeyId: unique symbol;

/**
 * A string that identifies a resource across hosts, such as a map key. Keys
 * of different kinds of resources have different types.
 */
export type ResourceKey<Id extends string> = Brand.Branded<
  string,
  "ResourceKey"
> & { readonly [resourceKeyId]?: Id };

/**
 * The key of a resource or reference. Servers, channels, and messages are
 * their own references.
 */
export function resourceKey<Id extends string>(
  ref: ResourceRef<Id>
): ResourceKey<Id> {
  return Brand.nominal<ResourceKey<Id>>()(`${ref.id}@${ref.host}`);
}

/** The server that a channel is in, which is on the channel's host. */
export function channelServerRef(channel: {
  readonly host: string;
  readonly server_id: ServerId;
}): ServerRef {
  return { host: channel.host, id: channel.server_id };
}

/**
 * The text channel that a server text channel owns, or that a message is in,
 * which is on the same host.
 */
export function textChannelRef(owner: {
  readonly host: string;
  readonly text_channel_id: TextChannelId;
}): TextChannelRef {
  return { host: owner.host, id: owner.text_channel_id };
}
