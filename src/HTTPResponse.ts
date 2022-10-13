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

import fs from "fs";
import path from "path";
import { HTTPContentType } from "./HTTPContentType";
import { HTTPHeaderType } from "./HTTPHeaderType";
import { HTTPVersion } from "./HTTPVersion";
import { Readable, Transform, Writable } from "stream";
import { HTTPSession } from "./HTTPSession";
import { HTTPEncodingHeader } from "./HTTPEncodingHeader";
import { HTTPEncoding } from "./HTTPEncoding";

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
  protected _state: HTTPResponseState = HTTPResponseState.WritingResponseLine;
  protected _bodyWritable: Writable | null = null;

  protected _bodySize: number | null = null;
  protected _enqueuedHeaders: [string, string][] | null = null;
  protected _bodyTransforms: Transform[] | null = null;

  protected _transferEncoding: HTTPEncodingHeader | null = null;
  protected _contentEncoding: HTTPEncodingHeader | null = null;

  protected _sentStatus: number | null = null;

  public constructor(
    public readonly version: HTTPVersion,
    public readonly session: HTTPSession,
    public readonly finishedCallback: () => void
  ) {}

  /**
   * Resets the response (for multiple request on a single socket).
   * @returns the current instance.
   */
  public reset(): this {
    // Makes sure the response has been finished.
    if (this._state !== HTTPResponseState.Finished)
      throw new Error("Cannot reset non-finished response!");

    this._state = HTTPResponseState.WritingResponseLine;
    this._bodyWritable = null;

    this._bodySize = null;
    this._enqueuedHeaders = null;
    this._bodyTransforms = null;

    this._contentEncoding = null;
    this._transferEncoding = null;

    this._sentStatus = null;

    // Returns the current instance.
    return this;
  }

  //////////////////////////////////////////////////
  // Getters
  //////////////////////////////////////////////////

  /**
   * If the current response has enqueued headers.
   */
  public get hasEnqueuedHeaders(): boolean {
    return this._enqueuedHeaders !== null;
  }

  /**
   * If the current response has body transforms.
   */
  public get hasBodyTransforms(): boolean {
    return this._bodyTransforms !== null;
  }

  /**
   * Gets the sent status code.
   */
  public get sentStatus(): number {
    if (this._sentStatus === null)
      throw new Error('this._sentStatus is null!');

    return this._sentStatus;
  }

  //////////////////////////////////////////////////
  // Setters
  //////////////////////////////////////////////////

  /**
   * Sets the body size. This will be used to determine
   *  how we'll handle the response.
   */
  public set bodySize(bodySize: number) {
    this._bodySize = bodySize;
  }

  //////////////////////////////////////////////////
  // Instance Methods
  //////////////////////////////////////////////////

  /**
   * Adds a new transfer encoding.
   * @param encoding the encoding to add.
   * @returns the current instance.
   */
  public addTransferEncoding(encoding: HTTPEncoding): this {
    // Creates the encoding header if not there.
    this._transferEncoding = this._transferEncoding ?? new HTTPEncodingHeader([]);

    // Pushes the encoding.t
    this._transferEncoding.encodings.push(encoding);

    // Returns the current instance.
    return this;
  }

  /**
   * Adds a content encoding.
   * @param encoding the content encoding to add.
   * @returns the current instance.
   */
  public addContentEncoding(encoding: HTTPEncoding): this {
    // Creates the encoding header if not there.
    this._contentEncoding = this._contentEncoding ?? new HTTPEncodingHeader([]);

    // Pushes the encoding.t
    this._contentEncoding.encodings.push(encoding);

    // Returns the current instance.
    return this;
  }

  /**
   * Adds a transform stream.
   * @param transform the transform stream.
   * @returns the current instance.
   */
  public addBodyTransform(transform: Transform): this {
    if (
      ![
        HTTPResponseState.WritingResponseLine,
        HTTPResponseState.WritingResponseHeaders,
      ].includes(this._state)
    )
      throw new Error(
        `addBodyTransform(): not allowed in state ${this._state}`
      );

    // Initializes the body transforms.
    if (this._bodyTransforms === null) this._bodyTransforms = [];

    // Pushes the transform
    this._bodyTransforms.push(transform);

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

    // Sets the internal status.
    this._sentStatus = code;

    // If the message has not been given, get one of the default ones.
    if (message === null) message = HTTPResponse._getMessageForStatusCode(code);

    // Constructs the response line, then gets the buffer version..
    const responseLineString: string = `${this.version} ${code} ${message}\r\n`;
    const responseLineBuffer: Buffer = Buffer.from(responseLineString, "utf-8");

    // Writes the data to the http socket.
    this.session.client.socket.write(responseLineBuffer);

    // Updates the state (since we've written the response line).
    this._state = HTTPResponseState.WritingResponseHeaders;

    // Writes the enqueued headers.
    this._writeEnqueuedHeaders();

    // Returns the current instance.
    return this;
  }

  /**
   * Writes all the default headers.
   */
  protected _defaultHeaders(): void {
    // Sends the truely default headers.
    this.header(HTTPHeaderType.Date, new Date().toUTCString())
      .header(HTTPHeaderType.Server, "HannaHTTP")
      .header(HTTPHeaderType.Connection, "keep-alive");

    // Adds all the encoding headers.
    if (this._contentEncoding !== null)
      this.header(HTTPHeaderType.ContentEncoding, this._contentEncoding.encode());
    if (this._transferEncoding !== null)
      this.header(HTTPHeaderType.TransferEncoding, this._transferEncoding.encode());
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
    this.session.client.socket.write(headerStringBuffer);

    // Returns the instance.
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
    this.session.shouldTrace(() =>
      this.session.trace(`endBody(): body has been written.`)
    );

    // Changes the state to finished.
    this._state = HTTPResponseState.Finished;

    // Calls the callback to indicate the next request can be handled.
    this.finishedCallback();

    // Returns the instance.
    return this;
  }

  /**
   * Gets called when the response is about to get finished, or we'll start transmitting the body.
   *  basically after the final header has been written.
   */
  protected _endHeaders(): void {
    // Makes sure we're in the correct state.
    if (this._state !== HTTPResponseState.WritingResponseHeaders)
      throw new Error(`Cannot finish headers in state: ${this._state}`);

    // Performs some logging.
    this.session.shouldTrace(() =>
      this.session.trace(`_endHeaders(): headers have been written.`)
    );

    // Writes the newline to indicate the end of the headers.
    const newlineStringBuffer: Buffer = Buffer.from("\r\n", "utf-8");
    this.session.client.socket.write(newlineStringBuffer);

    // Updates the state.
    this._state = HTTPResponseState.WritingResponseBody;
  }

  /**
   * Checks how we will process the respond. This will depend uppon the previously
   *  given data. If the response length we will send is known, and there will be
   *  no transformation, then we'll decide to use a fixed-length body, otherwise
   *  we'll use the chunking body.
   * @returns if we should use chunking or not.
   */
  protected _shouldUseChunking(): boolean {
    // If the body size is null, just use chuking.
    if (this._bodySize === null) return true;

    // If the body size is known, but there are transform streams
    //  enqueued then we'll go for chunking.
    if (this.hasBodyTransforms) return true;

    // Since no data will be transformed, and the size is known
    //  use regular body.
    return false;
  }

  /**
   * Starts writing the body.
   */
  protected _startBody() {
    // Performs some logging.
    this.session.shouldTrace(() =>
      this.session.trace(
        `_startBody(): determining 'Transfer-Encoding' and preparing data streams.`
      )
    );

    // Checks if we should use chunking.
    const shouldUseChunking: boolean = this._shouldUseChunking();

    // Writes the final headers depending on if we're going to use chunking or not.
    ////

    // If we're going to use chunking, modify these headers.
    //  else set the content length header.
    if (shouldUseChunking === true) {
      // Performs some logging.
      this.session.shouldTrace(() =>
        this.session.trace(
          `_startBody(): writing chunked response, due to absence of size or presence of transform streams.`
        )
      );

      // Adds the content transfer chunked encoding.
      this.addTransferEncoding(HTTPEncoding.Chunked);
    } else {
      // Makes sure the body size is there.
      if (this._bodySize === null)
        throw new Error(
          "this._bodySize is null, cannot add content length header."
        );

      // Performs some logging.
      this.session.shouldTrace(() =>
        this.session.trace(
          `_startBody(): writing regular response with known size of ${this._bodySize}.`
        )
      );

      // Sets the header.
      this.header(HTTPHeaderType.ContentLength, this._bodySize.toString());
    }

    // Writes the default headers.
    this._defaultHeaders();

    // Ends the headers before we start the body.
    this._endHeaders();

    // Prepares the streams.
    ////

    // If we're going to use chunking put a final transform stream between the socket and the body
    //  that's about to be written to encode it as chunks. Else just set the socket as the writable.
    if (shouldUseChunking) {
      // Creates the transform stream.
      this._bodyWritable = new Transform({
        final: (callback: (error: Error | null | undefined) => void) => {
          // Performs some logging.
          this.session.shouldTrace(() =>
            this.session.trace(
              `Chunked body has finished writing, sending final zero chunk.`
            )
          );

          // Writes the final zero chunk.
          this.session.client.socket.write(Buffer.from("0\r\n\r\n", "utf-8"));

          // Calls the finished callback.
          this.finishedCallback();

          // Finishes the stream.
          callback(null);
        },
        transform: (
          buffer: Buffer,
          encoding: BufferEncoding,
          callback: (error: Error | null | undefined, data: any) => void
        ) => {
          // Performs some logging.
          this.session.shouldTrace(() =>
            this.session.trace(
              `Chunked body writing chunk of size ${buffer.length}.`
            )
          );

          // Creates the line that contains the length and the chunk.
          const lengthLineBuffer: Buffer = Buffer.from(
            `${buffer.length.toString(16)}\r\n`,
            "utf-8"
          );

          // Calls the callback with the new data.
          callback(
            null,
            Buffer.concat([
              lengthLineBuffer,
              buffer,
              Buffer.from("\r\n", "utf-8"),
            ])
          );
        },
      });

      // Pipes the transform stream to the socket (ignore end).
      this._bodyWritable.pipe(this.session.client.socket, {
        end: false,
      });
    } else this._bodyWritable = this.session.client.socket;

    // Checks if we're dealing with body transforms.
    if (this.hasBodyTransforms) {
      // Pipes all the body transforms to another. Each newer added one
      //  will pass through the previously added stream.
      for (let i: number = this._bodyTransforms!.length - 1; i > 0; i--) {
        const pipeTo: Transform = this._bodyTransforms![i - 1];
        const pipeFrom: Transform = this._bodyTransforms![i];
        pipeFrom.pipe(pipeTo);
      }

      // Pipes the oldest stream stream to the current body writable.
      this._bodyTransforms![0].pipe(this._bodyWritable);

      // makes the newest stream the input writable.
      this._bodyWritable =
        this._bodyTransforms![this._bodyTransforms!.length - 1];
    }

    // Finishes off.
    ////

    // Changes the state.
    this._state = HTTPResponseState.WritingResponseBody;
  }

  /**
   * Writes a buffer as response body.
   * @param buffer the buffer to write as response.
   * @returns the current instance.
   */
  public sendBufferedBody(buffer: Buffer): this {
    // Sets the known size, since the size of the buffer is known.
    this.bodySize = buffer.length;

    // Starts the body writing.
    this._startBody();

    // Creates a readable from the buffer, and pipes it to the body writable.
    Readable.from(buffer).pipe(this._bodyWritable!);

    // Returns the current instance.
    return this;
  }

  /**
   * Sends a streamed body.
   * @param readable the readable to pipe to the body writable.
   * @returns the current instance.
   */
  public sendStreamedBody(readable: Readable): this {
    // Starts the body writing.
    this._startBody();

    // Pipes the readable to the body writable.
    readable.pipe(this._bodyWritable!);

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
      case ".css":
        return HTTPContentType.TextCSS;
      case ".js":
        return HTTPContentType.TextJavascript;
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
    this.session.shouldTrace(() =>
      this.session.trace(
        `_writeEnqueuedHeaders(): writing ${
          this._enqueuedHeaders!.length
        } enqueued headers. These headers are added before the response line was sent ...`
      )
    );

    // If enqueued headers, write them.
    for (const [key, value] of this._enqueuedHeaders) this.header(key, value);

    // Clear the enqueued headers.
    this._enqueuedHeaders = null;
  }

  //////////////////////////////////////////////////
  // Instance Methods (Simple Responses)
  //////////////////////////////////////////////////

  public buffer(buffer: Buffer, status: number = 200, contentType: HTTPContentType = HTTPContentType.TextPlain): this {
    // Performs some logging.
    this.session.shouldTrace(() =>
      this.session.trace(
        `buffer(): status code ${status}, size: ${buffer.length}, contentType: '${contentType}'`
      )
    );

    // Sets the content type header.
    this.header(HTTPHeaderType.ContentType, contentType);

    // Sends the response.
    this
      .status(status)
      .sendBufferedBody(buffer);

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
    const buffer: Buffer = Buffer.from(text, "utf-8");

    // Writes the buffer to the client.
    return this.buffer(buffer, status, HTTPContentType.TextPlain);
  }

  /**
   * Writes an html response.
   * @param text the html to write.
   * @param status the status code.
   * @returns the current instance.
   */
  public html(text: string, status: number = 200): this {
    // Stringifies the object, and creates the buffer version.
    const buffer: Buffer = Buffer.from(text, "utf-8");

    // Writes the buffer to the client.
    return this.buffer(buffer, status, HTTPContentType.TextHTML);
  }

  /**
   * Sends the given object as json.
   * @param object the object to turn into json and send.
   * @returns the current instance.
   */
  public json(object: any, status: number = 200): this {
    // Stringifies the object, and creates the buffer version.
    const stringified: string = JSON.stringify(object);
    const buffer: Buffer = Buffer.from(
      stringified,
      "utf-8"
    );

    // Writes the buffer to the client.
    return this.buffer(buffer, status, HTTPContentType.ApplicationJson);
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

        // Performs the logging.
        this.session.shouldTrace(() =>
          this.session.trace(
            `file(): writing file '${filePath}', status code ${status}, size: ${stats.size}, type (MIME): ${httpContentType}`
          )
        );
        // Creates the read stream.
        const readStream: fs.ReadStream = fs.createReadStream(filePath);

        // Writes the response to the client.
        this.status(status) // Writes the status.
          .header(HTTPHeaderType.ContentType, httpContentType) // Sets the content type.
          .sendStreamedBody(readStream); // Sends the response body.
      }
    );

    return this;
  }
}
