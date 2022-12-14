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

import { EventEmitter } from "stream";
import {
  HTTPError,
  HTTPSyntaxError,
  HTTPSyntaxErrorSource,
  HTTPVersionNotSupportedError,
} from "../error";
import { HTTPHeaders } from "./headers";
import { HTTPMethod, isValidHttpMethod } from "./method";
import { HTTPSession } from "../session";
import { HTTPURI } from "./uri";
import { HTTPVersion, isValidHttpVersion } from "./version";

export enum HTTPRequestState {
  REQUEST, // Awaiting request line.
  HEADERS, // Awaiting request headers.
  FINISHED, // Finished loading request.
  BODY, // Awaiting body.
}

export class HTTPRequestBody {
  /**
   *
   * @param chunk the chunk to update the request body with.
   * @returns the number of bytes that have been consumed.
   */
  public update(chunk: Buffer): number {
    return 0;
  }

  /**
   * If the current body is saturated (meaing if there shouldn't be read anything more).
   */
  public get saturated() {
    return true;
  }
}

export class HTTPRequestBufferBody extends HTTPRequestBody {
  public buffer: Buffer;
  public bufferLevel: number;

  /**
   * Constructs a new http request buffer body.
   * @param expectedSize the total body size (from content-length header).
   */
  public constructor(public readonly expectedSize: number) {
    super();

    this.buffer = Buffer.alloc(expectedSize);
    this.bufferLevel = 0;
  }

  /**
   * Updates the request body.
   * @param chunk the chunk to update the request body with.
   * @returns the number of bytes that have been consumed.
   */
  public update(chunk: Buffer): number {
    // Calculates the number of bytes to be read.
    const neededBytes: number = this.expectedSize - this.bufferLevel;

    // Calculates the number of bytes we can and must consume.
    const consumableBytes: number = Math.min(chunk.length, neededBytes);

    // Consumes the bytes.
    chunk.copy(this.buffer, this.bufferLevel, 0, consumableBytes);
    this.bufferLevel += consumableBytes;

    // Returns the number of bytes consumed.
    return consumableBytes;
  }

  /**
   * Checks if the request body has been saturated.
   */
  public get saturated(): boolean {
    return this.bufferLevel === this.expectedSize;
  }
}

// Since the headers are not read at the time of the initial request parsing,
//  the parsing of the body can be done later by assigning the body variable.
//  which will start processing the entire buffer, and incomming request data.

export enum HTTPRequestEvent {
  LineLoaded = "LineLoaded",
  HeadersLoaded = "HeadersLoaded",
  Finished = "Finished",
  BodyLoaded = "BodyLoaded",
}

export class HTTPRequest extends EventEmitter {
  protected _state: HTTPRequestState;
  protected _buffer?: Buffer;
  public method: HTTPMethod = HTTPMethod.GET;
  public version: HTTPVersion = HTTPVersion.V1_1;
  public uri?: HTTPURI;
  public rawUri?: string;
  public headers: HTTPHeaders = new HTTPHeaders();
  public body?: HTTPRequestBody;
  public u: { [key: string]: any };

  /**
   * Constructs a new HTTP request.
   * @param session the session of which the request belongs to.
   */
  public constructor(public readonly session: HTTPSession) {
    super();

    // Initializes some variables.
    this._state = HTTPRequestState.REQUEST;
    this.u = {};
  }

  /**
   * Begins processing the next request inside of the received buffer.
   */
  public next() {
    // Updates the state.
    this._state = HTTPRequestState.REQUEST;
    this.method = HTTPMethod.GET;
    this.uri = undefined;
    this.rawUri = undefined;
    this.version = HTTPVersion.V1_1;
    this.headers = new HTTPHeaders();
    this.body = undefined;
    this.u = {};

    // Calls the update event because we want to process old chunks.
    this.update();
  }

