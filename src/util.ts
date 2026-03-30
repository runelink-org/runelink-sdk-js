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
