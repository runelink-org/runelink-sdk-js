import { z } from "zod";

export const ChannelSchema = z.object({
  id: z.uuid(),
  server_id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const NewChannelSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
});

export type Channel = z.infer<typeof ChannelSchema>;
export type NewChannel = z.infer<typeof NewChannelSchema>;
