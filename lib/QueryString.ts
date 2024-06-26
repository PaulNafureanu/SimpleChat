const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "http://localhost:3000";

class QueryString {
  private static convert = (
    typeChecker: string | number | boolean,
    valueToConvert: string
  ) => {
    if (typeof typeChecker === "number" || typeof typeChecker === "bigint") {
      const converted = Number(valueToConvert);
      return Number.isNaN(converted) ? undefined : converted;
    }
    if (typeof typeChecker === "boolean") return valueToConvert === "true";
    return valueToConvert;
  };

  static readonly define = <T extends object>(
    url: string,
    template: T
  ): Partial<T> => {
    try {
      let query: Partial<T> = {};
      const params = new URL(url).searchParams;
      params.forEach((value, key) => {
        if (key in template) {
          if (Array.isArray((template as any)[key]))
            (query as any)[key] = value.includes(",")
              ? value
                  .split(",")
                  .map((value) =>
                    QueryString.convert((template as any)[key][0] || "", value)
                  )
              : undefined;
          else
            (query as any)[key] = QueryString.convert(
              (template as any)[key],
              value
            );
        }
      });
      return query;
    } catch (error) {
      throw new QueryString.Error(
        "Error at defining the query string from the URL. " +
          (error as Error).message
      );
    }
  };

  static readonly defineURL = (
    query: object,
    domain: string | undefined = SERVER_DOMAIN
  ) => {
    try {
      const init: { [key: string]: string } = {};
      for (const key in query) {
        const value = (query as any)[key];
        if (value === undefined || value === null) continue;
        if (
          Array.isArray(value) &&
          (value.includes(undefined) || value.includes(null))
        )
          continue;
        if (!Array.isArray(value)) init[key] = String(value);
        else
          init[key] = String(
            value.reduce((pValue, cValue) => `${pValue},${cValue}`)
          );
      }

      const params = new URLSearchParams(init);
      if (!domain) return `?${params.toString()}`;
      return `${domain}?${params.toString()}`;
    } catch (error) {
      throw new QueryString.Error(
        "Error at defining the URL from the query string." +
          (error as Error).message
      );
    }
  };

  static readonly handleError = (error: Error) => error.message;

  static readonly Error = class QueryStringError extends Error {};
}

export default QueryString;
