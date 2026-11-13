import { z } from "zod";

/** Application-defined JSON object. Core does not interpret or merge its keys. */
export const MetadataSchema = z.record(z.string(), z.json());
export type Metadata = z.infer<typeof MetadataSchema>;
