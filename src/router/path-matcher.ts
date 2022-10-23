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

import { HTTPPathMatch } from "./path-match";

export class HTTPPathMatcher {
  /**
   * Constructs a new HTTP path matcher.
   * @param regularExpression the regular expression to match against.
   * @param parameterNames the array of parameters which will be processed.
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
    // Replaces all the multiple occurences of slashes with a single slash.
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
  public static fromPath(pathString: string): HTTPPathMatcher {
    // Cleans the path.
    pathString = this.cleanPath(pathString);

    // Splits the path into segments.
    const pathSegmentStrings: string[] = pathString.split("/");

    // Constructs the list of expression segments.
    const parameterNames: string[] = [];
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
    const regularExpression = new RegExp(
      `^${regularExpressionSegments.join("\\/")}$`
    );

    // Returns the final URI matcher.
    return new HTTPPathMatcher(regularExpression, parameterNames);
  }

  /**
   * Matches the given path against the internal regular expression.
   * @param pathString the path to match against.
   * @returns the matching result or null.
   */
  public match(pathString: string): HTTPPathMatch | null {
    // Cleans the path string.
    pathString = HTTPPathMatcher.cleanPath(pathString);

    // Performs the matching, and if nothing matches return null.
    const regExpMatchArray: RegExpMatchArray | undefined = pathString.match(
      this.regularExpression
    ) ?? undefined;
    if (!regExpMatchArray) return null;

    // Constructs the result object.
    const matcherResult: HTTPPathMatch = {
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
