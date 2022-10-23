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

export enum HTTPRangeUnit {
  Bytes = "bytes",
}

export interface HTTPRange {
  from: number | null;
  to: number | null;
}

export class HTTPRangeHeader extends HTTPHeaderBase {
  public constructor(
    public readonly unit: HTTPRangeUnit = HTTPRangeUnit.Bytes,
    public readonly ranges: HTTPRange[] = []
  ) {
    super();
  }

  public static decode(raw: string): HTTPRangeHeader {
    const regularExpression = /^(?<unit>[a-zA-Z0-9]+)=(?<ranges>([0-9]*\-[0-9]*,\s+)*([0-9]*\-[0-9]*))$/;

    // Matches the raw string against the regular expression, if it does not match throw error.
    const match: RegExpMatchArray | null = raw.match(regularExpression);
    if(match === null) throw new Error(`"${raw}" is not formatted properly!`);

    // Makes sure that the unit is valid.
    if (!Object.values(HTTPRangeUnit).includes(match.groups!.unit as HTTPRangeUnit))
      throw new Error(`Invalid range unit used: "${match.groups!.unit}"`);

    // Gets the unit.
    const unit: HTTPRangeUnit = match.groups!.unit as HTTPRangeUnit;

    // Parses the ranges.
    const ranges: HTTPRange[] = match.groups!.ranges.split(',').map((rawRange: string): HTTPRange => {
      // Gets the segments, we don't have to verify the length since we already know it's in the proper format,
      const segments: string[] = rawRange.split('-');

      // Parses the range.
      const from: number | null = segments[0].length === 0 ? null : parseInt(segments[0]);
      const to: number | null = segments[1].length === 0 ? null : parseInt(segments[1]);

      // Returns the range.
      return {
        from, to
      };
    });

    // Constructs the parsed header.
    return new HTTPRangeHeader(unit, ranges);
  }
}
