# Agent Guidelines

## Code Quality & Type Safety

- Always run checks in this order after making changes:
  1. `pnpm format` - Format code
  2. `pnpm build` - Verify TypeScript compilation and bundle for the package smoke test
  3. `pnpm lint` and `pnpm lint:effect` - Check source and Effect diagnostics
  4. `pnpm test` - Run the Vitest suite and the built-package smoke test
- Validate unknown data with Effect Schema instead of using `as any` or type assertions
- Ensure all exports are properly typed and tested

## Effect

Read [the Effect conventions](docs/effect-conventions.md) before changing Effect code. In correctness and simplicity reviews, check the changed lines against that guide.

## Best Practices

- The SDK is pre-1.0 and its main consumer is the demo client, so prefer clean breaks over compatibility shims, without migration guides
- Prefer traditional function syntax (for example, `function name() {}`) over arrow-assigned helpers when possible

## Releases

- Follow the release process in [README.md](README.md#releasing).
- Get explicit user approval for the specific release before publishing to npm or pushing a release tag. Pushing a `v*` tag triggers publishing; do not publish just to test the workflow without approval.

## Resource naming

Servers, channels, text channels, and messages are identified by their owning host together with an ID that is only unique on that host. Name values by what they hold:

- `server`: the resource itself, such as a `Server`.
- `serverId`: a bare `ServerId`. Use it only where the host is implied, such as for a resource on the same host as the resource that holds it (`ServerChannel.server_id`).
- `serverRef`: a `ServerRef` (`ResourceRef<ServerId>`), the host and ID that name a resource on any host. Use it wherever the host isn't implied.

The same applies to each kind of resource (`channel`, `textChannel`, `message`). A resource has its own host and ID, so it can be passed where a ref of its kind is expected, and the parameter that receives it is still named for a ref. Users have no bare ID, so a `UserRef` is named `userRef`, or for its role, such as `author`. Protocol fields keep their snake_case names, such as `server_id`, `server_ref`, and `user_ref`.

## Hosts

Hosts are `Host` values, which only decoding with `HostSchema` creates and which are always canonical: lowercase, without the default port (`DEFAULT_PORT`). Compare and store them as `Host`s, and never add or strip ports by hand. Use `hostApiUrl` or `hostClientWsUrl` to connect to a host, and `hostAuthority` only where the port must always be spelled out. Parse hosts that people enter with `validateHost`.
