import fs, { read, ReadStream } from "fs";
import { HTTPContentType, HTTPHeaderType } from "./HTTPHeaders";
import { HTTPClientSocket } from "./HTTPSocket";
import { HTTPVersion } from "./HTTPVersion";

export enum HTTPResponseState {
  WritingResponseLine = 0,
  WritingResponseHeaders = 1,
  WritingResponseBody = 2,
  Finished = 3,
}

export class HTTPResponse {
  protected _state: HTTPResponseState;

  public constructor(
    public readonly httpVersion: HTTPVersion,
    public readonly httpClientSocket: HTTPClientSocket
  ) {
    this._state = HTTPResponseState.WritingResponseLine;
  }

  /**
   * Resets the response (for multiple request on a single socket).
   * @returns the current instance.
   */
  public reset(): this {
    // Makes sure the response has been finished.
    if (this._state !== HTTPResponseState.Finished)
      throw new Error("Cannot reset non-finished response!");

    // Resets the state and other variables.
    this._state = HTTPResponseState.WritingResponseLine;

    // Returns the current instance.
    return this;
  }

  /**
   * gets the message for the given status code.
   * @param code the response code to get the message for.
   * @returns the message.
   */
  protected static _getMessageForStatusCode(code: number): string {
    switch (code) {
      case 200:
        return "OK";
      case 404:
        return "Page not found";
      case 500:
        return "Internal server error";
      default:
        throw new Error(`Invalid code: ${code}`);
    }
  }

  /**
   * Writes the given status code.
   * @param code the status code to send.
   * @param message the message to send.
   * @returns the current instance.
   */
  public status(code: number, message: string | null = null): this {
    // Makes sure we're in the proper state.
    if (this._state !== HTTPResponseState.WritingResponseLine)
      throw new Error("Response status has already been sent!");

    // If the message has not been given, get one of the default ones.
    if (message === null) message = HTTPResponse._getMessageForStatusCode(code);

    // Constructs the response line, then gets the buffer version..
    const responseLineString: string = `${this.httpVersion} ${code} ${message}\r\n`;
    const responseLineBuffer: Buffer = Buffer.from(responseLineString, "utf-8");

    // Writes the data to the http socket.
    this.httpClientSocket.write(responseLineBuffer);

    // Updates the state (since we've written the response line).
    this._state = HTTPResponseState.WritingResponseHeaders;

    // Returns the current instance.
    return this;
  }

  /**
   * Writes all the default headers.
   * @returns the current instance.
   */
  public defaultHeaders(): this {
    return this.header(HTTPHeaderType.Date, new Date().toUTCString())
      .header(HTTPHeaderType.Server, "HannaHTTP")
      .header(HTTPHeaderType.Connection, "close");
  }

  /**
   * Adds a single header to the response.
   * @param key the key of the header.
   * @param value the value of the header.
   * @returns the current instance.
   */
  public header(key: string, value: string): this {
    // Makes sure we're in the correct state.
    if (this._state !== HTTPResponseState.WritingResponseHeaders)
      throw new Error(`Cannot write header in state: ${this._state}`);

    // Stringifies the header, and creates a buffer from it.
    const headerString: string = `${key}: ${value}\r\n`;
    const headerStringBuffer: Buffer = Buffer.from(headerString, "utf-8");

    // Writes the header to the socket.
    this.httpClientSocket.write(headerStringBuffer);

    // Returns the instance.
    return this;
  }

  /**
   * Writes an chunk of the body.
   * @param chunk the chunk of the body to write.
   * @returns the current instance.
   */
  public bodyChunk(chunk: Buffer): this {
    // Makes sure we're in the correct state.
    if (this._state !== HTTPResponseState.WritingResponseBody)
      throw new Error(`Cannot write body chunk in state: ${this._state}`);

    // Writes the chunk.
    this.httpClientSocket.write(chunk);

    // Returns the instance.
    return this;
  }

  /**
   * Gets called when the final body chunk has been written.
   * @returns the current instance.
   */
  public finalBodyChunk(): this {
    // Makes sure we're in the correct state.
    if (this._state !== HTTPResponseState.WritingResponseBody)
      throw new Error(`Cannot finish body in state: ${this._state}`);

    // Finishes the response.
    this._state = HTTPResponseState.Finished;

    // Returns the instance.
    return this;
  }

  /**
   * Gets called after the final header has been written.
   * @returns the current instance.
   */
  public finalHeader(): this {
    // Makes sure we're in the correct state.
    if (this._state !== HTTPResponseState.WritingResponseHeaders)
      throw new Error(`Cannot finish headers in state: ${this._state}`);

    // Writes the newline to indicate the end of the headers.
    const newlineStringBuffer: Buffer = Buffer.from("\r\n", "utf-8");
    this.httpClientSocket.write(newlineStringBuffer);

    // Updates the state.
    this._state = HTTPResponseState.WritingResponseBody;

    // Returns the current instance.
    return this;
  }

  /**
   * Writes an text response.
   * @param text the text to write.
   * @param status the status code.
   * @returns the current instance.
   */
  public text(text: string, status: number = 200): this {
    // Stringifies the object, and creates the buffer version.
    const textBuffer: Buffer = Buffer.from(text, "utf-8");

    // Writes the response.
    this.status(status)
      .defaultHeaders()
      .header(HTTPHeaderType.ContentType, HTTPContentType.TextPlain)
      .header(HTTPHeaderType.ContentLength, textBuffer.length.toString())
      .finalHeader()
      .bodyChunk(textBuffer)
      .finalBodyChunk();

    // Returns the current instance.
    return this;
  }

  /**
   * Sends the given object as json.
   * @param object the object to turn into json and send.
   * @returns the current instance.
   */
  public json(object: any, status: number = 200): this {
    // Stringifies the object, and creates the buffer version.
    const objectStringified: string = JSON.stringify(object);
    const objectStringifiedBuffer: Buffer = Buffer.from(
      objectStringified,
      "utf-8"
    );

    // Writes the response.
    this.status(status)
      .defaultHeaders()
      .header(HTTPHeaderType.ContentType, HTTPContentType.ApplicationJson)
      .header(
        HTTPHeaderType.ContentLength,
        objectStringifiedBuffer.length.toString()
      )
      .finalHeader()
      .bodyChunk(objectStringifiedBuffer)
      .finalBodyChunk();

    // Returns the current instance.
    return this;
  }

  public file(path: string, status: number = 200): this {
    fs.stat(path, (err: NodeJS.ErrnoException | null, stats: fs.Stats): any => {
      // If there is an error, send it.
      if (err !== null) return this.text(err.message, 500);

      // Sends the response line with the headers.
      this.status(status)
        .defaultHeaders()
        .header(HTTPHeaderType.ContentType, HTTPContentType.TextHTML)
        .header(HTTPHeaderType.ContentLength, stats.size.toString())
        .finalHeader();

      const readStream: ReadStream = fs.createReadStream(path);

      readStream.on('error', (err: Error) => {
        this.text(err.message, 500);
      })

      readStream.on('close', (): void => {
        this.finalBodyChunk();
      });

      readStream.pipe(this.httpClientSocket.socket);
    });

    return this;
  }
}
