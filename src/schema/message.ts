import * as Schema from "effect/Schema";
import { MetadataSchema } from "./metadata.js";
import { ExactStruct, NullDefault, Timestamp, Uuid } from "./primitives.js";
import { UserRefSchema, UserSchema } from "./user.js";

const messageFields = {
  metadata: Schema.optional(Schema.NullOr(MetadataSchema)),
  id: Uuid,
  text_channel_id: Uuid,
  author: Schema.NullOr(UserSchema),
  reply_to: Schema.NullOr(Uuid),
  edited_at: NullDefault(Timestamp),
  created_at: Timestamp,
  // Preserve sub-millisecond precision for edit preconditions.
  updated_at: Timestamp,
};

export const ActiveMessageSchema = Schema.Struct({
  ...messageFields,
  body: Schema.String,
  deleted_at: Schema.Null,
});

export const DeletedMessageSchema = Schema.Struct({
  ...messageFields,
  body: Schema.Null,
  deleted_at: Timestamp,
});

// Both runtime validation and TypeScript narrowing enforce the content state.
export const MessageSchema = Schema.Union([
  ActiveMessageSchema,
  DeletedMessageSchema,
]);

export const NewMessageSchema = Schema.Struct({
  metadata: Schema.optional(Schema.NullOr(MetadataSchema)),
  author: UserRefSchema,
  body: Schema.String,
  reply_to: Schema.optional(Schema.NullOr(Uuid)),
});

export type ActiveMessage = typeof ActiveMessageSchema.Type;
export type DeletedMessage = typeof DeletedMessageSchema.Type;
export type Message = typeof MessageSchema.Type;
export type NewMessage = typeof NewMessageSchema.Type;

export const MessageUpdateSchema = ExactStruct({
  body: Schema.optional(Schema.NullOr(Schema.String)),
  // Omitted preserves metadata; null clears it; an object replaces it.
  metadata: Schema.optional(Schema.NullOr(MetadataSchema)),
  expected_updated_at: Timestamp,
});
export type MessageUpdate = typeof MessageUpdateSchema.Type;
