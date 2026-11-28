import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

/** The port of a host that names no port. */
export const DEFAULT_PORT = 7000;

// Also checked when a host is made or encoded without decoding
const CanonicalHost = Schema.String.check(
  Schema.makeFilter((host) => canonicalHost(host) === host || "Expected a host")
).pipe(Schema.brand("Host"));

/**
 * A host name or IP address with an optional port, in its canonical spelling:
 * lowercase, without the default port. Hosts are only created by decoding, such as
 * with {@link validateHost}, so two hosts name the same host exactly when they are
 * equal.
 */
export type Host = typeof CanonicalHost.Type;

/** Decodes any spelling of a host to its canonical spelling. */
export const HostSchema = Schema.String.pipe(
  Schema.decodeTo(
    CanonicalHost,
    SchemaTransformation.transform({
      // A host that doesn't parse fails the canonical check.
      decode: (host) => canonicalHost(host) ?? host,
      encode: (host) => host,
    })
  )
);

const decodeHost = Schema.decodeOption(HostSchema);
const parseUrl = Option.liftThrowable((url: string) => new URL(url));

/**
 * Parses a host that a person entered, which may also have a URL scheme or a
 * trailing slash. Throws if it is not a host.
 */
export function validateHost(input: string): Host {
  const host = input
    .trim()
    .replace(/^https?:\/\//iu, "")
    .replace(/\/$/u, "");
  // The input isn't quoted, since a pasted URL may hold credentials.
  return Option.getOrThrowWith(
    decodeHost(host),
    () =>
      new Error("Expected a host name or IP address, with an optional port.")
  );
}

/** The host with its port, even the default one, for connecting to it. */
export function hostAuthority(host: Host): string {
  // An unported IPv6 address ends with its closing bracket.
  const colon = host.lastIndexOf(":");
  return colon !== -1 && !host.slice(colon).includes("]")
    ? host
    : `${host}:${DEFAULT_PORT}`;
}

/** The base URL of the host's HTTP API. */
export function hostApiUrl(host: Host, secure: boolean): string {
  return `${secure ? "https" : "http"}://${hostAuthority(host)}`;
}

/** The URL of the host's client websocket. */
export function hostClientWsUrl(host: Host, secure: boolean): string {
  return `${secure ? "wss" : "ws"}://${hostAuthority(host)}/ws/client`;
}

/**
 * The canonical spelling of a host name or IP address with an optional port,
 * or `undefined` if it is not one. It matches the hosts' own parser.
 */
function canonicalHost(host: string): string | undefined {
  const colon = host.lastIndexOf(":");
  // The last colon of an unported IPv6 address is inside its brackets.
  const hasPort = colon !== -1 && !host.slice(colon).includes("]");
  const name = hasPort ? host.slice(0, colon) : host;
  const port = hasPort ? host.slice(colon + 1) : undefined;
  const isIpv6 = name.startsWith("[") && name.endsWith("]");
  // URLs would also accept a port, credentials, a path, or percent-encoding
  // here, and would drop ASCII spaces and control characters.
  if (
    name === "" ||
    // oxlint-disable-next-line eslint/no-control-regex -- URLs drop control characters, which a host must not contain.
    /[\u0000-\u0020\u007F/?#@\\%]/u.test(name) ||
    (!isIpv6 && name.includes(":"))
  ) {
    return undefined;
  }
  const url = parseUrl(`http://${name}`);
  if (Option.isNone(url)) {
    return undefined;
  }
  const { hostname } = url.value;
  const isIp = isIpv6 || /^\d+\.\d+\.\d+\.\d+$/u.test(hostname);
  if (!isIp && !hostname.split(".").every(isHostLabel)) {
    return undefined;
  }
  if (port === undefined) {
    return hostname;
  }
  if (!/^\d+$/u.test(port) || Number(port) > 65_535) {
    return undefined;
  }
  return Number(port) === DEFAULT_PORT
    ? hostname
    : `${hostname}:${Number(port)}`;
}

function isHostLabel(label: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label);
}
