# Agent Guidelines

## Code Quality & Type Safety

- Always run checks in this order after making changes:
  1. `pnpm format` - Format code
  2. `pnpm build` - Verify TypeScript compilation and bundle
- Validate unknown types with Zod schemas instead of using `as any` or type assertions
- Ensure all exports are properly typed and tested

## Best Practices

- Follow the existing project structure and conventions
- Maintain backward compatibility for SDK consumers
- Prefer traditional function syntax (for example, `function name() {}`) over arrow-assigned helpers when possible
- Test changes by running the full build and verifying outputs
