import * as Brand from "effect/Brand";
import * as Schema from "effect/Schema";
import { HostSchema, Uuid } from "./primitives.js";

/**
 * A resource's owning host and its ID, which is only unique on that host.
 * Together they identify the resource across hosts.
 */
export const ResourceRefSchema = Schema.Struct({
  host: HostSchema,
  id: Uuid,
});

export type ResourceRef = typeof ResourceRefSchema.Type;

/** A string that identifies a resource across hosts, such as a map key. */
export type ResourceKey = Brand.Branded<string, "ResourceKey">;

const makeResourceKey = Brand.nominal<ResourceKey>();

/**
 * The key of a resource or reference. Servers, channels, and messages are
 * their own references.
 */
export function resourceKey(ref: ResourceRef): ResourceKey {
  return makeResourceKey(`${ref.id}@${ref.host}`);
}

/** The server that a channel is in, which is on the channel's host. */
export function channelServerRef(channel: {
  readonly host: string;
  readonly server_id: string;
}): ResourceRef {
  return { host: channel.host, id: channel.server_id };
}

/**
 * The text channel that a server text channel owns, or that a message is in,
 * which is on the same host.
 */
export function textChannelRef(owner: {
  readonly host: string;
  readonly text_channel_id: string;
}): ResourceRef {
  return { host: owner.host, id: owner.text_channel_id };
}
