import { z } from "zod";
import { UserSchema, UserRefSchema } from "./user.js";

const messageFields = {
  id: z.uuid(),
  text_channel_id: z.uuid(),
  author: UserSchema.nullable(),
  reply_to: z.uuid().nullable(),
  edited_at: z.string().datetime({ offset: true }).nullable().default(null),
  created_at: z.string().datetime({ offset: true }),
  // Preserve sub-millisecond precision for edit preconditions.
  updated_at: z.string().datetime({ offset: true }),
};

export const ActiveMessageSchema = z.object({
  ...messageFields,
  body: z.string(),
  deleted_at: z.null(),
});

export const DeletedMessageSchema = z.object({
  ...messageFields,
  body: z.null(),
  deleted_at: z.string().datetime({ offset: true }),
});

// Both runtime validation and TypeScript narrowing enforce the content state.
export const MessageSchema = z.union([
  ActiveMessageSchema,
  DeletedMessageSchema,
]);

export const NewMessageSchema = z.object({
  author: UserRefSchema,
  body: z.string(),
  reply_to: z.uuid().nullable().optional(),
});

export type ActiveMessage = z.infer<typeof ActiveMessageSchema>;
export type DeletedMessage = z.infer<typeof DeletedMessageSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type NewMessage = z.infer<typeof NewMessageSchema>;

export const MessageUpdateSchema = z.strictObject({
  body: z.string(),
  expected_updated_at: z.string().datetime({ offset: true }),
});
export type MessageUpdate = z.infer<typeof MessageUpdateSchema>;
