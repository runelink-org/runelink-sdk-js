// export const PROTOCOL_VERSION = "1.0.0";

import type { Message } from "./types";

// This will all be with zod
export type ClientToServerMessage =
  | { type: "auth"; token: string }
  | { type: "send_message"; channel_id: string; content: string };

export type ServerToClientMessage =
  | { type: "auth_success"; user_ref: string }
  | { type: "auth_error"; message: string }
  | { type: "message"; channel_id: string; message: Message }

export type RunelinkMessage = ClientToServerMessage | ServerToClientMessage;
