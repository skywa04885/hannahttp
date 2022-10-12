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

import fs, { createWriteStream, read, ReadStream, WriteStream } from "fs";
import path from "path";
import { HTTPContentType } from "./HTTPContentType";
import { HTTPHeaderType } from "./HTTPHeaderType";
import { HTTPClientSocket } from "./HTTPClientSocket";
import { HTTPVersion } from "./HTTPVersion";
import { EventEmitter, Stream, Transform, Writable } from "stream";
import { HTTPServerSocket } from "./HTTPServerSocket";

export enum HTTPResponseState {
  WritingResponseLine = 0,
  WritingResponseHeaders = 1,
  WritingResponseBody = 2,
  Finished = 3,
}

export enum HTTPResponseBodyType {
  None = 0,
  Regular = 1,
  Chunked = 2,
}

export class HTTPResponse {
  protected _state: HTTPResponseState;
  protected _enqueuedHeaders: [string, string][] | null;
  protected _responseBodyType: HTTPResponseBodyType | null = null;
  protected _bodyWritable: Writable | null = null;

  public constructor(
    public readonly httpVersion: HTTPVersion,
    public readonly httpClientSocket: HTTPClientSocket,
    public readonly finishedCallback: () => void
  ) {
    this._state = HTTPResponseState.WritingResponseLine;
    this._enqueuedHeaders = null;
    this._responseBodyType = null;
    this._bodyWritable = null;
  }

  /**
   * Resets the response (for multiple request on a single socket).
   * @returns the current instance.
   */
  public reset(): this {
    // Makes sure the response has been finished.
    if (this._state !== HTTPResponseState.Finished)
      throw new Error("Cannot reset non-finished response!");

    this._state = HTTPResponseState.WritingResponseLine;
    this._enqueuedHeaders = null;
    this._responseBodyType = null;
    this._bodyWritable = null;

    // Returns the current instance.
    return this;
  }

  /**
   * Adds a transform stream.
   * @param transform the transform stream.
   * @returns the current instance.
   */
  public addBodyTransform(transform: Transform): this {
    // Checks if we're in the appropriate state.
    if (
      this._state !== HTTPResponseState.WritingResponseHeaders &&
      this._state !== HTTPResponseState.WritingResponseLine
    )
      throw new Error(
        "Cannot set body transformer when in other state than headers or response line."
      );

    // Checks if the content encoding type is buffer, if not, throw an error (required to prevent mess-ups).
    if (this._responseBodyType !== HTTPResponseBodyType.Chunked)
      throw new Error(
        "Cannot transform body when the content type is not chunked."
      );

    // Performs some logging.
    this.httpClientSocket.trace(`Adding body transform, this is probably meant for compression.`);

    // Adds the stream.
    transform.pipe(this._bodyWritable!, {
      end: this._bodyWritable === this.httpClientSocket.socket ? false : true,
    });
    this._bodyWritable = transform;

    // Returns the current instance.
    return this;
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
    this.httpClientSocket.socket.write(responseLineBuffer);

    // Updates the state (since we've written the response line).
    this._state = HTTPResponseState.WritingResponseHeaders;

    // Writes the enqueued headers.
    this._writeEnqueuedHeaders();

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
      .header(HTTPHeaderType.Connection, "keep-alive");
  }

  /**
   * Adds a single header to the response.
   * @param key the key of the header.
   * @param value the value of the header.
   * @returns the current instance.
   */
  public header(key: string, value: string): this {
    // If we're in the response line state (maybe during middleware) enqueue the headers.
    if (this._state === HTTPResponseState.WritingResponseLine) {
      if (this._enqueuedHeaders === null) this._enqueuedHeaders = [];
      this._enqueuedHeaders.push([key, value]);
      return this;
    }

    // Makes sure we're in the correct state.
    if (this._state !== HTTPResponseState.WritingResponseHeaders)
      throw new Error(`Cannot write header in state: ${this._state}`);

    // Stringifies the header, and creates a buffer from it.
    const headerString: string = `${key}: ${value}\r\n`;
    const headerStringBuffer: Buffer = Buffer.from(headerString, "utf-8");

    // Writes the header to the socket.
    this.httpClientSocket.socket.write(headerStringBuffer);

    // Returns the instance.
    return this;
  }