  /**
   * Parses the given headerString into an key/ value pair.
   * @param headerString the raw header string.
   * @returns the parsed key/ value pair.
   */
  protected static _parseHttpHeader(headerString: string): [string, string] {
    // Finds the separator index inside the raw header string, if it is not there throw an error.
    const separatorIndex: number = headerString.indexOf(":");
    if (separatorIndex === -1) {
      throw new HTTPSyntaxError(
        HTTPSyntaxErrorSource.RequestHeadersParser,
        "Invalid HTTP header: missing ':'!"
      );
    }

    // Gets the key and the value string.
    const keyString: string = headerString.substring(0, separatorIndex).trim();
    const valueString: string = headerString
      .substring(separatorIndex + 1)
      .trim();

    // Validates the key and the value (makes sure they're not empty.
    if (keyString.length === 0 || valueString.length === 0) {
      throw new HTTPSyntaxError(
        HTTPSyntaxErrorSource.RequestHeadersParser,
        "Invalid HTTP header: invalid key/ value!"
      );
    }

    // Returns the results.
    return [keyString, valueString];
  }

  /**
   * Reads a single line from the internal buffer.
   * @returns the line read from the internal buffer.
   */
  protected readLine(): Buffer | undefined {
    const separator = "\r\n";

    // If there is no buffer, return.
    if (!this._buffer) return undefined;

    // If there is no newline yet, return.
    const separatorIndex: number = this._buffer.indexOf(separator, 0, "utf-8");
    if (separatorIndex === -1) return undefined;

    // Gets the newline from the buffer.
    const line: Buffer = Buffer.alloc(separatorIndex);
    this._buffer.copy(line, 0, 0, separatorIndex);

    // Checks if there should be anything remaining in the buffer, if not null it.
    if (separatorIndex + separator.length === this._buffer.length)
      this._buffer = undefined;
    else {
      // Copies the remainder of the internal buffer.
      const buffer: Buffer = Buffer.alloc(
        this._buffer.length - separatorIndex - separator.length
      );
      this._buffer.copy(buffer, 0, separatorIndex + separator.length);

      // Overrides the internal buffer.
      this._buffer = buffer;
    }

    // returns the found line.
    return line;
  }

  /**
   * Parses the request header if there.
   * @returns true if the outer loop should break.
   */
  protected updateRequest(): boolean {
    // Reads a single line from the internal buffer.
    const line: Buffer | undefined = this.readLine();

    // If there is no line yet, return true to break and wait for next update.
    if (!line) return true;

    // Gets the string version of the line, so we can then parse it.
    const lineString: string = line.toString("utf-8");

    // Splits the lineString on spaces, so we can then parse the: method, uri and version.
    //  if there are less or more than three segments, the request is invalid.
    const lineStringSegments: string[] = lineString.split(" ");
    if (lineStringSegments.length !== 3) {
      throw new HTTPSyntaxError(
        HTTPSyntaxErrorSource.RequestLineParser,
        `Invalid HTTP request line: segment count in request line not equal to 3!`
      );
    }

    // Gets the method, uri and version strings.
    const [methodString, uriString, versionString]: [string, string, string] =
      lineStringSegments as [string, string, string];

    // Makes sure the http method and version are valid.
    if (!isValidHttpMethod(methodString)) {
      throw new HTTPSyntaxError(
        HTTPSyntaxErrorSource.RequestLineParser,
        `Invalid HTTP request line: unrecognized http method '${methodString}'`
      );
    } else if (!isValidHttpVersion(versionString)) {
      throw new HTTPVersionNotSupportedError(versionString);
    }

    // Parses the request URI.
    const parsedRequestURI: HTTPURI = HTTPURI.parse(uriString);

    // Updates the instance variables.
    this.method = methodString as HTTPMethod;
    this.uri = parsedRequestURI;
    this.rawUri = uriString;
    this.version = versionString as HTTPVersion;

    // Updates the state, and emits the event.
    this._state = HTTPRequestState.HEADERS;
    this.emit(HTTPRequestEvent.LineLoaded);

    // Returns false to continue the loop.
    return false;
  }

