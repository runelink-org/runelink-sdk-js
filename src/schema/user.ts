import { z } from "zod";

export const UserRoleSchema = z.enum(["user", "admin"]);

export const UserRefSchema = z.object({
  name: z.string(),
  host: z.string(),
});

export const UserSchema = z.object({
  name: z.string(),
  host: z.string(),
  role: UserRoleSchema,
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
  synced_at: z.string().datetime({ offset: true }).nullable(),
});

export const NewUserSchema = z.object({
  name: z.string(),
  host: z.string(),
  role: UserRoleSchema,
});

export type UserRole = z.infer<typeof UserRoleSchema>;
export type UserRef = z.infer<typeof UserRefSchema>;
export type User = z.infer<typeof UserSchema>;
export type NewUser = z.infer<typeof NewUserSchema>;
