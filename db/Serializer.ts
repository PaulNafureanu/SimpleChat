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

class Serializer {
  private static sanitize = (obj: any) => {
    if (obj === undefined || obj === null) return {};
    if (typeof obj !== "object") return obj;

    const data = Array.isArray(obj) ? [...obj] : { ...obj };
    for (const key in data) {
      const k = key as keyof typeof data;
      if (data[k] === undefined || data[k] === null) {
        delete data[k];
      }
      if (data[k] instanceof Date) data[k] = data[k].toISOString();
      if (data[k] && typeof data[k] === "object") {
        data[k] = Serializer.sanitize(data[k]);
      }
    }
    return data;
  };

  private static serialize = <S, P extends readonly (keyof S)[]>(
    record: any,
    keys: P
  ) => {
    const obj = {} as { [key in keyof S]: any };
    keys.forEach((key) => (obj[key] = record[key]));
    return Serializer.sanitize(obj) as Pick<S, (typeof keys)[number]>;
  };

  static readonly user = (user: RS<UsersRecord>) => {
    const keys = ["email"] as const;
    return Serializer.serialize<User, typeof keys>(user, keys);
  };

  static readonly profile = (profile: RS<ProfilesRecord>) => {
    const keys = [
      "id",
      "username",
      "first_name",
      "last_name",
      "gender",
      "birthday",
      "categories",
    ] as const;
    return Serializer.serialize<Profile, typeof keys>(profile, keys);
  };

  static readonly chat = (chat: RS<ChatsRecord>) => {
    const keys = ["id", "profiles", "messages"] as const;
    return Serializer.serialize<Chat, typeof keys>(chat, keys);
  };

  static readonly conversation = (conversation: RS<ConversationsRecord>) => {
    const keys = ["id", "chat", "label"] as const;
    return Serializer.serialize<Conversations, typeof keys>(conversation, keys);
  };

  static readonly message = (message: RS<MessagesRecord>) => {
    const keys = ["id", "from", "to", "text", "delivered"] as const;
    return Serializer.serialize<Messages, typeof keys>(message, keys);
  };

  static readonly category = (category: RS<CategoriesRecord>) => {
    const keys = ["id", "conversations", "label"] as const;
    return Serializer.serialize<Categories, typeof keys>(category, keys);
  };
}

export default Serializer;
