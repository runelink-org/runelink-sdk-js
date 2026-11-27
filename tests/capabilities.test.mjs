import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspect } from 'node:util';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Option from 'effect/Option';
import * as Socket from 'effect/socket/Socket';
import * as Stream from 'effect/Stream';
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

// Exercise real connection lifecycle with controlled wire messages: the fake
// host opens, then answers the hello with `welcome`.
class FakeSocket extends EventTarget {
  static last;
  readyState = 0;
  requests = [];
  constructor(welcome) {
    super();
    FakeSocket.last = this;
    this.welcome = welcome;
    queueMicrotask(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); });
  }
  send(text) {
    const message = JSON.parse(text);
    if (message.type === 'request') this.requests.push(message.data.request_id);
    if (message.type !== 'hello') return;
    const data = JSON.stringify({ type: 'welcome', data: this.welcome });
    queueMicrotask(() => this.dispatchEvent(Object.assign(new Event('message'), { data })));
  }
  reply(requestId, reply) {
    const data = JSON.stringify({ type: 'reply', data: { request_id: requestId, event_id: requestId, reply } });
    this.dispatchEvent(Object.assign(new Event('message'), { data }));
  }
  error(requestId, error) {
    const data = JSON.stringify({ type: 'error', data: { request_id: requestId, event_id: requestId, error } });
    this.dispatchEvent(Object.assign(new Event('message'), { data }));
  }
  close(code = 1000, reason = '') {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.dispatchEvent(Object.assign(new Event('close'), { code, reason }));
  }
}
function connection(welcome) {
  return RunelinkConnection.make({
    url: 'ws://localhost:7000/ws', autoReconnect: false, capabilities: { 'messages.read': ['2026.10.19'], 'ping': [v1] },
  }).pipe(Effect.provideService(Socket.WebSocketConstructor, () => new FakeSocket(welcome)));
}
function run(program) {
  return Effect.runPromise(Effect.scoped(program));
}
// Sends a ping and returns its fiber and request ID once it is on the wire
function pendingPing(conn, socket) {
  return Effect.gen(function* () {
    const fiber = yield* Effect.forkScoped(conn.request({ type: 'ping' }), { startImmediately: true });
    yield* Effect.yieldNow;
    return { fiber, id: socket.requests.at(-1) };
  });
}
const base = { negotiation_version: 1, server_version: 'test', capabilities: { ping: v1 } };
test('new and legacy welcomes expose reasons, preserve names, and clear on disconnect', async () => {
  for (const rejected of [undefined, { 'messages.read': [v1] }, { 'messages.read': [] }]) {
    await run(Effect.gen(function* () {
      const conn = yield* connection({ ...base, ...(rejected === undefined ? {} : { rejected_capabilities: rejected }) });
      yield* conn.connect;
      const issues = Option.getOrThrow(yield* conn.capabilityIssues);
      assert.deepEqual(issues.map((issue) => issue.capability), ['messages.read']);
      assert.equal(issues[0].reason, rejected === undefined ? 'unknown' : rejected['messages.read'].length ? 'outdated-host' : 'missing');
      yield* conn.disconnect;
      assert.ok(Option.isNone(yield* conn.capabilityIssues));
    }));
  }
});
test('malformed rejection partitions fail negotiation', async () => {
  for (const rejected of [{}, { ping: [], 'messages.read': [] }, { 'messages.read': ['2026.10.19'] }, { 'messages.read': [], unknown: [] }]) {
    await run(Effect.gen(function* () {
      const conn = yield* connection({ ...base, rejected_capabilities: rejected });
      const error = yield* Effect.flip(conn.connect);
      assert.equal(error._tag, 'RunelinkIncompatibleHostError');
      yield* conn.disconnect;
    }));
  }
});
test('errors report URLs without credentials, query, or fragment', async () => {
  for (const [url, host] of [
    ['ws://bot:pw@localhost:7000/ws?access_token=x#y', 'ws://localhost:7000/ws'],
    ['/ws?access_token=x', '(redacted URL)'],
    ['bot:pw@localhost:7000/ws', '(redacted URL)'],
    ['bot:/pw@localhost:7000/ws', '(redacted URL)'],
    ['file:pw@localhost/ws', '(redacted URL)'],
    ['ws+unix:///tmp/sock:/ws?access_token=x', 'ws+unix:///tmp/sock:/ws'],
    ['WS://LOCALHOST:7000/ws', 'WS://LOCALHOST:7000/ws'],
  ]) {
    await run(Effect.gen(function* () {
      let dialed;
      const conn = yield* RunelinkConnection.make({ url, autoReconnect: false })
        .pipe(Effect.provideService(Socket.WebSocketConstructor, (dialUrl) => { dialed = dialUrl; return new FakeSocket({ ...base, rejected_capabilities: {} }); }));
      const error = yield* Effect.flip(conn.connect);
      assert.equal(dialed, url);
      assert.equal(error.host, host);
      assert.ok(error.message.startsWith(`${host} is incompatible`));
    }));
  }
});
test('connection error causes leave out the socket and its message for URLs with secrets', async () => {
  function failingSocket(dialUrl) {
    const socket = Object.assign(new EventTarget(), { url: dialUrl, readyState: 0, close() {} });
    queueMicrotask(() => socket.dispatchEvent(Object.assign(new Event('error'), { error: new Error(`connect ECONNREFUSED ${dialUrl}`) })));
    return socket;
  }
  const secretUrl = 'ws://bot:pw@localhost:7000/ws?access_token=secret-token#frag';
  for (const [url, makeSocket, cause] of [
    [secretUrl, failingSocket, 'An error occurred during Open: Error'],
    [secretUrl, () => { throw new SyntaxError(`Invalid URL: ${secretUrl}`); }, 'SyntaxError'],
    [secretUrl, () => { throw { get error() { throw new Error('getter'); } }; }, undefined],
    ['ws://localhost:7000/ws', failingSocket, 'An error occurred during Open'],
  ]) {
    await run(Effect.gen(function* () {
      const conn = yield* RunelinkConnection.make({ url, autoReconnect: false })
        .pipe(Effect.provideService(Socket.WebSocketConstructor, makeSocket));
      const error = yield* Effect.flip(conn.connect);
      assert.equal(error._tag, 'RunelinkConnectionError');
      assert.equal(cause === undefined ? error.cause : error.cause.message, cause);
      if (url === secretUrl) assert.ok(!inspect(error, { depth: Infinity }).includes('secret-token'));
      else assert.equal(error.cause.reason.cause.type, 'error');
    }));
  }
});
test('requests match replies, ignore late replies, and fail when the socket closes', async () => {
  await run(Effect.gen(function* () {
    const conn = yield* connection(base);
    const firstIssue = yield* Deferred.make();
    yield* conn.errors.pipe(Stream.runForEach((issue) => Deferred.succeed(firstIssue, issue)), Effect.forkScoped({ startImmediately: true }));
    yield* conn.connect;
    const socket = FakeSocket.last;
    const pending = pendingPing(conn, socket);

    let request = yield* pending;
    socket.reply(request.id, { type: 'pong' });
    assert.equal((yield* Fiber.join(request.fiber)).type, 'pong');

    request = yield* pending;
    socket.reply(request.id, { type: 'users_delete' });
    assert.equal((yield* Effect.flip(Fiber.join(request.fiber)))._tag, 'RunelinkProtocolError');

    // A reply that does not decode still settles its request
    request = yield* pending;
    socket.reply(request.id, { type: 'unknown_reply' });
    assert.equal((yield* Effect.flip(Fiber.join(request.fiber))).reason, 'Invalid message received');

    request = yield* pending;
    yield* Fiber.interrupt(request.fiber);
    socket.reply(request.id, { type: 'pong' });
    // Frames are handled in order, so the first issue is this one if the late
    // reply was ignored
    socket.dispatchEvent(Object.assign(new Event('message'), { data: '{' }));
    assert.equal((yield* Deferred.await(firstIssue)).reason, 'Invalid message received');

    request = yield* pending;
    socket.close(4000, 'bye');
    const error = yield* Effect.flip(Fiber.join(request.fiber));
    assert.equal(error.message, 'WebSocket closed (4000): bye');
  }));
});
test('requests that may not connect fail instead of opening a socket', async () => {
  await run(Effect.gen(function* () {
    const conn = yield* connection(base);
    const ping = conn.request({ type: 'ping' }, { connect: false });
    const before = FakeSocket.last;
    assert.equal((yield* Effect.flip(ping))._tag, 'RunelinkDisconnectedError');
    assert.equal(FakeSocket.last, before);

    yield* conn.connect;
    const socket = FakeSocket.last;
    const fiber = yield* Effect.forkScoped(ping, { startImmediately: true });
    yield* Effect.yieldNow;
    socket.reply(socket.requests.at(-1), { type: 'pong' });
    assert.equal((yield* Fiber.join(fiber)).type, 'pong');

    socket.close();
    yield* conn.statusChanges.pipe(Stream.takeUntil((status) => status === 'disconnected'), Stream.runDrain);
    assert.equal((yield* Effect.flip(ping))._tag, 'RunelinkDisconnectedError');
    assert.equal(FakeSocket.last, socket);
  }));
});
test('error replies fail with the tagged error for their code', async () => {
  await run(Effect.gen(function* () {
    const conn = yield* connection(base);
    yield* conn.connect;
    const socket = FakeSocket.last;
    for (const [code, tag] of [
      ['auth_error', 'RunelinkAuthError'], ['bad_request', 'RunelinkBadRequestError'],
      ['not_found', 'RunelinkNotFoundError'], ['conflict', 'RunelinkConflictError'],
      ['internal_error', 'RunelinkInternalError'], ['rate_limited', 'RunelinkInternalError'],
      ['unsupported_capability', 'RunelinkUnsupportedCapabilityError'],
    ]) {
      const { fiber, id } = yield* pendingPing(conn, socket);
      socket.error(id, { code, message: `Host says ${code}`, details: null });
      const error = yield* Effect.flip(Fiber.join(fiber));
      assert.equal(error._tag, tag);
      if (tag === 'RunelinkInternalError') assert.equal(error.code, code);
      if (tag === 'RunelinkUnsupportedCapabilityError') assert.equal(error.capability, 'ping');
      else assert.equal(error.message, `Host says ${code}`);
    }
  }));
});
test('a socket constructor failure fails connect instead of hanging', async () => {
  await run(Effect.gen(function* () {
    const conn = yield* RunelinkConnection.make({ url: 'not a url', autoReconnect: false })
      .pipe(Effect.provideService(Socket.WebSocketConstructor, () => { throw new SyntaxError('invalid URL'); }));
    assert.equal((yield* Effect.flip(conn.connect))._tag, 'RunelinkConnectionError');
    assert.equal(yield* conn.status, 'disconnected');
  }));
});
test('a connection used after its scope closes fails instead of hanging', async () => {
  const conn = await run(connection(base));
  const error = await Effect.runPromise(Effect.flip(conn.connect).pipe(Effect.timeout('1 second')));
  assert.equal(error._tag, 'RunelinkDisconnectedError');
});
test('a consumer forked with startImmediately receives the next update', async () => {
  await run(Effect.gen(function* () {
    const conn = yield* RunelinkConnection.make({ url: 'ws://localhost:7000/ws', autoReconnect: false, capabilities: { 'messages.events': ['2026.10.19'] } })
      .pipe(Effect.provideService(Socket.WebSocketConstructor, () => new FakeSocket({ ...base, capabilities: { 'messages.events': '2026.10.19' } })));
    yield* conn.connect;
    const first = yield* Deferred.make();
    yield* conn.updates.pipe(Stream.runForEach((update) => Deferred.succeed(first, update)), Effect.forkScoped({ startImmediately: true }));
    const id = '00000000-0000-4000-8000-000000000001', at = '2026-11-26T00:00:00Z';
    const data = { id, text_channel_id: id, author: null, reply_to: null, body: 'hi', deleted_at: null, created_at: at, updated_at: at };
    FakeSocket.last.dispatchEvent(Object.assign(new Event('message'), { data: JSON.stringify({ type: 'update', data: { event_id: id, update: { type: 'message_upserted', data } } }) }));
    assert.equal((yield* Deferred.await(first).pipe(Effect.timeout('1 second'))).data.body, 'hi');
  }));
});
