import { z } from "zod";
import { UserRefSchema } from "./user";

export const LocalAccountSchema = z.object({
  user_name: z.string(),
  user_host: z.string(),
  password_hash: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const SignupRequestSchema = z.object({
  name: z.string(),
  password: z.string(),
});

export const RefreshTokenSchema = z.object({
  token: z.string(),
  user_name: z.string(),
  user_host: z.string(),
  client_id: z.string(),
  issued_at: z.coerce.date(),
  expires_at: z.coerce.date(),
  revoked: z.boolean(),
});

export const TokenRequestSchema = z.object({
  grant_type: z.string(),
  username: z.string().optional(),
  password: z.string().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  client_id: z.string().optional(),
});

export const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  refresh_token: z.string(),
  scope: z.string(),
});

export const PublicJwkSchema = z.object({
  kty: z.string(),
  crv: z.string(),
  alg: z.string(),
  kid: z.string(),
  use: z.string(),
  x: z.string(),
});

export const ClientAccessClaimsSchema = z.object({
  iss: z.string(),
  sub: z.string(),
  aud: z.array(z.string()),
  exp: z.number(),
  iat: z.number(),
  scope: z.string(),
  client_id: z.string(),
});

export const FederationClaimsSchema = z.object({
  iss: z.string(),
  sub: z.string(),
  aud: z.array(z.string()),
  exp: z.number(),
  iat: z.number(),
  user_ref: UserRefSchema.optional(),
});

export type LocalAccount = z.infer<typeof LocalAccountSchema>;
export type SignupRequest = z.infer<typeof SignupRequestSchema>;
export type RefreshToken = z.infer<typeof RefreshTokenSchema>;
export type TokenRequest = z.infer<typeof TokenRequestSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type PublicJwk = z.infer<typeof PublicJwkSchema>;
export type ClientAccessClaims = z.infer<typeof ClientAccessClaimsSchema>;
export type FederationClaims = z.infer<typeof FederationClaimsSchema>;
