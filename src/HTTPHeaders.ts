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

export class HTTPHeaders {
  /**
   * Constructs a new headers instance.
   * @param headers the headers map.
   */
  public constructor(
    public readonly headers: { [key: string]: string | string[] } = {}
  ) {}

  /**
   * Inserts a new header.
   * @param key the key of the header to add.
   * @param value the value of the header to add.
   * @param transform if the headers should be transformed.
   * @returns the class instance.
   */
  public addHeader(
    key: string,
    value: string,
    transform: boolean = true
  ): this {
    // Makes the key lowercase.
    key = key.toLowerCase();

    // Gets the current value of the header.
    const header: string[] | string | null = this.headers[key] ?? null;

    // Checks the current value of the header, and changes it.
    if (header === null) this.headers[key] = value;
    else if (Array.isArray(header)) header.push(value);
    else this.headers[key] = [header, value];

    // Returns current instance.
    return this;
  }

  /**
   * Sets a single header value.
   * @param key sets a single header value, replacing existing ones.
   * @param value the value to put there.
   * @returns the current instance.
   */
  public setSingleHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  /**
   * Gets the given header.
   * @param key the key of the header to get.
   * @returns the header value.
   */
  public getHeader(key: string): string[] | string | null {
    return this.headers[key];
  }

  /**
   * Gets a single header value.
   * @param key the key of the header to get.
   * @param index the index of the header.
   * @param transform if the headers should be transformed.
   * @returns the header value.
   */
  public getSingleHeader(
    key: string,
    index: number = 0,
    transform: boolean = true
  ): string | null {
    // Transforms the key.
    key = key.toLowerCase();

    // Gets the current value of the header.
    const header: string[] | string | null = this.headers[key] ?? null;

    // Checks the type of header value, and returns the appropiate kind.
    if (header === null) return null;
    else if (Array.isArray(header)) return header[index] ?? null;
    else return header;
  }

  /**
   * Gets the iterator for each key/ value pair.
   */
  public *iterator(): Generator<{key: string, value: string | string[]}> {
    for (const pair of Object.entries(this.headers)) {
      yield {
        key: pair[0],
        value: pair[1],
      };
    }
  }
}
