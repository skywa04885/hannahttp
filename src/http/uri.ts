/*
  HannaHTTP extremely fast and customizable HTTP server.
  Copyright (C) Luke A.C.A. Rieff 2022

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

export class HTTPURI {
  /**
   * Creates a new HTTP uri.
   * @param path the path of the uri.
   * @param search the search of the uri.
   * @param hash the hash of the uri.
   */
  public constructor(
    public readonly path: string,
    public readonly search: { [key: string]: string },
    public readonly hash: string | null
  ) {}

  /**
   * Parses the given uri.
   * @param uri the uri to parse.
   * @returns the parsed uri.
   */
  public static parse(uri: string): HTTPURI {
    // This regular expression will parse the URI.
    const matcher =
      /^(?<path>(?:\/[a-zA-Z0-9_\-\.]*)+)(?<hash>#[a-zA-Z0-9_\-\.]*)?(?<search>\?([a-zA-Z0-9_\-]+=[a-zA-Z0-9_\-]*)(&[a-zA-Z]+=[a-zA-Z0-9_\-]*)*)?$/;

    // Parses the uriString with the regular expression, if the match returns the uri is invalid.
    const match: RegExpMatchArray | null = uri.match(matcher);
    if (match === null) {
      throw new Error(
        `Invalid HTTP Request URI: Did mot match regular expression: '${uri}'!`
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
    return new HTTPURI(pathString, search, hash);
  }
}
