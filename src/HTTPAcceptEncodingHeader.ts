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
