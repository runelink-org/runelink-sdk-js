// This will all be with zod

export interface UserRef {
  name: string;
  host: string;
}

export interface User {
  name: string;
  host: string;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface Message {
  id: string;
  channelId: string;
  author_ref: UserRef;
  body: string;
}

export interface Channel {
  id: string;
  name: string;
}
