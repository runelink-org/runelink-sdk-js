import * as Schema from "effect/Schema";
import { Timestamp } from "./primitives.js";

export const detailsUpdateFields = {
  expected_updated_at: Timestamp,
  title: Schema.optional(Schema.String),
  description: Schema.optional(Schema.NullOr(Schema.String)),
};
