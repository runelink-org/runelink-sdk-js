import { z } from "zod";
import { UserSchema, UserRefSchema } from "./user";

export const MessageSchema = z.object({
  id: z.uuid(),
  channel_id: z.uuid(),
  author: UserSchema.nullable(),
  body: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const NewMessageSchema = z.object({
  author: UserRefSchema,
  body: z.string(),
});

export type Message = z.infer<typeof MessageSchema>;
export type NewMessage = z.infer<typeof NewMessageSchema>;
