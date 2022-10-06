export class HTTPRequestURI {
  public constructor(
    public readonly path: string,
    public readonly search: { [key: string]: string },
    public readonly hash: string | null
  ) {}

  public static parse(uriString: string): HTTPRequestURI {
    // This regular expression will parse the URI.
    const matcher: RegExp =
      /^(?<path>(?:\/[a-zA-Z0-9_\-\.]*)+)(?<hash>#[a-zA-Z0-9_\-\.]*)?(?<search>\?([a-zA-Z0-9_\-]+=[a-zA-Z0-9_\-]*)(&[a-zA-Z]+=[a-zA-Z0-9_\-]*)*)?$/;

    // Parses the uriString with the regular expression, if the match returns the uri is invalid.
    const match: RegExpMatchArray | null = uriString.match(matcher);
    if (match === null) {
      throw new Error(
        `Invalid HTTP Request URI: Did mot match regular expression: '${uriString}'!`
      );
    }

    // Gets the groups from the parsed string.
    const pathString: string | null = match.groups?.path ?? null;
    const searchString: string | null = match.groups?.search ?? null;
    const hashString: string | null = match.groups?.hash ?? null;

    // The path must not be null, if so throw an error.
    if (pathString === null) {
      throw new Error("Invalid HTTP Request URI: Path could not be found!");
    }

    // Parses the search string object.
    const search: { [key: string]: string } = {};
    searchString
      ?.substring(1)
      .split("&")
      .forEach((pair: string, index: number): void => {
        // Splits the pair, and makes sure there are the correct number of segments.
        const segments: string[] = pair.split("=");
        if (segments.length !== 2) {
          throw new Error("Invalid HTTP Request URI: Invalid search pair!");
        }

        // Gets the key and the value from the pair.
        const [key, value]: [string, string] = segments as [string, string];

        // Inserts they key/ value pair in the search map.
        search[key] = decodeURIComponent(value);
      });

    // Parses the hash.
    const hash: string | null = hashString ? hashString.substring(1) : null;

    // Returns the parsed request uri.
    return new HTTPRequestURI(pathString, search, hash);
  }
}
