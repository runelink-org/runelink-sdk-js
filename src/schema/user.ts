import * as Schema from "effect/Schema";
import { Timestamp } from "./primitives.js";

export const UserRoleSchema = Schema.Literals(["user", "admin"]);

export const UserRefSchema = Schema.Struct({
  name: Schema.String,
  host: Schema.String,
});

export const UserSchema = Schema.Struct({
  name: Schema.String,
  host: Schema.String,
  role: UserRoleSchema,
  created_at: Timestamp,
  updated_at: Timestamp,
  synced_at: Schema.NullOr(Timestamp),
});

export const NewUserSchema = Schema.Struct({
  name: Schema.String,
  host: Schema.String,
  role: UserRoleSchema,
});

export type UserRole = typeof UserRoleSchema.Type;
export type UserRef = typeof UserRefSchema.Type;
export type User = typeof UserSchema.Type;
export type NewUser = typeof NewUserSchema.Type;
