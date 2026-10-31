import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeCapabilityIssue, RunelinkConnection } from '../dist/index.js';

const v1 = '2026.10.16', v2 = '2026.10.17', v3 = '2026.10.18';
test('capability diagnostics distinguish missing, legacy, age, mixed, and empty offers', () => {
  for (const [offered, supported, reason] of [
    [[v2], null, 'unknown'], [[v2], [], 'missing'],
    [[v2], [v1], 'outdated-host'], [[v1], [v2], 'outdated-client'],
    [[v2], [v1, v3], 'incompatible'], [[], [v1], 'incompatible'],
    [['2026.10.16.10'], ['2026.10.16.2'], 'outdated-host'],
  ]) assert.equal(describeCapabilityIssue('messages.read', offered, supported).reason, reason);
});

// Exercise real connection lifecycle with controlled wire messages.
class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  readyState = 0;
  constructor() { FakeSocket.last = this; }
  send() {}
  close() { this.readyState = 3; this.onclose?.({ code: 1000, reason: "" }); }
  open() { this.readyState = 1; this.onopen?.({}); }
  welcome(data) { this.onmessage?.({ data: JSON.stringify({ type: 'welcome', data }) }); }
}
globalThis.WebSocket = FakeSocket;
function connect() {
  const connection = new RunelinkConnection('ws://localhost:7000/ws', {
    autoReconnect: false, capabilities: { 'messages.read': ['2026.10.19'], 'ping': [v1] },
  });
  const ready = connection.connect();
  FakeSocket.last.open();
  return { connection, ready, socket: FakeSocket.last };
}
const base = { negotiation_version: 1, server_version: 'test', capabilities: { ping: v1 } };
test('new and legacy welcomes expose reasons, preserve names API, and clear on disconnect', async () => {
  for (const rejected of [undefined, { 'messages.read': [v1] }, { 'messages.read': [] }]) {
    const { connection, ready, socket } = connect();
    socket.welcome({ ...base, ...(rejected === undefined ? {} : { rejected_capabilities: rejected }) });
    await ready;
    assert.deepEqual(connection.getUnsupportedCapabilities(), ['messages.read']);
    assert.equal(connection.getCapabilityIssues()[0].reason, rejected === undefined ? 'unknown' : rejected['messages.read'].length ? 'outdated-host' : 'missing');
    connection.disconnect();
    assert.equal(connection.getCapabilityIssues(), null);
  }
});
test('malformed rejection partitions fail negotiation', async () => {
  for (const rejected of [{}, { ping: [], 'messages.read': [] }, { 'messages.read': ['2026.10.19'] }, { 'messages.read': [], unknown: [] }]) {
    const { connection, ready, socket } = connect();
    socket.welcome({ ...base, rejected_capabilities: rejected });
    await assert.rejects(ready);
    connection.disconnect();
  }
});
