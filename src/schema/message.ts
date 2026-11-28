import * as Schema from "effect/Schema";
import { MetadataSchema } from "./metadata.js";
import {
  ExactStruct,
  HostSchema,
  NullDefault,
  Timestamp,
  Uuid,
} from "./primitives.js";
import { UserRefSchema, UserSchema } from "./user.js";

const messageFields = {
  metadata: MetadataSchema.pipe(Schema.NullOr, Schema.optional),
  id: Uuid,
  // The host of the message's text channel
  host: HostSchema,
  text_channel_id: Uuid,
  author: Schema.NullOr(UserSchema),
  // A message in the same text channel
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
  metadata: MetadataSchema.pipe(Schema.NullOr, Schema.optional),
  author: UserRefSchema,
  body: Schema.String,
  reply_to: Uuid.pipe(Schema.NullOr, Schema.optional),
});

export type ActiveMessage = typeof ActiveMessageSchema.Type;
export type DeletedMessage = typeof DeletedMessageSchema.Type;
export type Message = typeof MessageSchema.Type;
export type NewMessage = typeof NewMessageSchema.Type;

export const MessageUpdateSchema = ExactStruct({
  body: Schema.String.pipe(Schema.NullOr, Schema.optional),
  // Omitted preserves metadata; null clears it; an object replaces it.
  metadata: MetadataSchema.pipe(Schema.NullOr, Schema.optional),
  expected_updated_at: Timestamp,
});
export type MessageUpdate = typeof MessageUpdateSchema.Type;
