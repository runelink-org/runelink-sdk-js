export const MAX_USERNAME_LENGTH = 32;

export function normalizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replaceAll(/[\s_.-]+/gu, "-")
    .replaceAll(/[^a-z0-9-]/gu, "")
    .replaceAll(/-+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
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
