import { z } from "zod";

export const DetailsUpdateSchema = z.strictObject({
  expected_updated_at: z.string().datetime({ offset: true }),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
});
export type DetailsUpdate = z.infer<typeof DetailsUpdateSchema>;