  /**
   * Tells the response we'll be sending a chunking response.
   * @returns the current instance.
   */
  public useChunkedBody(): this {
    // Makes sure the type is not set yet.
    if (this._responseBodyType !== null)
      throw new Error(
        `Response body type already set to: ${this._responseBodyType}`
      );

    // Makes sure we are in the proper state to determine the response type.
    if (
      this._state !== HTTPResponseState.WritingResponseHeaders &&
      this._state !== HTTPResponseState.WritingResponseLine
    )
      throw new Error(
        `Cannot begin writing chunked body in state: ${this._state}`
      );

    // Sets the response body type.
    this._responseBodyType = HTTPResponseBodyType.Chunked;

    // Sets the stream to write to.
    this._bodyWritable = new Writable({
      final: (callback: (error: Error | null | undefined) => void) => {
        // Performs some logging.
        this.httpClientSocket.trace(`Chunked body has finished writing, sending final zero chunk.`);


        // Writes the final zero chunk.
        this.httpClientSocket.socket.write(Buffer.from("0\r\n\r\n", "utf-8"));

        // Calls the finished callback.
        this.finishedCallback();

        // Finishes the stream.
        callback(null);
      },
      write: (
        buffer: Buffer,
        encoding: BufferEncoding,
        callback: (error: Error | null | undefined) => void
      ) => {
        // Performs some logging.
        this.httpClientSocket.trace(`Chunked body writing chunk of size ${buffer.length}.`);

        // Creates the line that contains the length and the chunk.
        const lengthLineBuffer: Buffer = Buffer.from(
          `${buffer.length.toString(16)}\r\n`,
          "utf-8"
        );

        // Writes the length line buffer and the buffer to the client.
        this.httpClientSocket.socket.write(lengthLineBuffer);
        this.httpClientSocket.socket.write(buffer);
        this.httpClientSocket.socket.write(Buffer.from("\r\n", "utf-8"));

        // Waits for the socket to drain before writing the next chunk.
        if (this.httpClientSocket.socket.writableNeedDrain)
          this.httpClientSocket.socket.once("drain", () => callback(null));
        else callback(null);
      },
    });

    // Returns the current instance.
    return this;
  }

  /**
   * Tells the response we'll be using a regular response.
   * @param contentLength the length of the content about to be sent.
   * @returns the current instance.
   */
  public useRegularBody(contentLength: number): this {
    // Makes sure the type is not set yet.
    if (this._responseBodyType !== null)
      throw new Error(
        `Response body type already set to: ${this._responseBodyType}`
      );

    // Makes sure we are in the proper state to determine the response type.
    if (
      this._state !== HTTPResponseState.WritingResponseHeaders &&
      this._state !== HTTPResponseState.WritingResponseLine
    )
      throw new Error(
        `Cannot begin writing regular body in state: ${this._state}`
      );

    // Sets the header for the content length.
    this.header(HTTPHeaderType.ContentLength, contentLength.toString());

    // Sets the response body type.
    this._responseBodyType = HTTPResponseBodyType.Regular;

    // Sets the body writable.
    this._bodyWritable = new Writable({
      final: (callback: (error: Error | null | undefined) => void) => {
        // Performs some logging.
        this.httpClientSocket.trace(`Regular body has finished writing.`);

        // Calls the finished callback.
        this.finishedCallback();

        // Finishes the stream.
        callback(null);
      },
      write: (
        buffer: Buffer,
        encoding: BufferEncoding,
        callback: (error: Error | null | undefined) => void
      ) => {
        // Performs some logging.
        this.httpClientSocket.trace(`Regular body writing ${buffer.length} bytes.`);

        // Writes the chunk.
        this.httpClientSocket.socket.write(buffer);

        // Waits for the socket to drain before writing the next chunk.
        if (this.httpClientSocket.socket.writableNeedDrain) {
          this.httpClientSocket.socket.once("drain", () => callback(null));
        } else callback(null);
      },
    });

    // Returns the current instance.
    return this;
  }

