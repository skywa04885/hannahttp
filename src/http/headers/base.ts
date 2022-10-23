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

export class HTTPHeaderBase {
  public encode(): string {
    throw new Error("Not implemented!");
  }
}

export class HTTPCommaSeparatedValueHeaderBase<T = string> extends HTTPHeaderBase {
  /**
   * Constructs a new header for comma separated values.
   * @param _values the values for the header.
   */
  protected constructor(protected readonly _values: T[] = []) {
    super();
  }

  /**
   * Checks if the given value is in the list.
   * @param value the value to check for.
   * @returns if the value is in the list.
   */
  public includes(value: T): boolean {
    return this._values.includes(value);
  }

  /**
   * Removes a value from the header.
   * @param value the value to remove.
   * @returns the current instance.
   */
  public remove(value: T): this {
    const idx: number = this._values.indexOf(value);
    if (idx === -1) return this;
    this._values.splice(idx, 1);
    return this;
  }

  /**
   * Pushes a new value to the header.
   * @param value the new value to push.
   * @returns the current instance.
   */
  public push(value: T): this {
    this._values.push(value);
    return this;
  }

  /**
   * Encodes the current header to a header value.
   * @returns the encoded header value.
   */
  public encode(): string {
    return this._values.join(", ");
  }

  /**
   * Decodes the given raw header value.
   * @param raw the raw header to decode.
   * @returns the decoded header.
   */
  public static decode<T = string>(
    raw: string
  ): HTTPCommaSeparatedValueHeaderBase<T> {
    return new HTTPCommaSeparatedValueHeaderBase<T>(
      raw.split(",").map((encoding: string): T => {
        return encoding.trim().toLowerCase() as T;
      })
    );
  }
}
