import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import { RunelinkConnection, WsRequestSchema } from "@runelink/sdk";
import * as Schema from "effect/Schema";

it("loads the built SDK and decodes a ping request", () => {
  assert.equal(typeof RunelinkConnection.make, "function");
  assert.deepEqual(
    Schema.decodeUnknownSync(WsRequestSchema)({ type: "ping" }),
    { type: "ping" }
  );
});