  /**
   * The method to call when you want to write the body.
   * @param buffer the buffer to write for the body.
   * @returns the current instance.
   */
  public writeBody(buffer: Buffer): this {
    // Checks if we're in the appropriate state.
    if (this._state !== HTTPResponseState.WritingResponseBody)
      throw new Error(`Cannot write body in state: ${this._state}`);

    // Makes sure the body writable is there.
    if (this._bodyWritable === null)
      throw new Error("Body writable must be defined!");

    // Writes the data to the body writable.
    this._bodyWritable.write(buffer);
    this._bodyWritable.end();

    // Returns the current instance.
    return this;
  }

  /**
   * Ends the body.
   * @returns the current instance.
   */
  public endBody(): this {
    // Makes sure we're in the correct state.
    if (this._state !== HTTPResponseState.WritingResponseBody)
      throw new Error(`Cannot finish body in state: ${this._state}`);

    // Performs some logging.
    this.httpClientSocket.trace(`endBody(): body has been written.`);

    // Changes the state to finished.
    this._state = HTTPResponseState.Finished;

    // Calls the callback to indicate the next request can be handled.
    this.finishedCallback();

    // Returns the instance.
    return this;
  }

  /**
   * Gets called after the final header has been written.
   * @returns the current instance.
   */
  public endHeaders(): this {
    // Makes sure we're in the correct state.
    if (this._state !== HTTPResponseState.WritingResponseHeaders)
      throw new Error(`Cannot finish headers in state: ${this._state}`);

    // Performs some logging.
    this.httpClientSocket.trace(`endHeaders(): headers have been written.`);

    // Writes the newline to indicate the end of the headers.
    const newlineStringBuffer: Buffer = Buffer.from("\r\n", "utf-8");
    this.httpClientSocket.socket.write(newlineStringBuffer);

    // Updates the state.
    this._state = HTTPResponseState.WritingResponseBody;

    // Returns the current instance.
    return this;
  }

  //////////////////////////////////////////////////
  // Static Methods
  //////////////////////////////////////////////////

