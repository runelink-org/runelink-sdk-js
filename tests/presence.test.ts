import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import {
  WsReplySchema,
  WsRequestSchema,
  WsUpdateSchema,
} from "../src/index.ts";
import { ok, parseVariant } from "./schema-assertions.ts";

const userRef = { name: "alice", host: "localhost" };

it("presence statuses decode with the hosts' wire names", () => {
  const update = parseVariant(WsUpdateSchema, {
    type: "presence_status_updated",
    data: { user_ref: userRef, status: "do_not_disturb" },
  });
  assert.deepEqual(update.data, {
    user_ref: userRef,
    status: "do_not_disturb",
  });
  // Others never see a user as invisible.
  assert.equal(
    ok(WsUpdateSchema, {
      type: "presence_status_updated",
      data: { user_ref: userRef, status: "invisible" },
    }),
    false
  );
  const chosen = parseVariant(WsUpdateSchema, {
    type: "chosen_presence_status_updated",
    data: { status: "invisible" },
  });
  assert.equal(chosen.data.status, "invisible");
});

it("users choose their status, but not to be offline", () => {
  parseVariant(WsRequestSchema, {
    type: "presence_status_update",
    data: { status: "invisible" },
  });
  assert.equal(
    ok(WsRequestSchema, {
      type: "presence_status_update",
      data: { status: "offline" },
    }),
    false
  );
  assert.ok(ok(WsReplySchema, { type: "presence_status_update" }));
});
