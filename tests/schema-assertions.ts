import assert from "node:assert/strict";
import * as Schema from "effect/Schema";

export function parseVariant<
  S extends Schema.ConstraintDecoder<{ readonly type: string }>,
  Tag extends S["Type"]["type"],
>(
  schema: S,
  input: { readonly type: Tag; readonly data: unknown }
): Extract<S["Type"], { readonly type: Tag }> {
  const value = Schema.decodeUnknownSync(schema)(input);
  const matches = <A extends { readonly type: string }>(
    actual: A
  ): actual is Extract<A, { readonly type: Tag }> => actual.type === input.type;
  assert.ok(matches(value));
  return value;
}
