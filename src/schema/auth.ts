import * as Schema from "effect/Schema";
import { HostSchema } from "./host.js";
import { Timestamp } from "./primitives.js";
import { UserRefSchema } from "./user.js";

export const LocalAccountSchema = Schema.Struct({
  user_name: Schema.String,
  user_host: HostSchema,
  password_hash: Schema.String,
  created_at: Timestamp,
  updated_at: Timestamp,
});

export const SignupRequestSchema = Schema.Struct({
  name: Schema.String,
  password: Schema.String,
});

export const RefreshTokenSchema = Schema.Struct({
  token: Schema.String,
  user_name: Schema.String,
  user_host: HostSchema,
  client_id: Schema.String,
  issued_at: Timestamp,
  expires_at: Timestamp,
  revoked: Schema.Boolean,
});

export const TokenRequestSchema = Schema.Struct({
  grant_type: Schema.String,
  username: Schema.optional(Schema.String),
  password: Schema.optional(Schema.String),
  refresh_token: Schema.optional(Schema.String),
  scope: Schema.optional(Schema.String),
  client_id: Schema.optional(Schema.String),
});

export const TokenResponseSchema = Schema.Struct({
  access_token: Schema.String,
  token_type: Schema.String,
  expires_in: Schema.Finite,
  refresh_token: Schema.String,
  scope: Schema.String,
});

export const OidcDiscoveryDocumentSchema = Schema.Struct({
  issuer: Schema.String,
  jwks_uri: Schema.String,
  token_endpoint: Schema.String,
  userinfo_endpoint: Schema.String,
  grant_types_supported: Schema.Array(Schema.String),
  response_types_supported: Schema.Array(Schema.String),
  scopes_supported: Schema.Array(Schema.String),
  token_endpoint_auth_methods_supported: Schema.Array(Schema.String),
});

export const AuthTokenPasswordRequestSchema = Schema.Struct({
  username: Schema.String,
  password: Schema.String,
  scope: Schema.NullOr(Schema.String),
  client_id: Schema.NullOr(Schema.String),
});

export const AuthTokenRefreshRequestSchema = Schema.Struct({
  refresh_token: Schema.String,
  scope: Schema.NullOr(Schema.String),
  client_id: Schema.NullOr(Schema.String),
});

export const PublicJwkSchema = Schema.Struct({
  kty: Schema.String,
  crv: Schema.String,
  alg: Schema.String,
  kid: Schema.String,
  use: Schema.String,
  x: Schema.String,
});

export const JwksResponseSchema = Schema.Struct({
  keys: Schema.Array(PublicJwkSchema),
});

export const ClientAccessClaimsSchema = Schema.Struct({
  iss: Schema.String,
  sub: Schema.String,
  aud: Schema.Array(Schema.String),
  exp: Schema.Finite,
  iat: Schema.Finite,
  scope: Schema.String,
  client_id: Schema.String,
});

export const FederationClaimsSchema = Schema.Struct({
  iss: Schema.String,
  sub: Schema.String,
  aud: Schema.Array(Schema.String),
  exp: Schema.Finite,
  iat: Schema.Finite,
  user_ref: Schema.optional(UserRefSchema),
});

export type LocalAccount = typeof LocalAccountSchema.Type;
export type SignupRequest = typeof SignupRequestSchema.Type;
export type RefreshToken = typeof RefreshTokenSchema.Type;
export type TokenRequest = typeof TokenRequestSchema.Type;
export type TokenResponse = typeof TokenResponseSchema.Type;
export type OidcDiscoveryDocument = typeof OidcDiscoveryDocumentSchema.Type;
export type JwksResponse = typeof JwksResponseSchema.Type;
export type AuthTokenPasswordRequest =
  typeof AuthTokenPasswordRequestSchema.Type;
export type AuthTokenRefreshRequest = typeof AuthTokenRefreshRequestSchema.Type;
export type PublicJwk = typeof PublicJwkSchema.Type;
export type ClientAccessClaims = typeof ClientAccessClaimsSchema.Type;
export type FederationClaims = typeof FederationClaimsSchema.Type;
