import { HTTPHeaderType } from "../HTTPHeaderType";

export class HTTPHeader {
  public constructor() {}

  public encode(): string {
    throw new Error("Not implemented!");
  }
}

export class HTTPCommaSeparatedValueHeader<T = string> extends HTTPHeader {
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
  ): HTTPCommaSeparatedValueHeader<T> {
    return new HTTPCommaSeparatedValueHeader<T>(
      raw.split(",").map((encoding: string): T => {
        // @ts-ignore
        return encoding.trim().toLowerCase() as T;
      })
    );
  }
}
