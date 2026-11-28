import * as Schema from "effect/Schema";
import { detailsUpdateFields } from "./edit.js";
import { MetadataSchema } from "./metadata.js";
import {
  ExactStruct,
  HostSchema,
  NullDefault,
  Timestamp,
  Uuid,
} from "./primitives.js";

export const ServerChannelKindSchema = Schema.Literals(["text", "category"]);

const serverChannelFields = {
  metadata: MetadataSchema.pipe(Schema.NullOr, Schema.optional),
  id: Uuid,
  // The host of the channel's server
  host: HostSchema,
  server_id: Uuid,
  title: Schema.String,
  description: NullDefault(Schema.String),
  // The parent category, or null at the server root
  parent_channel_id: Schema.NullOr(Uuid),
  // Ordering among siblings, by `position` then `id`
  position: Schema.Int,
  created_at: Timestamp,
  // Preserve sub-millisecond precision for edit preconditions.
  updated_at: Timestamp,
};

// A channel in a server's category tree. Text channels own exactly one
// underlying text channel; categories own none.
export const ServerChannelSchema = Schema.Union([
  Schema.Struct({
    ...serverChannelFields,
    kind: Schema.Literal("text"),
    text_channel_id: Uuid,
  }),
  Schema.Struct({
    ...serverChannelFields,
    kind: Schema.Literal("category"),
  }),
]);

// A new server channel, placed after its future siblings
export const NewServerChannelSchema = Schema.Struct({
  metadata: MetadataSchema.pipe(Schema.NullOr, Schema.optional),
  kind: ServerChannelKindSchema,
  title: Schema.String,
  description: Schema.String.pipe(Schema.NullOr, Schema.optional),
  parent_channel_id: Schema.NullOr(Uuid),
});

// Moves a server channel, with its subtree, to an index among the children of
// `parent_channel_id`. Indices past the end place it last.
export const ServerChannelMoveSchema = Schema.Struct({
  parent_channel_id: Schema.NullOr(Uuid),
  // A u32 on the host
  index: Schema.Finite.check(Schema.isUint32()),
});

export type ServerChannelKind = typeof ServerChannelKindSchema.Type;
export type ServerChannel = typeof ServerChannelSchema.Type;
export type NewServerChannel = typeof NewServerChannelSchema.Type;
export type ServerChannelMove = typeof ServerChannelMoveSchema.Type;

export const ServerChannelUpdateSchema = ExactStruct({
  ...detailsUpdateFields,
  metadata: MetadataSchema.pipe(Schema.NullOr, Schema.optional),
});
export type ServerChannelUpdate = typeof ServerChannelUpdateSchema.Type;
