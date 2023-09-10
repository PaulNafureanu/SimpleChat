const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "http://localhost:3000";

class QueryString {
  private static convert = (
    typeChecker: string | number | boolean,
    valueToConvert: string
  ) => {
    if (typeof typeChecker === "number" || typeof typeChecker === "bigint")
      return Number(valueToConvert);
    if (typeof typeChecker === "boolean") return valueToConvert === "true";
    return valueToConvert;
  };

  static readonly define = <T extends object>(
    url: string,
    template: T
  ): Partial<T> => {
    let query: Partial<T> = {};
    const params = new URL(url).searchParams;
    params.forEach((value, key) => {
      if (key in template) {
        if (Array.isArray((template as any)[key]))
          (query as any)[key] = value
            .split(",")
            .map((value) =>
              QueryString.convert((template as any)[key][0], value)
            );
        else
          (query as any)[key] = QueryString.convert(
            (template as any)[key],
            value
          );
      }
    });
    return query;
  };

  static readonly defineURL = (
    query: object,
    domain: string | undefined = SERVER_DOMAIN
  ) => {
    const init: any = {};
    for (const key in query) {
      init[key] = String((query as any)[key]);
    }

    const params = new URLSearchParams(init);
    if (!domain) return `?${params.toString()}`;
    return `${domain}?${params.toString()}`;
  };
}

export default QueryString;
