import assert from "node:assert/strict";
import { test } from "node:test";
import * as Schema from "effect/Schema";
import {
  CLIENT_WS_SUPPORTED_CAPABILITIES,
  NewServerSchema,
} from "../dist/index.js";

function parse(schema, value) {
  return Schema.decodeUnknownSync(schema)(value);
}

test("server creation opts in to default channels only when asked", () => {
  assert.deepEqual(CLIENT_WS_SUPPORTED_CAPABILITIES["servers.create"], ["2026.11.26"]);
  assert.equal(parse(NewServerSchema, { title: "test" }).default_channels, undefined);
  assert.equal(parse(NewServerSchema, { title: "test", default_channels: true }).default_channels, true);
});
