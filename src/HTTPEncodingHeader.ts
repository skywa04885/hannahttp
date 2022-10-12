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

import { HTTPEncoding } from "./HTTPEncoding";

export class HTTPEncodingHeader {
  public constructor(public encodings: (HTTPEncoding | string)[]) {}

  /**
   * Checks if the given encoding is contained.
   * @param encoding the encoding to check if it is contained.
   * @returns if the encoding is contained.
   */
  public contains(encoding: HTTPEncoding | string): boolean {
    return this.encodings.includes(encoding);
  }

  /**
   * Encodes the header.
   * @returns the encoded header.
   */
  public encode(): string {
    return this.encodings.join(', ');
  }

  /**
   * Parses an accept encoding header from the given value.
   * @param value the value to turn into the accept encoding header.
   * @returns the parsed accept encoding header.
   */
  public static fromValue(value: string): HTTPEncodingHeader {
    return new HTTPEncodingHeader(
      value.split(",").map((rawEncoding: string): string => {
        return rawEncoding.trim().toLowerCase();
      })
    );
  }
}
