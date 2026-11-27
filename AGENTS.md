# Agent Guidelines

## Code Quality & Type Safety

- Always run checks in this order after making changes:
  1. `pnpm format` - Format code
  2. `pnpm build` - Verify TypeScript compilation and bundle
  3. `pnpm test` - Run the Vitest suite and the built-package smoke test
- Validate unknown data with Effect Schema instead of using `as any` or type assertions
- Ensure all exports are properly typed and tested

## Effect

The SDK follows the Effect conventions of [T3 Code](https://github.com/pingdotgg/t3code), adapted to a library:

- Import Effect modules as namespaces from their subpaths, such as `import * as Effect from "effect/Effect"`
- Define services with `Context.Service`, with the interface inline, a `make`, and a `layer`, and export each service module as a namespace from `src/index.ts`
- Define failures as `Schema.TaggedError` classes with structured fields, and build each message from those fields
- Use `Effect.fn("Service.operation")` for reusable operations, and `Effect.fnUntraced` for per-message work
- Hoist compiled schema functions such as `Schema.decodeUnknownEffect(...)` to module constants
- Keep `effect` a peer dependency so applications share one copy

## Best Practices

- The SDK is pre-1.0 and its main consumer is the demo client, so prefer clean breaks over compatibility shims, and document breaking changes in the README
- Prefer traditional function syntax (for example, `function name() {}`) over arrow-assigned helpers when possible

## Releases

- Follow the release process in [README.md](README.md#releasing).
- Get explicit user approval for the specific release before publishing to npm or pushing a release tag. Pushing a `v*` tag triggers publishing; do not publish just to test the workflow without approval.
