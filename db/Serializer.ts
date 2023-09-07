import type { SelectedPick, XataRecord } from "@xata.io/client";
import type {
  CategoriesRecord,
  ChatsRecord,
  ConversationsRecord,
  MessagesRecord,
  ProfilesRecord,
  UsersRecord,
} from "./xata";

type RS<X extends XataRecord> = Readonly<SelectedPick<X, ["*"]>>;

/**
 * Utility functions for checking values
 */

const isNull = (obj: any): obj is null => obj === null;

const removeNull = <T>(obj: T): NonNullable<T> | undefined =>
  isNull(obj) ? undefined : (obj as NonNullable<T>);

const sanitize = (obj: any) => {
  if (obj === undefined || obj === null) return {};
  if (typeof obj !== "object") return obj;

  const data = { ...obj };
  for (const key in data) {
    const k = key as keyof typeof data;
    if (data[k] === undefined || data[k] === null) {
      delete data[k];
    }
    if (data[k] instanceof Date) data[k] = data[k].toISOString();
    if (data[k] && typeof data[k] === "object") {
      data[k] = sanitize(data[k]);
    }
  }
  return data;
};

/**
 * General serializer
 */

const serializer = <S>(record: any, keys: (keyof S)[]): S => {
  const obj = {} as { [key in keyof S]: any };
  keys.forEach((key) => (obj[key] = record[key]));
  return sanitize(obj) as S;
};

/**
 * Specific serializers
 */

export function UserSerializer(user: RS<UsersRecord>) {
  return serializer<User>(user, ["id", "email", "password"]);
}

export function ProfileSerializer(profile: RS<ProfilesRecord>) {
  return serializer<Profile>(profile, [
    "id",
    "user",
    "username",
    "first_name",
    "last_name",
    "gender",
    "birthday",
    "categories",
  ]);
}

export function ChatSerializer(chat: RS<ChatsRecord>) {
  return serializer<Chat>(chat, ["id", "profiles", "messages"]);
}

export function ConversationSerializer(conversation: RS<ConversationsRecord>) {
  return serializer<Conversations>(conversation, ["id", "chat", "label"]);
}

export function MessageSerializer(message: RS<MessagesRecord>) {
  return serializer<Messages>(message, [
    "id",
    "from",
    "to",
    "text",
    "delivered",
  ]);
}

export function CategorySerializer(category: RS<CategoriesRecord>) {
  return serializer<Categories>(category, ["id", "conversations", "label"]);
}
