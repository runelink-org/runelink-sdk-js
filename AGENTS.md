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

- The SDK is pre-1.0 and its main consumer is the demo client, so prefer clean breaks over compatibility shims, and document breaking changes in the README
- Prefer traditional function syntax (for example, `function name() {}`) over arrow-assigned helpers when possible

## Releases

- Follow the release process in [README.md](README.md#releasing).
- Get explicit user approval for the specific release before publishing to npm or pushing a release tag. Pushing a `v*` tag triggers publishing; do not publish just to test the workflow without approval.
