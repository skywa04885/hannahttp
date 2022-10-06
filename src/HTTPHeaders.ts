export enum HTTPHeaderType {
  ContentType = "Content-Type",
  ContentLength = "Content-Length",
  Date = "Date",
  Server = "Server",
  Connection = "Connection",
}

export enum HTTPContentType {
  ApplicationJson = "application/json",
  TextPlain = "text/plain",
  TextHTML = "text/html",
  OctetStream = "application/octet-stream",
  ApplicationXWWWFormUrlencoded = "application/x-www-form-urlencoded",
}

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

  public *iterator(): Generator<{key: string, value: string | string[]}> {
    for (const pair of Object.entries(this.headers)) {
      yield {
        key: pair[0],
        value: pair[1],
      };
    }
  }
}
