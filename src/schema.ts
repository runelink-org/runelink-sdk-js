import { z } from "zod";

export const UserRefSchema = z.object({
  name: z.string(),
  host: z.string(),
});

export const UserSchema = z.object({
  name: z.string(),
  host: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  synced_at: z.string().nullable(),
});

export const MessageSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  author_ref: UserRefSchema,
  body: z.string(),
});

export const ChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type UserRef = z.infer<typeof UserRefSchema>;
export type User = z.infer<typeof UserSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
