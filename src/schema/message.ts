import { z } from "zod";
import { UserSchema, UserRefSchema } from "./user";

const messageFields = {
  id: z.uuid(),
  text_channel_id: z.uuid(),
  author: UserSchema.nullable(),
  reply_to: z.uuid().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
};

export const ActiveMessageSchema = z.object({
  ...messageFields,
  body: z.string(),
  deleted_at: z.null(),
});

export const DeletedMessageSchema = z.object({
  ...messageFields,
  body: z.null(),
  // Coercion alone would turn null into the Unix epoch.
  deleted_at: z.union([z.string(), z.date()]).pipe(z.coerce.date()),
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
