import { z } from "zod";

export const editVersionFields = {
  updated_at: z.union([z.string().datetime({ offset: true }), z.date()]),
  update_version: z.string().optional(),
};

export function withUpdateVersion<
  T extends { updated_at: string | Date; update_version?: string },
>(record: T) {
  return {
    ...record,
    updated_at: new Date(record.updated_at),
    update_version:
      record.update_version ??
      (typeof record.updated_at === "string"
        ? record.updated_at
        : record.updated_at.toISOString()),
  };
}

export const DetailsUpdateSchema = z.strictObject({
  expected_updated_at: z.string().datetime({ offset: true }),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
});
export type DetailsUpdate = z.infer<typeof DetailsUpdateSchema>;
