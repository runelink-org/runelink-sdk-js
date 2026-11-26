import * as Schema from "effect/Schema";

/** Application-defined JSON object. Core does not interpret or merge its keys. */
export const MetadataSchema = Schema.Record(Schema.String, Schema.Json);
export type Metadata = typeof MetadataSchema.Type;
