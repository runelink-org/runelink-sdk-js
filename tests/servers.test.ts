import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import * as Schema from "effect/Schema";
import {
  CLIENT_WS_SUPPORTED_CAPABILITIES,
  NewServerSchema,
} from "../src/index.ts";

function parse<S extends Schema.ConstraintDecoder<unknown, never>>(
  schema: S,
  value: unknown
) {
  return Schema.decodeUnknownSync(schema)(value);
}

it("server creation opts in to default channels only when asked", () => {
  assert.deepEqual(CLIENT_WS_SUPPORTED_CAPABILITIES["servers.create"], [
    "2026.11.26",
  ]);
  assert.equal(
    parse(NewServerSchema, { title: "test" }).default_channels,
    undefined
  );
  assert.equal(
    parse(NewServerSchema, { title: "test", default_channels: true })
      .default_channels,
    true
  );
});
