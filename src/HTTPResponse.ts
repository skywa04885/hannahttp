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
import util from "util";
import path from "path";
import consolidate from "consolidate";
import { HTTPContentType } from "./HTTPContentType";
import { HTTPHeaderType } from "./HTTPHeaderType";
import { HTTPVersion } from "./HTTPVersion";
import { Readable, Transform, Writable } from "stream";
import { HTTPSession } from "./HTTPSession";
import {
  HTTPTransferEncoding,
  HTTPTransferEncodingHeader,
} from "./headers/HTTPTransferEncodingHeader";
import {
  HTTPContentEncoding,
  HTTPContentEncodingHeader,
} from "./headers/HTTPContentEncodingHeader";
import { HTTPRequest } from "./HTTPRequest";
import { HTTPContentRangeHeader } from "./headers/HTTPContentRangeHeader";
import {
  HTTPAcceptRange,
  HTTPAcceptRangesHeader,
} from "./headers/HTTPAcceptRangesHeader";
import { HTTPHeader } from "./headers/HTTPHeader";
import { HTTPRangeHeader } from "./headers/HTTPRangeHeader";

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

export enum HTTPResponseCookieSameSite {
  Strict = "Strict",
  Lax = "Lax",
  None = "None",
}

export interface IHTTPResponseCookieOptions {
  expires?: Date;
  secure?: boolean;
  httpOnly?: boolean;
  domain?: string;
  path?: string;
  sameSite?: HTTPResponseCookieSameSite;
}

export class HTTPResponse {
  protected _excludeBody: boolean = false;
  protected _state: HTTPResponseState = HTTPResponseState.WritingResponseLine;
  protected _bodyWritable: Writable | null = null;
  protected _originalBodyWritable: Writable | null = null;

  protected _bodySize: number | null = null;
  protected _enqueuedHeaders: [string, string][] | null = null;
  protected _bodyTransforms: Transform[] | null = null

  protected _transferEncoding: HTTPTransferEncodingHeader | null = null;
  protected _contentEncoding: HTTPContentEncodingHeader | null = null;

  protected _sentStatus: number | null = null;

  public constructor(
    public readonly request: HTTPRequest,
    public readonly session: HTTPSession,
  ) {}

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
    if (this._sentStatus === null) throw new Error("this._sentStatus is null!");

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
  public addTransferEncoding(encoding: HTTPTransferEncoding): this {
    // Creates the encoding header if not there.
    this._transferEncoding =
      this._transferEncoding ?? new HTTPTransferEncodingHeader();

    // Pushes the encoding.t
    this._transferEncoding.push(encoding);

    // Returns the current instance.
    return this;
  }

