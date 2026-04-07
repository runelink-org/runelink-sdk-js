export const MAX_USERNAME_LENGTH = 32;

export function normalizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeHostInput(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function validateUsername(input: string): string {
  const normalized = normalizeUsername(input);

  if (!normalized) {
    throw new Error("Username cannot be empty.");
  }

  if (normalized.length > MAX_USERNAME_LENGTH) {
    throw new Error(
      `Username cannot be longer than ${MAX_USERNAME_LENGTH} characters.`
    );
  }

  return normalized;
}

export function validateHost(
  input: string,
  options: { allowPort?: boolean } = {}
): string {
  const normalized = normalizeHostInput(input);
  const allowPort = options.allowPort ?? true;

  if (!normalized) {
    throw new Error("Host cannot be empty.");
  }

  const colonMatches = normalized.match(/:/g) ?? [];
  if (colonMatches.length > 1) {
    throw new Error("Host can include at most one port separator.");
  }

  const [hostPart, portPart] = normalized.split(":");

  if (!hostPart) {
    throw new Error("Host cannot be empty.");
  }

  if (!/^[a-z0-9.-]+$/.test(hostPart)) {
    throw new Error(
      "Host may only contain lowercase letters, digits, dots, hyphens, and an optional :port."
    );
  }

  if (portPart !== undefined) {
    if (!allowPort) {
      throw new Error("Host must not include a port here.");
    }

    if (!/^\d+$/.test(portPart)) {
      throw new Error("Host port must contain digits only.");
    }
  }

  return normalized;
}

export function padHost(host: string): string {
  if (host.startsWith("[")) {
    const closing = host.indexOf("]");

    if (closing === -1) {
      return `${host}:7000`;
    }

    const after = host.slice(closing + 1);
    return after.startsWith(":") ? host : `${host}:7000`;
  }

  if (host.includes(":")) {
    return host;
  }

  return `${host}:7000`;
}

export function stripDefaultPort(host: string): string {
  return host.endsWith(":7000") ? host.slice(0, -5) : host;
}

export function hostFromIssuer(issuer: string): string {
  const host = issuer
    .replace(/^http:\/\//, "")
    .replace(/^https:\/\//, "")
    .replace(/\/$/, "");

  return stripDefaultPort(host);
}

export function getApiUrl(host: string, secure: boolean): string {
  return `${secure ? "https" : "http"}://${padHost(host)}`;
}

export function getWsUrl(host: string, secure: boolean): string {
  return `${secure ? "wss" : "ws"}://${padHost(host)}/ws/client`;
}
