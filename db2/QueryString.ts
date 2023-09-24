export interface BaseQueryString {
  page: number;
  size: number;
}

const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "http://localhost:3000";

class QueryString {
  private static Templates = {
    UserProfile: {
      page: 0,
      size: 0,
      search: "",
      search_precise: "",
      categories: [""],
      conversations: [""],
    },
    Category: { page: 0, size: 0 },
    Conversation: { page: 0, size: 0 },
    Message: { page: 0, size: 0 },
  } as const;

  /**
   * Giving a string value and a key from the template, the algorithm
   * converts the type of value (string) to the type of the key
   * (either string, number, boolean, or undefined).
   * @param value a string value to be converted.
   * @param key a template key useful for its type.
   * @returns the value converted from type string to the type of the template key.
   */
  private static handleValue = (
    value: string,
    key: string | number | boolean
  ) => {
    if (typeof key === "number" || typeof key === "bigint") {
      const result = Number(value);
      return Number.isNaN(result) ? undefined : result;
    }
    if (typeof key === "boolean") return value === "true";
    return value;
  };

  /**
   * Giving a string value and a key type array from the template, the algorithm
   * converts the string value to the expected array type.
   * @param value  a string value to be converted to an expected array type
   * @param arr a template key of an array type
   * @returns the value converted from type string to an array of the type of the template key
   */
  private static handleArray = (value: string, arr: any[]) => {
    return value.includes(",")
      ? value.split(",").map((v) => QueryString.handleValue(v, arr[0] || ""))
      : undefined;
  };

  static readonly define = <T extends BaseQueryString>(
    url: string,
    template: T
  ) => {
    let query: Partial<T> = {};
    const params = new URL(url).searchParams;

    params.forEach((value, key) => {
      /* For each value-key pair in the search params, if the key is expected in the template
            try convert the value to the proper type format, then insert it in the query object*/
      if (key in template) {
        // If the value is expected to be an array value
        if (Array.isArray((template as any)[key])) {
          (query as any)[key] = QueryString.handleArray(
            value,
            (template as any)[key]
          );
          // If the value is expected to be a non-array value
        } else {
          (query as any)[key] = QueryString.handleValue(
            value,
            (template as any)[key]
          );
        }
      }
    });

    // return the query object formed
    return query;
  };

  /**
   * Extract valid key-value pairs from a query object and define a string search query or url with those.
   * @param query an object containing key-value pairs to be stringified to an url, or string query.
   * @param domain useful to define the the full url.
   * @returns a string search query (that starts with ?), or a full url if the domain is also provided.
   */
  static readonly getURL = (query: object, domain: string = SERVER_DOMAIN) => {
    try {
      const urlParams: { [key: string]: string } = {};
      for (const key in query) {
        const value = (query as any)[key];

        // If the value is not supported (undefined, null or array of those types),
        // continue to the next key - value:
        if (value === undefined || value === null) continue;
        if (
          Array.isArray(value) &&
          (value.includes(undefined) || value.includes(null))
        )
          continue;

        // If the value is not an array, stringify it
        if (!Array.isArray(value)) urlParams[key] = String(value);
        // If it is a valid array, reduce (format) the array to a single string value
        else
          urlParams[key] = String(
            value.reduce((pValue, cValue) => `${pValue},${cValue}`)
          );
      }

      // Stringify the url params object, then return the url or the string query
      const params = new URLSearchParams(urlParams);
      if (!domain) return `?${params.toString()}`;
      return `${domain}?${params.toString()}`;
    } catch (error) {
      throw new QueryString.Error(
        "Error at defining the URL from the query string." +
          (error as Error).message
      );
    }
  };

  // Return specific query types
  static readonly getQuery = {
    userProfile: (url: string) =>
      QueryString.define(url, QueryString.Templates.UserProfile),
    category: (url: string) =>
      QueryString.define(url, QueryString.Templates.Category),
    conversation: (url: string) =>
      QueryString.define(url, QueryString.Templates.Conversation),
    message: (url: string) =>
      QueryString.define(url, QueryString.Templates.Message),
  };

  // Define how to handle query related errors
  static readonly handleError = (error: Error) => error.message;
  static readonly Error = class QueryStringError extends Error {};
}

export default QueryString;
