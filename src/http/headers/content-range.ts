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

export enum HTTPContentRangeUnit {
  Bytes = "bytes",
}

export class HTTPContentRangeHeader extends HTTPHeaderBase {
  public constructor(
    public readonly unit: HTTPContentRangeUnit,
    public readonly rangeStart: number,
    public readonly rangeEnd: number,
    public readonly size: number | null
  ) {
    super();
  }

  /**
   * Encodes the header.
   * @returns the encoded value.
   */
  public encode(): string {
    // Gets copies of the values so they can be converted.
    const rangeStart: number = this.rangeStart;
    const rangeEnd: number = this.rangeEnd;
    const size: number | null = this.size;

    // Converts the ranges/ sizes from bytes to the actual units.
    // TODO: Add conversions.

    // Returns the encoded string.
    return `${this.unit} ${rangeStart}-${rangeEnd}/${size ?? "*"}`;
  }

  /**
   * Decodes the given header value.
   * @param raw the raw header value.
   * @returns the decoded header value.
   */
  public static decode(raw: string): HTTPContentRangeHeader {
    // The regular expression we'll use to parse the header.
    const regularExpression =
      /^(?<unit>[a-zA-Z0-9]+)\s+(?<rangeStart>[0-9]+)\-(?<rangeEnd>[0-9]+)\/(?<size>\*|[0-9]+)$/;

    // Matches the regular expession, and if it did not match, throw syntax error.
    const match: RegExpMatchArray | null = raw.match(regularExpression);
    if (match === null)
      throw new Error(`"Content-Range" value syntax not valid.`);

    // Makes sure the unit is valid.
    if (!Object.values(HTTPContentRangeUnit).includes(match.groups!.unit! as HTTPContentRangeUnit))
      throw new Error(`"Content-Range" invalid unit given: "${match.groups!.unit!}"`);

    // Preprocesses the values.
    const unit: HTTPContentRangeUnit = match.groups!.unit as HTTPContentRangeUnit;
    const rangeStart: number = parseInt(match.groups!.rangeStart!);
    const rangeEnd = parseInt(match.groups!.rangeEnd!);
    const size = match.groups!.size! === '*' ? null : parseInt(match.groups!.size!);

    // Returns the decoded header.
    return new HTTPContentRangeHeader(unit, rangeStart, rangeEnd, size);
  }
}
