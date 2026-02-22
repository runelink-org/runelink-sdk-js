import { z } from "zod";
import { UserSchema, UserRefSchema } from "./user";
import { ChannelSchema } from "./channel";

export const ServerSchema = z.object({
  id: z.uuid(),
  host: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const NewServerSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
});

export const ServerWithChannelsSchema = z.object({
  server: ServerSchema,
  channels: z.array(ChannelSchema),
});

export const ServerRoleSchema = z.enum(["member", "admin"]);

export const ServerMembershipSchema = z.object({
  server: ServerSchema,
  user_ref: UserRefSchema,
  role: ServerRoleSchema,
  joined_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  synced_at: z.coerce.date().nullable(),
});

export const FullServerMembershipSchema = z.object({
  server: ServerSchema,
  user: UserSchema,
  role: ServerRoleSchema,
  joined_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  synced_at: z.coerce.date().nullable(),
});

export const ServerMemberSchema = z.object({
  user: UserSchema,
  role: ServerRoleSchema,
  joined_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const NewServerMembershipSchema = z.object({
  user_ref: UserRefSchema,
  server_id: z.uuid(),
  server_host: z.string(),
  role: ServerRoleSchema,
});

export type Server = z.infer<typeof ServerSchema>;
export type NewServer = z.infer<typeof NewServerSchema>;
export type ServerWithChannels = z.infer<typeof ServerWithChannelsSchema>;
export type ServerRole = z.infer<typeof ServerRoleSchema>;
export type ServerMembership = z.infer<typeof ServerMembershipSchema>;
export type FullServerMembership = z.infer<typeof FullServerMembershipSchema>;
export type ServerMember = z.infer<typeof ServerMemberSchema>;
export type NewServerMembership = z.infer<typeof NewServerMembershipSchema>;
