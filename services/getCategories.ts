import categories from "../data/categories.json";

interface Category {
  id: number;
  label: string;
  conversations: number[];
}

interface SearchQuery {
  byCategory: number[];
}

export default function getCategories(searchQuery?: SearchQuery): Category[] {
  if (!searchQuery) return categories;
  else {
    const { byCategory } = searchQuery;
    let filteredCategories = categories;

    if (byCategory)
      filteredCategories = filteredCategories.filter((category) =>
        byCategory.includes(category.id)
      );

    return filteredCategories;
  }
}
