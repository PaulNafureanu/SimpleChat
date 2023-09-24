import { Table, TableConfig } from "./db";
import { getXataClient } from "./xata";
const xata = getXataClient();

export const ProfilesTable: Table = xata.db.Profiles;
export const UsersTable: Table = xata.db.Users;
export const MessagesTable: Table = xata.db.Messages;
export const ConversationsTable: Table = xata.db.Conversations;
export const ChatsTable: Table = xata.db.Chats;
export const CategoriesTable: Table = xata.db.Categories;

export const TableConfigs = {
  UserProfile: {
    tables: [ProfilesTable, UsersTable],
    relation: { mainTableID: 0, secondaryTableIDs: [1], tableKeys: ["user"] },
  } as TableConfig,
} as const;
