import assert from "node:assert/strict";
import * as Exit from "effect/Exit";
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

export function parse<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  value: unknown
): S["Type"] {
  return Schema.decodeUnknownSync(schema)(value);
}

export function ok(
  schema: Schema.ConstraintDecoder<unknown>,
  value: unknown
): boolean {
  return Exit.isSuccess(Schema.decodeUnknownExit(schema)(value));
}

// These fixtures check JSON wire semantics, not whether the input can be cloned.
export function roundTripJson(value: unknown): object {
  const serialized = JSON.stringify(value);
  const parsed: unknown = JSON.parse(serialized);
  assert.ok(typeof parsed === "object" && parsed !== null);
  return parsed;
}
