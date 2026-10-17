import { z } from "zod";

export const ServerChannelKindSchema = z.enum(["text", "category"]);

// A channel in a server's category tree
export const ServerChannelSchema = z.object({
  id: z.uuid(),
  server_id: z.uuid(),
  kind: ServerChannelKindSchema,
  title: z.string(),
  description: z.string().nullable(),
  // Present exactly when `kind` is "text"
  text_channel_id: z.uuid().nullable(),
  // The parent category, or null at the server root
  parent_channel_id: z.uuid().nullable(),
  // Ordering among siblings, by `position` then `id`
  position: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

// A new server channel, placed after its future siblings
export const NewServerChannelSchema = z.object({
  kind: ServerChannelKindSchema,
  title: z.string(),
  description: z.string().nullable(),
  parent_channel_id: z.uuid().nullable(),
});

// Moves a server channel, with its subtree, to an index among the children of
// `parent_channel_id`. Indices past the end place it last.
export const ServerChannelMoveSchema = z.object({
  parent_channel_id: z.uuid().nullable(),
  index: z.number().int().nonnegative(),
});

export type ServerChannelKind = z.infer<typeof ServerChannelKindSchema>;
export type ServerChannel = z.infer<typeof ServerChannelSchema>;
export type NewServerChannel = z.infer<typeof NewServerChannelSchema>;
export type ServerChannelMove = z.infer<typeof ServerChannelMoveSchema>;
