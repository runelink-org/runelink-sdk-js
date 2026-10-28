import { editVersionFields, withUpdateVersion } from "./edit";
import { z } from "zod";

export const ServerChannelKindSchema = z.enum(["text", "category"]);

const ServerChannelBaseSchema = z.object({
  id: z.uuid(),
  server_id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  // The parent category, or null at the server root
  parent_channel_id: z.uuid().nullable(),
  // Ordering among siblings, by `position` then `id`
  position: z.number().int(),
  created_at: z.coerce.date(),
  ...editVersionFields,
});

// A channel in a server's category tree. Text channels own exactly one
// underlying text channel; categories own none.
export const ServerChannelSchema = z
  .discriminatedUnion("kind", [
    ServerChannelBaseSchema.extend({
      kind: z.literal("text"),
      text_channel_id: z.uuid(),
    }),
    ServerChannelBaseSchema.extend({
      kind: z.literal("category"),
    }),
  ])
  .transform(withUpdateVersion);

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
  // A u32 on the host
  index: z.number().int().nonnegative().max(4294967295),
});

export type ServerChannelKind = z.infer<typeof ServerChannelKindSchema>;
export type ServerChannel = z.infer<typeof ServerChannelSchema>;
export type NewServerChannel = z.infer<typeof NewServerChannelSchema>;
export type ServerChannelMove = z.infer<typeof ServerChannelMoveSchema>;

export { DetailsUpdateSchema as ServerChannelUpdateSchema } from "./edit";
export type { DetailsUpdate as ServerChannelUpdate } from "./edit";
