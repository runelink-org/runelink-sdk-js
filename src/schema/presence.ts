import * as Schema from "effect/Schema";
import { UserRefSchema } from "./user.js";

/** A user's presence status, as other users see it. */
export const PresenceStatusSchema = Schema.Literals([
  "online",
  "do_not_disturb",
  "offline",
]);

/**
 * The presence status a user chose for themselves while they are online.
 * `invisible` is shown to other users as offline. Users are online again
 * whenever they come back after being offline.
 */
export const ChosenPresenceStatusSchema = Schema.Literals([
  "online",
  "do_not_disturb",
  "invisible",
]);

export const UserPresenceStatusSchema = Schema.Struct({
  user_ref: UserRefSchema,
  status: PresenceStatusSchema,
});

export type PresenceStatus = typeof PresenceStatusSchema.Type;
export type ChosenPresenceStatus = typeof ChosenPresenceStatusSchema.Type;
export type UserPresenceStatus = typeof UserPresenceStatusSchema.Type;
