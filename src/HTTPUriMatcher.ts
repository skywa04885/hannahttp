export interface HTTPUriMatcherResult {
  parameters: { [key: string]: string };
  remainder: string | null;
}

export class HTTPUriMatcher {
  /**
   * Constructs a new HTTP uri matcher.
   * @param regularExpression the regular expression to match against.
   * @param parameterNames the parameters.
   */
  protected constructor(
    public readonly regularExpression: RegExp,
    public readonly parameterNames: string[]
  ) {}

  /**
   * Cleans the given path.
   * @param pathString the path to clean.
   * @returns the cleaned path.
   */
  protected static cleanPath(pathString: string): string {
    pathString = pathString.replace(/\\+/, "/");

    // Checks if there is any prefix or suffix slash.
    const prefixSlashPresent: boolean = pathString.startsWith("/");
    const suffixSlashPresent: boolean = pathString.endsWith("/");

    // If any is present, create the substring version without them.
    if (prefixSlashPresent || suffixSlashPresent) {
      // Calculate the start and end indices.
      const startIndex: number = prefixSlashPresent ? 1 : 0;
      const endIndex: number = suffixSlashPresent
        ? pathString.length - 1
        : pathString.length;

      // Get the substring.
      pathString = pathString.substring(startIndex, endIndex);
    }

    // Returns the cleaned path string.
    return pathString;
  }

  /**
   * Constructs a new URI matcher from the given path.
   * @param pathString the path string.
   * @returns the parsed URI matcher.
   */
  public static fromPath(pathString: string): HTTPUriMatcher {
    // Cleans the path.
    pathString = this.cleanPath(pathString);

    // Splits the path into segments.
    const pathSegmentStrings: string[] = pathString.split("/");

    // Constructs the list of expression segments.
    let parameterNames: string[] = [];
    const regularExpressionSegments: string[] = pathSegmentStrings.map(
      (pathSegmentString: string, index: number, array: string[]): string => {
        if (pathSegmentString.startsWith(":")) {
          // Gets the parameter name.
          const parameterName: string = pathSegmentString.substring(1);

          // Checks if the parameter is not yet in the parameters, if it is
          //  throw an error since it's already used.
          if (parameterNames.includes(parameterName))
            throw new Error(
              `Parameter with name '${parameterName}' used more than one time, this is not allowed!`
            );

          // Checks if the parameter starts and ends with __ if so throw error, since
          //  these parameter names are reserved.
          if (parameterName.startsWith("__") && parameterName.endsWith("__"))
            throw new Error(
              `Parameters starting and ending with '__' are reserved for system usage!`
            );

          // Pushes the parameter name to the final list of parameters.
          parameterNames.push(parameterName);

          // Returns the matcher for the regular expression.
          return `(?<${parameterName}>[A-Za-z0-9_\\-]+)`;
        } else if (pathSegmentString === "*") {
          // Makes sure the asterix is the last matcher in the string.
          if (index + 1 < array.length)
            throw new Error(
              `Cannot use '*' pattern while not at the end of the path.`
            );
          
          // Returns the matcher for the regular expression.
          return `(?<__remainder__>.*)`;
        }

        return pathSegmentString;
      }
    );

    // Constructs the final regular expression from the segments.
    const regularExpression: RegExp = new RegExp(
      `^${regularExpressionSegments.join("\\/")}\$`
    );

    // Returns the final URI matcher.
    return new HTTPUriMatcher(regularExpression, parameterNames);
  }

  /**
   * Matches the given path against the internal regular expression.
   * @param pathString the path to match against.
   * @returns the matching result or null.
   */
  public match(pathString: string): HTTPUriMatcherResult | null {
    // Cleans the path string.
    pathString = HTTPUriMatcher.cleanPath(pathString);

    // Performs the matching, and if nothing matches return null.
    const regExpMatchArray: RegExpMatchArray | null = pathString.match(
      this.regularExpression
    );
    if (regExpMatchArray === null) return null;

    // Constructs the result object.
    const matcherResult: HTTPUriMatcherResult = {
      parameters: {},
      remainder: null,
    };

    // Inserts the parameters into the result object.
    for (const parameterName of this.parameterNames) {
      matcherResult.parameters[parameterName] =
        regExpMatchArray.groups![parameterName]!;
    }

    // Gets the remainder if there (will be the path remaining from and after the asterix).
    matcherResult.remainder = regExpMatchArray.groups?.__remainder__ ?? null;

    // Returns the match.
    return matcherResult;
  }
}
