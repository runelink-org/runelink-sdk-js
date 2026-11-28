import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  HostSchema,
  ServerIdSchema,
  hostApiUrl,
  hostAuthority,
  hostClientWsUrl,
  validateHost,
} from "../src/index.ts";
import type { Host, ServerRef } from "../src/index.ts";

const decodeHost = Schema.decodeUnknownOption(HostSchema);

it("hosts decode to the same canonical spelling as the hosts' parser", () => {
  // The same cases as the hosts' own tests
  for (const [host, expected] of [
    ["runelink.chat", "runelink.chat"],
    ["runelink.chat:7001", "runelink.chat:7001"],
    ["localhost", "localhost"],
    ["localhost:7001", "localhost:7001"],
    ["LocalHost:7000", "localhost"],
    ["localhost:07000", "localhost"],
    ["localhost:80", "localhost:80"],
    ["127.0.0.1:7001", "127.0.0.1:7001"],
    ["[::1]", "[::1]"],
    ["[0:0::1]:7000", "[::1]"],
    ["[::1]:7001", "[::1]:7001"],
    ["", undefined],
    [":7000", undefined],
    ["localhost:", undefined],
    ["localhost:+7001", undefined],
    ["localhost:70000", undefined],
    ["x:7000:7000", undefined],
    ["::1", undefined],
    ["local host", undefined],
    [" localhost", undefined],
    ["bad!name.example", undefined],
    ["bad_name.example", undefined],
    ["bad..example", undefined],
    ["-bad.example", undefined],
    ["example.com.", undefined],
    ["%65xample.com", undefined],
    ["localhost/path", undefined],
    ["alice@localhost", undefined],
    ["http://localhost", undefined],
  ] as const) {
    assert.equal(Option.getOrUndefined(decodeHost(host)), expected, host);
  }
});

it("hosts name their URLs with ports", () => {
  for (const [host, authority] of [
    ["example.com", "example.com:7000"],
    ["example.com:8080", "example.com:8080"],
    ["[::1]", "[::1]:7000"],
    ["[::1]:4321", "[::1]:4321"],
  ] as const) {
    assert.equal(hostAuthority(validateHost(host)), authority);
  }
  const host = validateHost("example.com");
  assert.equal(hostApiUrl(host, true), "https://example.com:7000");
  assert.equal(hostApiUrl(host, false), "http://example.com:7000");
  assert.equal(hostClientWsUrl(host, true), "wss://example.com:7000/ws/client");
});

it("entered hosts may have a scheme or a trailing slash", () => {
  assert.equal(validateHost(" HTTPS://Example.COM:7000/ "), "example.com");
  assert.equal(validateHost("http://localhost:7001"), "localhost:7001");
  for (const input of ["example.com:abc", "exa$mple.com", "", "a/b"]) {
    assert.throws(() => validateHost(input), input);
  }
});

it("plain strings are not hosts", () => {
  // @ts-expect-error Hosts are only made by decoding.
  const host: Host = "localhost";
  const id = Schema.decodeSync(ServerIdSchema)(
    "00000000-0000-4000-8000-000000000001"
  );
  // @ts-expect-error A ref's host must be a host.
  const serverRef: ServerRef = { host: "localhost", id };
  assert.equal(serverRef.host, host);
});