  /**
   * Adds a content encoding.
   * @param encoding the content encoding to add.
   * @returns the current instance.
   */
  public addContentEncoding(encoding: HTTPContentEncoding): this {
    // Creates the encoding header if not there.
    this._contentEncoding =
      this._contentEncoding ?? new HTTPContentEncodingHeader();

    // Pushes the encoding.t
    this._contentEncoding.push(encoding);

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
  public async status(
    code: number,
    message: string | null = null
  ): Promise<void> {
    // Makes sure we're in the proper state.
    if (this._state !== HTTPResponseState.WritingResponseLine)
      throw new Error("Response status has already been sent!");

    // Sets the internal status.
    this._sentStatus = code;

    // If the message has not been given, get one of the default ones.
    if (message === null) message = HTTPResponse._getMessageForStatusCode(code);

    // Constructs and writes the response line.
    const responseLineString: string = `${this.request.version} ${code} ${message}\r\n`;
    const responseLineBuffer: Buffer = Buffer.from(responseLineString, "utf-8");
    await this.session.client.write(responseLineBuffer);

    // Updates the state (since we've written the response line).
    this._state = HTTPResponseState.WritingResponseHeaders;

    // Writes the enqueued headers.
    await this._writeEnqueuedHeaders();
  }

  /**
   * Writes all the default headers.
   * @returns a promise that resolves once written.
   */
  protected async _defaultHeaders(): Promise<void> {
    // Sends the truely default headers.
    await this.header(HTTPHeaderType.Date, new Date().toUTCString());
    await this.header(HTTPHeaderType.Server, "HannaHTTP");
    await this.header(HTTPHeaderType.Connection, "keep-alive");

    // If content encoding there, write it.
    if (this._contentEncoding !== null) {
      await this.header(
        HTTPHeaderType.ContentEncoding,
        this._contentEncoding.encode()
      );
    }

    // If transfer encoding there, write it.
    if (this._transferEncoding !== null) {
      await this.header(
        HTTPHeaderType.TransferEncoding,
        this._transferEncoding.encode()
      );
    }
  }

  /**
   * Excludes the body from the current request (usually for HEAD).
   * @returns the current instance.
   */
  public excludeBody(): this {
    // Updates the values.
    this._excludeBody = true;

    // Performs some logging.
    this.session.shouldTrace(() =>
      this.session.trace(
        "excludeBody(): Excluding body, most likely HEAD request being performed ..."
      )
    );

    // Returns the current instance.
    return this;
  }

  /**
   * Adds a single header to the response.
   * @param key the key of the header.
   * @param value the value of the header.
   * @returns a promise that resolves once written.
   */
  public async header(key: string, value: string): Promise<void> {
    // If we're in the response line state (maybe during middleware) enqueue the headers.
    if (this._state === HTTPResponseState.WritingResponseLine) {
      if (this._enqueuedHeaders === null) this._enqueuedHeaders = [];
      this._enqueuedHeaders.push([key, value]);
      return;
    }

    // Makes sure we're in the correct state.
    if (this._state !== HTTPResponseState.WritingResponseHeaders)
      throw new Error(`Cannot write header in state: ${this._state}`);

    // Constructs the header and writes it to the client.
    const headerString: string = `${key}: ${value}\r\n`;
    const headerStringBuffer: Buffer = Buffer.from(headerString, "utf-8");
    await this.session.client.write(headerStringBuffer);
  }

  /**
   * Sets a cookie.
   * @param name the name of the cookie.
   * @param value the value of the cookie.
   * @param options the options for the cookie.
   * @returns a promise that resolves once written.
   */
  public async cookie(
    name: string,
    value: string,
    options?: IHTTPResponseCookieOptions
  ): Promise<void> {
    // Initializes the map with the key/ value pair.
    let obj: { [key: string]: string | null } = {
      [name]: encodeURIComponent(value),
    };

    // Adds all the options to the map.
    if (options?.domain) obj["Domain"] = options.domain;
    if (options?.path) obj["Path"] = options.path;
    if (options?.expires) obj["Expires"] = options.expires.toUTCString();
    if (options?.httpOnly) obj["HttpOnly"] = null;
    if (options?.secure) obj["Secure"] = null;
    if (options?.sameSite) obj["SameSite"] = options.sameSite as string;

    // Constructs the header value.
    const headerValue: string = Object.entries(obj)
      .map(([key, value]: [string, string | null]): string => {
        if (value === null) return key;
        else return `${key}=${value}`;
      })
      .join("; ");

    // Writes the header.
    await this.header(HTTPHeaderType.SetCookie, headerValue);
  }

  /**
   * The method to call when you want to write the body.
   * @param buffer the buffer to write for the body.
   * @returns the current instance.
   */
  public async writeBody(buffer: Buffer): Promise<void> {
    // Checks if we're in the appropriate state.
    if (this._state !== HTTPResponseState.WritingResponseBody)
      throw new Error(`Cannot write body in state: ${this._state}`);

    // Makes sure the body writable is there.
    if (this._bodyWritable === null)
      throw new Error("Body writable must be defined!");

    // Writes the data to the body writable.
    this._bodyWritable.write(buffer);
    this._bodyWritable.end();
  }

  /**
   * Ends the current response body.
   * @returns a promise that resolves once written to the client.
   */
  public async _endBody(): Promise<void> {
    // Makes sure we're in the correct state.
    if (this._state !== HTTPResponseState.WritingResponseBody)
      throw new Error(`Cannot finish body in state: ${this._state}`);

    // Performs some logging.
    this.session.shouldTrace(() =>
      this.session.trace(`_endBody(): body has been written.`)
    );

    // Changes the state to finished.
    this._state = HTTPResponseState.Finished;
  }

  /**
   * Gets called when the response is about to get finished, or we'll start transmitting the body.
   *  basically after the final header has been written.
   * @returns a promise that resolves once written to the client.
   */
  protected async _endHeaders(): Promise<void> {
    // Makes sure we're in the correct state.
    if (this._state !== HTTPResponseState.WritingResponseHeaders)
      throw new Error(`Cannot finish headers in state: ${this._state}`);

    // Performs some logging.
    this.session.shouldTrace(() =>
      this.session.trace(`_endHeaders(): headers have been written.`)
    );

    // Writes the newline to indicate the end of the headers.
    const newlineStringBuffer: Buffer = Buffer.from("\r\n", "utf-8");
    await this.session.client.write(newlineStringBuffer);

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
   * Starts the writing of a complex body, here we'll prepare the streams.
   * @returns a promise that resolves once completed.
   */
  protected async _startBody(): Promise<void> {
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
      this.addTransferEncoding(HTTPTransferEncoding.Chunked);
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
      await this.header(
        HTTPHeaderType.ContentLength,
        this._bodySize.toString()
      );
    }

    // Writes the default headers.
    await this._defaultHeaders();

    // Ends the headers before we start the body.
    await this._endHeaders();

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

          // Ends the body.
          this._endBody();

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
    } else {
      // Creates the transform stream.
      this._bodyWritable = new Transform({
        final: (callback: (error: Error | null | undefined) => void) => {
          // Ends the body.
          this._endBody();

          // Finishes the stream.
          callback(null);
        },
        transform: (
          buffer: Buffer,
          encoding: BufferEncoding,
          callback: (error: Error | null | undefined, data: any) => void
        ) => {
          // Calls the callback with the new data.
          callback(null, buffer);
        },
      });

      // Pipes the transform stream to the socket (ignore end).
      this._bodyWritable.pipe(this.session.client.socket, {
        end: false,
      });
    }

    // Sets the original body writable (needs to be accessed for async ops).
    this._originalBodyWritable = this._bodyWritable;

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
   * @returns a promise that resolves once the entire buffer has been written to the client.
   */
  public sendBufferedBody(buffer: Buffer): Promise<void> {
    // Checks if we're allowed to do this.
    if (this._state !== HTTPResponseState.WritingResponseHeaders)
      throw new Error(`Not allowed to write buffered body in state: ${this._state}`);

    // Returns the promise.
    return new Promise<void>(async (resolve, reject): Promise<void> => {
      // Sets the known size, since the size of the buffer is known.
      this.bodySize = buffer.length;

      // Starts the body writing.
      await this._startBody();

      // Creates a readable from the buffer.
      const bufferReadable: Readable = Readable.from(buffer);

      // Adds the event listeners on the body writable stream.
      this._originalBodyWritable!.on("close", resolve);
      this._originalBodyWritable!.on("error", reject);

      // Pipes the readable stream to the bodyw ritable.
      bufferReadable.pipe(this._bodyWritable!);
    });
  }

  /**
   * Writes an empty body to the client, for example in "HEAD" requests.
   * @returns resolves once the response has been written.
   */
  public async sendEmptyBody(): Promise<void> {
    await this._defaultHeaders();
    await this._endHeaders();
    await this._endBody();
  }

  /**
   * Sends a streamed body.
   * @param readable the readable to pipe to the body writable.
   * @returns a promise that resolves when the stream closes.
   */
  public sendStreamedBody(readable: Readable): Promise<void> {
    // Checks if we're allowed to do this.
    if (this._state !== HTTPResponseState.WritingResponseHeaders)
      throw new Error(`Not allowed to write streamed body in state: ${this._state}`);

    // Returns the promise.
    return new Promise(async (resolve, reject): Promise<void> => {
      // Starts the body writing.
      await this._startBody();

      // Listens for the closing
      this._originalBodyWritable!.on('error', reject);
      this._originalBodyWritable!.on('close', resolve);

      // Pipes the readable to the body writable.
      readable.pipe(this._bodyWritable!);
    });
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
    // TODO: Add any new file extensions for content type here.
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
      case ".mp4":
        return HTTPContentType.VideoMP4;
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
  protected async _writeEnqueuedHeaders(): Promise<void> {
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

    // Loops over all the enqueued headers and writes them.
    for (const [key, value] of this._enqueuedHeaders)
      await this.header(key, value);

    // Clear the enqueued headers.
    this._enqueuedHeaders = null;
  }

  //////////////////////////////////////////////////
  // Instance Methods (Simple Responses)
  //////////////////////////////////////////////////

  /**
   * Writes a buffered response.
   * @param buffer the buffer to write.
   * @param status the status code to write.
   * @param contentType the type of content (for "Content-Type" header).
   */
  public async buffer(
    buffer: Buffer,
    status: number = 200,
    contentType: HTTPContentType = HTTPContentType.TextPlain
  ): Promise<void> {
    // Performs some logging.
    this.session.shouldTrace(() =>
      this.session.trace(
        `buffer(): status code ${status}, size: ${buffer.length}, contentType: '${contentType}'`
      )
    );

    // Sets the content type header.
    await this.header(HTTPHeaderType.ContentType, contentType);

    // Sends the status line, and then the buffered response.
    await this.status(status);
    await this.sendBufferedBody(buffer);
  }

  /**
   * Writes an text response.
   * @param text the text to write.
   * @param status the status code.
   * @returns a promise that resolves when the text has been written.
   */
  public async text(text: string, status: number = 200): Promise<void> {
    // Stringifies the object, and creates the buffer version.
    const buffer: Buffer = Buffer.from(text, "utf-8");

    // Writes the buffer to the client.
    await this.buffer(buffer, status, HTTPContentType.TextPlain);
  }

  /**
   * Writes an html response.
   * @param text the html to write.
   * @param status the status code.
   * @returns A promise that resolves once the HTML is written.
   */
  public async html(text: string, status: number = 200): Promise<void> {
    // Stringifies the object, and creates the buffer version.
    const buffer: Buffer = Buffer.from(text, "utf-8");

    // Writes the buffer to the client.
    await this.buffer(buffer, status, HTTPContentType.TextHTML);
  }

  /**
   * Sends the given object as json.
   * @param object the object to turn into json and send.
   * @returns a promise that resolves once the json is written.
   */
  public async json(object: any, status: number = 200): Promise<void> {
    // Stringifies the object, and creates the buffer version.
    const stringified: string = JSON.stringify(object);
    const buffer: Buffer = Buffer.from(stringified, "utf-8");

    // Writes the buffer to the client.
    await this.buffer(buffer, status, HTTPContentType.ApplicationJson);
  }

  /**
   * Renders a template as result.
   * @param template the template to render.
   * @param data the data for the template.
   * @param status the status code to send.
   * @returns a promise that resolves once written to client.
   */
  public async render(
    template: string,
    data: any,
    status: number = 200
  ): Promise<void> {
    // Gets the view engine and view directory.
    const engine: string | null =
      this.session.server.settings.templating?.engine ?? null;
    const views: string | null =
      this.session.server.settings.templating?.views ?? null;

    // Makes sure there is a templating engine set.
    if (engine === null)
      throw new Error("Templating engine must be specified in the settings!");

    // @ts-ignore
    const templatingFunction = consolidate[engine] ?? null;

    // Makes sure the engine exists, if not, throw an error.
    if (templatingFunction === null)
      throw new Error(`Unknown templating engine: ${engine}`);

    // Gets the path of the template to render. If we're given an
    //  absolute path, use it, otherwise we'll use a path relative
    //  to the one specified in the settings.
    if (path.isAbsolute(template) === false) {
      if (views === null)
        throw new Error(
          "Cannot use relative template path when views not specified in settings."
        );

      template = path.join(views, template);
    }

    // Turns the template function into a promise, and renders the template.
    const renderedTemplate: string = await util.promisify(templatingFunction)(
      template,
      data
    );

    // Writes the HTML response to the client.
    await this.html(renderedTemplate, status);
  }

  /**
   * Writes the given file as the HTTP response.
   * @param filePath the path of the file to write to the client.
   * @param status the status of the response.
   * @returns the current instance.
   */
  public async file(filePath: string, status: number = 200): Promise<void> {
    // Gets the range header from the request (for partial file contents);
    const range: HTTPRangeHeader | null =
      this.request.headers!.getSingleTypedHeader(
        HTTPHeaderType.Range
      ) as HTTPRangeHeader | null;

    // Gets the file stats, we'll use this to check if the file exists, and get the size of the file.
    const stats: fs.Stats = await util.promisify(fs.stat)(filePath);

    // Gets file extension and then the content type.
    const fileExtension: string = path.extname(filePath);
    const httpContentType: HTTPContentType =
      HTTPResponse._httpContentTypeFromFileExtension(fileExtension);

    // Sets the body size, then the response can later determine to use
    //  chunking or not.
    this.bodySize = stats.size;

    // Writes the status and the content type header.
    await this.status(status);
    await this.header(
      HTTPHeaderType.AcceptRanges,
      new HTTPAcceptRangesHeader([HTTPAcceptRange.Bytes]).encode()
    );
    await this.header(HTTPHeaderType.ContentType, httpContentType);

    // Checks if we should write the body, if not, don't.
    if (this._excludeBody) {
      // performs some logging.
      this.session.shouldTrace(() =>
        this.session.trace(
          `file(): excluding body, only writing headers ... Probably dealing with HEAD method.`
        )
      );

      // Finishes the request.
      await this.sendEmptyBody();

      // Ignores the writing of the body.
      return;
    }

    // Performs the logging.
    this.session.shouldTrace(() =>
      this.session.trace(
        `file(): writing file '${filePath}', status code ${status}, size: ${stats.size}, type (MIME): ${httpContentType}`
      )
    );

    // Creates the read stream for the file, and writes it as the response body.
    const readStream: fs.ReadStream = fs.createReadStream(filePath);
    await this.sendStreamedBody(readStream);
  }
}
