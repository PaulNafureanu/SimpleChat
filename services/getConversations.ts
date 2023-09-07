import conversations from "../data/conversations.json";
import getCategories from "./getCategories";

interface Conversation {
  id: number;
  label: string;
  name: string;
  account: string;
  photo: string;
}

interface SearchQuery {
  byCategory?: number[];
}

export default function getConversations(
  searchQuery?: SearchQuery
): Conversation[] {
  if (!searchQuery) return conversations;
  else {
    const { byCategory } = searchQuery;
    let filteredConversations = conversations;

    if (byCategory) {
      const categories = getCategories({ byCategory });
      let finalFilteredConversations: typeof conversations = [];

      for (const category of categories) {
        let partialfilteredConversations = filteredConversations.filter(
          // eslint-disable-next-line no-loop-func
          (conversation) =>
            category.conversations.includes(conversation.id) &&
            !finalFilteredConversations.includes(conversation)
        );

        finalFilteredConversations = finalFilteredConversations.concat(
          partialfilteredConversations
        );
      }

      filteredConversations = finalFilteredConversations;
    }

    return filteredConversations;
  }
}