  /**
   * Gets the content type from the given file extension.
   * @param extension the extension to get the content type for.
   * @returns the content type.
   */
  protected static _httpContentTypeFromFileExtension(
    extension: string
  ): HTTPContentType {
    switch (extension) {
      case ".html":
        return HTTPContentType.TextHTML;
      case ".txt":
        return HTTPContentType.TextPlain;
      case ".jpg":
        return HTTPContentType.ImageJPEG;
      default:
        return HTTPContentType.OctetStream;
    }
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
   * Writes the enqueued headers.
   */
  protected _writeEnqueuedHeaders(): void {
    // If no enqueued headers return.
    if (this._enqueuedHeaders === null) return;

    // Performs some logging.
    this.httpClientSocket.trace(`_writeEnqueuedHeaders(): writing ${this._enqueuedHeaders.length} enqueued headers. These headers are added before the response line was sent ...`);

    // If enqueued headers, write them.
    for (const [key, value] of this._enqueuedHeaders) this.header(key, value);

    // Clear the enqueued headers.
    this._enqueuedHeaders = null;
  }

  //////////////////////////////////////////////////
  // Instance Methods (Simple Responses)
  //////////////////////////////////////////////////

  /**
   * Writes an text response.
   * @param text the text to write.
   * @param status the status code.
   * @returns the current instance.
   */
  public text(text: string, status: number = 200): this {
    // Stringifies the object, and creates the buffer version.
    const textBuffer: Buffer = Buffer.from(text, "utf-8");

    // If the body type is not equal to chunking, use the regular body, and throw an error if it is none.
    if (this._responseBodyType !== HTTPResponseBodyType.Chunked) {
      if (this._responseBodyType === HTTPResponseBodyType.None)
        throw new Error(
          "Cannot send text response when body type is set to none."
        );

      // Performs logging.
      this.httpClientSocket.trace(
        `text(): body type not specified yet. Choosing regular, since size is known.`
      );

      // Uses the regular body, with the given length.
      this.useRegularBody(textBuffer.length);
    }

    // Performs the logging.
    this.httpClientSocket.trace(
      `text(): status code ${status}, size: ${textBuffer.length}`
    );

    // Writes the response.
    this.status(status) // Writes the status line.
      .defaultHeaders() // Writes the default headers.
      .header(HTTPHeaderType.ContentType, HTTPContentType.TextPlain) // Writes teh content type header.
      .endHeaders() // Ends the headers.
      .writeBody(textBuffer) // Writes the body.
      .endBody(); // Ends the body.

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

    // If the body type is not equal to chunking, use the regular body, and throw an error if it is none.
    if (this._responseBodyType !== HTTPResponseBodyType.Chunked) {
      if (this._responseBodyType === HTTPResponseBodyType.None)
        throw new Error(
          "Cannot send json response when body type is set to none."
        );

      // Performs logging.
      this.httpClientSocket.trace(
        `json(): body type not specified yet. Choosing regular, since size is known.`
      );

      // Uses the regular body, with the given length.
      this.useRegularBody(objectStringifiedBuffer.length);
    }

    // Performs the logging.
    this.httpClientSocket.trace(
      `json(): status code ${status}, size: ${objectStringifiedBuffer.length}`
    );

    // Writes the response.
    this.status(status) // writes the status line.
      .defaultHeaders() // Writes the default headers.
      .header(HTTPHeaderType.ContentType, HTTPContentType.ApplicationJson) // Writes the content type header.
      .endHeaders() // Ends the headers.
      .writeBody(objectStringifiedBuffer) // Writes the body.
      .endBody(); // Ends the body.

    // Returns the current instance.
    return this;
  }

  /**
   * Writes the given file as the HTTP response.
   * @param filePath the path of the file to write to the client.
   * @param status the status of the response.
   * @returns the current instance.
   */
  public file(filePath: string, status: number = 200): this {
    // Gets the file statistics, so we can send the content length before writing the file.
    fs.stat(
      filePath,
      (err: NodeJS.ErrnoException | null, stats: fs.Stats): any => {
        // If there is an error, send it.
        if (err !== null) return this.text(err.message, 500);

        // Gets file extension and then the content type.
        const fileExtension: string = path.extname(filePath);
        const httpContentType: HTTPContentType =
          HTTPResponse._httpContentTypeFromFileExtension(fileExtension);

        // If the body type is not equal to chunking, use the regular body, and throw an error if it is none.
        if (this._responseBodyType !== HTTPResponseBodyType.Chunked) {
          if (this._responseBodyType === HTTPResponseBodyType.None)
            throw new Error(
              "Cannot send json response when body type is set to none."
            );

          // Performs logging.
          this.httpClientSocket.trace(
            `file(): body type not specified yet. Choosing regular, since size is known.`
          );

          // Uses the regular body, with the given length.
          this.useRegularBody(stats.size);
        }

        // Performs the logging.
        this.httpClientSocket.trace(
          `file(): writing file '${filePath}', status code ${status}, size: ${stats.size}, type (MIME): ${httpContentType}`
        );

        // Writes the response to the client.
        this.status(status) // Writes the status.
          .defaultHeaders() // Adds the default headers.
          .header(HTTPHeaderType.ContentType, httpContentType) // Sets the content type.
          .endHeaders(); // Finishes the headers.

        // Creates the read stream.
        const readStream: fs.ReadStream = fs.createReadStream(filePath);
        readStream.pipe(this._bodyWritable!);
      }
    );

    return this;
  }
}
