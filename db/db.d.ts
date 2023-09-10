/**
 * Types for the serialized db date models
 */

interface User {
  id: string;
  email: string;
  password: string;
}

interface Profile {
  id: string;
  user: ID;
  username?: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  birthday?: Date;
  categories?: string[];
}

interface Chat {
  id: string;
  profiles: string[];
  messages: string[];
}

interface Conversations {
  id: string;
  chat: ID;
  label: string;
}

interface Messages {
  id: string;
  from: ID;
  to: ID;
  text: string;
  delivered: Date;
}

interface Categories {
  id: string;
  conversations: string[];
  label: string;
}

/**
 * Additional Utility Types
 */

type ID<T> = { id: string };
type OmitID<T> = Omit<T, "id">;
type EnsureID<T> = Partial<T> & ID;

interface Collection<T> {
  count: number;
  hasNextPage: boolean;
  next?: string;
  previous?: string;
  results: T[];
}