  /**
   * Gets called when update got called, and we need to parse header.
   * @returns true if the main loop should exit.
   */
  protected updateHeaders(): boolean {
    // Reads a single line from the internal buffer.
    const line: Buffer | undefined = this.readLine();

    // If there is no line yet, return true to break and wait for next update.
    if (!line) return true;

    // Gets the line string.
    const lineString: string = line.toString("utf-8");

    // If the line length is equal to zero, we've reached the end of the headers.
    if (lineString.length === 0) {
      // Sets the new state.
      this._state = HTTPRequestState.FINISHED;

      // Emits the event for headers done loading.
      this.emit(HTTPRequestEvent.HeadersLoaded);

      // Checks if there is an body to be expected, if not finish the request.
      if (!this.body) {
        this.emit(HTTPRequestEvent.Finished);
      }

      // Returns false to continue.
      return false;
    }

    // Parses the individual header.
    this.headers.addHeader(...HTTPRequest._parseHttpHeader(lineString));

    // Loops another time if neccesairy.
    return false;
  }

  /**
   * Updates the request body.
   * @returns true if the main loop should exit.
   */
  protected updateBody(): boolean {
    // Makes sure there is a body and a buffer.
    if (!this.body)
      throw new HTTPError("Could not update body: no body instance.");
    if (!this._buffer)
      throw new HTTPError("Could not update body: no buffer instance.");

    // Updates the body.
    const consumedBytes: number = this.body.update(this._buffer);

    // Removes the consumed bytes of the internal buffer.
    if (this._buffer.length === consumedBytes) this._buffer = undefined;
    else {
      const buffer: Buffer = Buffer.alloc(this._buffer.length - consumedBytes);
      this._buffer.copy(buffer, 0, consumedBytes);
      this._buffer = buffer;
    }

    // Updates the body, and if it returns true we know we're done loading.
    if (this.body.saturated) {
      // Updates the state variable.
      this._state = HTTPRequestState.FINISHED;

      // Emits the event indicating the finished loading.
      this.emit(HTTPRequestEvent.BodyLoaded);
      this.emit(HTTPRequestEvent.Finished);
    }

    // Always returns true since we've processed the entire contents.
    return true;
  }

  /**
   * Updates the http request by reading the memory.
   */
  private update() {
    // Stays in loop as long as we're not done processing the body.
    while (this._state !== HTTPRequestState.FINISHED) {
      let shouldBreak = false;

      // Calls the appropriate method.
      switch (this._state) {
        case HTTPRequestState.REQUEST:
          shouldBreak = this.updateRequest();
          break;
        case HTTPRequestState.HEADERS:
          shouldBreak = this.updateHeaders();
          break;
        case HTTPRequestState.BODY:
          shouldBreak = this.updateBody();
          break;
        default:
          shouldBreak = true;
          break;
      }

      if (shouldBreak) break;
    }
  }

  /**
   * Gets called to write new data to the request.
   * @param chunk the chunk of data received.
   * @param encoding the encoding of the chunk.
   * @param callback the callback to call when we can fetch new data.
   */
  public write(chunk: any): void {
    // Makes sure the chunk is a buffer.
    if (!(chunk instanceof Buffer))
      throw new HTTPError("Chunk must be a buffer instance!");

    // Concats the buffer or makes it the primary buffer.
    if (!this._buffer) this._buffer = chunk;
    else this._buffer = Buffer.concat([this._buffer, chunk]);

    // Updates the request.
    this.update();
  }

  /**
   * Loads the request body into an buffer.
   * @param expectedSize the expected size of the body to be loaded.
   */
  public loadBufferBody(expectedSize: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Makes sure there is no body being loaded yet.
      if (this.body) {
        throw new HTTPError(
          "Cannot load buffer body: request already loaded/loading other body!"
        );
      }

      // Adds an listener for when the body is loaded, which will resolve.
      this.on(HTTPRequestEvent.BodyLoaded, resolve);

      // Creates the new buffer body instance, and changes the state to body loading.
      this.body = new HTTPRequestBufferBody(expectedSize);
      this._state = HTTPRequestState.BODY;

      // Starts processing the existing data in the internal buffer.
      this.update();
    });
  }
}
