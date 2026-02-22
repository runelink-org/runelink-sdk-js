import { z } from "zod";
import { MessageSchema } from "./schema";

export const PROTOCOL_VERSION = "1.0.0";

export const AuthMessageSchema = z.object({
  type: z.literal("auth"),
  token: z.string(),
});

export const SendMessageSchema = z.object({
  type: z.literal("send_message"),
  channel_id: z.string(),
  content: z.string(),
});

export const ClientToServerMessageSchema = z.discriminatedUnion("type", [
  AuthMessageSchema,
  SendMessageSchema,
]);

export const AuthSuccessMessageSchema = z.object({
  type: z.literal("auth_success"),
  user_ref: z.string(),
});

export const AuthErrorMessageSchema = z.object({
  type: z.literal("auth_error"),
  message: z.string(),
});

export const MessageEventSchema = z.object({
  type: z.literal("message"),
  channel_id: z.string(),
  message: MessageSchema,
});

export const ServerToClientMessageSchema = z.discriminatedUnion("type", [
  AuthSuccessMessageSchema,
  AuthErrorMessageSchema,
  MessageEventSchema,
]);

export type ClientToServerMessage = z.infer<typeof ClientToServerMessageSchema>;
export type ServerToClientMessage = z.infer<typeof ServerToClientMessageSchema>;
