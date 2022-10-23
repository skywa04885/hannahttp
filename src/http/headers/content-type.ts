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

import { HTTPHeaderBase } from "./base";

export enum HTTPMediaType {
  ApplicationJson = "application/json",
  TextPlain = "text/plain",
  TextHTML = "text/html",
  OctetStream = "application/octet-stream",
  ImageJPEG = "image/jpeg",
  ApplicationXWWWFormUrlencoded = "application/x-www-form-urlencoded",
  TextJavascript = "text/javascript",
  TextCSS = "text/css",
  VideoMP4 = "video/mp4",
}

export class HTTPContentTypeHeader extends HTTPHeaderBase {
  public constructor(
    public readonly mediaType: HTTPMediaType,
    public readonly charset?: string,
    public readonly boundary?: string
  ) {
    super();
  }

  /**
   * Encodes the content type header.
   * @returns the encoded header.
   */
  public encode(): string {
    // Initializes the segments with the mediatype (since this is always present).
    const segments: string[] = [this.mediaType as string];

    // Constructs the key/ value pairs.
    const pairs: { [key: string]: string } = {};
    if (this.charset) pairs["charset"] = this.charset;
    if (this.boundary) pairs["boundary"] = this.boundary;

    // Encodes the key/ value pairs and adds them to the segments.
    segments.push(
      ...Object.entries(pairs).map(([key, value]): string => {
        if (value.includes(" ")) value = `"${value}"`;
        return `${key}=${value}`;
      })
    );

    // Returns the encoded header.
    return segments.join("; ");
  }

  /**
   * Parses the given raw content type header.
   * @param raw the raw content type header.
   * @returns the parsed content type header.
   */
  public static parse(raw: string): HTTPContentTypeHeader {
    let charset: string | undefined = undefined;
    let boundary: string | undefined = undefined;

    // Gets the segments of the raw header value, and
    //  trims each segment (to clean it up).
    const rawSegments: string[] = raw
      .split(";")
      .map((segment: string) => segment.trim());

    // Throws an syntax error if there are more than
    //  three segments, or less than 1.
    if (rawSegments.length > 3)
      throw Error(
        `Failed parsing "Content-Type" header: Raw segments may not be larger than 3, however it is: ${rawSegments.length}`
      );
    if (rawSegments.length < 1)
      throw Error(
        `Failed parsing "Content-Type" header: At least one segment required!`
      );

    // Gets the first segment since it has to be there.
    //  also makes it lowercase to prevent case issues.
    const mediaTypeString: string = rawSegments.at(0)!;

    // Makes sure the media type is recognized.
    if (
      !Object.values(HTTPContentTypeHeader).includes(
        mediaTypeString as HTTPMediaType
      )
    )
      throw new Error(
        `Failed parsing "Content-Type" header: Invalid media-type "${mediaTypeString}"`
      );

    // Sets the media type.
    const mediaType = mediaTypeString as HTTPMediaType;

    // Loops over the remaining segments and parses them.
    rawSegments.slice(1).forEach((pair: string, index: number): void => {
      // Gets the pair segments.
      const pairSegments: string[] = pair.split("=");
      if (pairSegments.length !== 2)
        throw new Error(
          `Failed parsing "Content-Type" header: Pair segments must be equal to 2, got: ${pairSegments.length}!`
        );

      // Gets the key and the value from the pair segments.
      let [key, value] = pairSegments as [string, string];

      // Trims the key and the value, and makes the key lowercase.
      key = key.trim().toLowerCase();
      value = value.trim();

      // If the value is quoted, remove the quotes.
      if (value.startsWith('"') && value.endsWith('"'))
        value = value.slice(1, -1);

      // Checks the key, and what to do with it.
      switch (key) {
        // Dealing with charset (make lowercase to prevent issues).
        case "charset":
          charset = value.toLowerCase();
          break;
        // Dealing with boundary (keep original case).
        case "boundary":
          boundary = value;
          break;
        // Something else, error.
        default:
          throw new Error(
            `Failed parsing "Content-Type" header: Key "${key}" is not recognized!`
          );
      }
    });

    // Returns the parsed content-type header.
    return new HTTPContentTypeHeader(mediaType, charset, boundary);
  }
}
