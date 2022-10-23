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

import { HTTPRequest, HTTPRequestEvent } from "./http/request";
import { HTTPResponse } from "./http/response";
import { HTTPClientSocket } from "./client-socket";
import { HTTPSession } from "./session";
import { HTTPServer } from "./server";
import { HTTPMethod } from "./http/method";
import {
  HTTPError,
  HTTPNetworkingError,
  HTTPSyntaxError,
  HTTPVersionNotSupportedError,
} from "./error";
import { Writable } from "stream";
import { HTTPConnectionPreference } from "./http/headers/connection";

export class HTTPClientHandler {
  protected _session: HTTPSession;
  protected _request: HTTPRequest; // The request object & parser (allows pipelining).

  /**
   * Constructs a new client handler.
   * @param client the client.
   * @param server the server.
   */
  protected constructor(
    public readonly client: HTTPClientSocket,
    public readonly server: HTTPServer
  ) {
    // Creates the session and the request.
    this._session = new HTTPSession(client, server);
    this._request = new HTTPRequest(this._session);

    // Handles all the data, however keeps in mind that we may need to wait for events
    //  hence piping it through a writable stream first.
    this.client.socket.pipe(
      new Writable({
        write: async (
          chunk: Buffer,
          _: BufferEncoding,
          callback: (error?: Error | null) => void
        ): Promise<void> => {
          // Handles the data.
          await this._onData(chunk);

          // Gets the next chunk of data.
          callback();
        },
      })
    );

    // Handles socket errors.
    this.client.socket.on("error", (error: Error) =>
      this._handleError(new HTTPNetworkingError(error.message))
    );

    // Handles the even where the request headers are loaded (enough to handle the request).
    this._request.on(HTTPRequestEvent.HeadersLoaded, () => this._onRequest());
  }

  /**
   * Gets called when there's an error to handle.
   * @param error the error to handle.
   */
  protected async _handleError(error: Error): Promise<void> {
    // Checks the type of error, and how to handle it.
    if (!(error instanceof HTTPError)) {
      this._session.shouldError(() =>
        this._session.error(
          `Unknown error occured: "${error.message}", closing transmission channel ...`
        )
      );
    } else if (error instanceof HTTPNetworkingError) {
      this._session.shouldError(() =>
        this._session.error(
          `Networking error occured: "${error.message}", closing transmission channel ...`
        )
      );
    } else if (error instanceof HTTPSyntaxError) {
      // Creates the response.
      const response: HTTPResponse = new HTTPResponse(
        this._request,
        this._session
      );

      // Sets the prefered (in this case forced) connection type to close.
      response.setConnectionPreference(HTTPConnectionPreference.Close);

      // Writes the error response.
      await response.text(
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bad Request</title>
</head>
<body>
  <h1>Bad Request</h1>
  <p>The received request was malformed and the request parser has thrown a syntax error, details bellow:</p>
  <p>
    <strong>
      Source: 
    </strong>
    &quot;${error.source}&quot;
    <br />
    <strong>
      Message: 
    </strong>
    &quot;${error.message}&quot;
  </p>
</body>
</html>`,
        400
      );
    } else if (error instanceof HTTPVersionNotSupportedError) {
      // Creates the response.
      const response: HTTPResponse = new HTTPResponse(
        this._request,
        this._session
      );

      // Sets the prefered (in this case forced) connection type to close.
      response.setConnectionPreference(HTTPConnectionPreference.Close);

      // Writes the error response.
      await response.text(
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HTTP Version Not Supported</title>
</head>
<body>
  <h1>Bad Request</h1>
  <p>The HTTP version that was used in the request is not supported by this server.</p>
  <p>
    <strong>
      Version: 
    </strong>
    &quot;${error.message}&quot;
  </p>
</body>
</html>`,
        505
      );
    } else {
      this._session.shouldError(() =>
        this._session.error(
          `General HTTP error occured: "${error.message}", closing transmission channel ...`
        )
      );
    }

    // Destroys the connection.
    this._session.client.destroy();
  }

  /**
   * Gets called when new data is available to be written.
   * @param chunk the chunk of data that got available.
   * @returns a promise that resolves once the data finished processing or error has been handled.
   */
  protected async _onData(chunk: Buffer): Promise<void> {
    try {
      this._request.write(chunk);
    } catch (error) {
      await this._handleError(error as Error);
    }
  }

  /**
   * Gets called when a request is ready to be processed.
   * @returns a promise that resolves once the request has been handled.
   */
  protected async _onRequest(): Promise<void> {
    // Creates the response, this will be used to respond to the request.
    const response: HTTPResponse = new HTTPResponse(
      this._request,
      this._session
    );

    // Modifies the response so we'll exclude the body (only if we're dealing with HEAD).
    if (this._request.method === HTTPMethod.HEAD) {
      this._session.shouldTrace(() =>
        this._session.trace(
          "_onRequest(): dealing with HEAD method, so configuring response to exclude the body."
        )
      );
      response.excludeBody();
    }

    try {
      // Waits for the request to be handled.
      await this.server.router.handle(this._request, response);

      // Goes to the next enqueued request (if there).
      this._request.next();
    } catch (error) {
      await this._handleError(error as Error);
    }
  }

  /**
   * Creates a new client handler from the given client.
   * @param client the client to create a handler for.
   * @param server the server from which the request comes.
   * @returns the client handler.
   */
  public static fromClientAndServer(
    client: HTTPClientSocket,
    server: HTTPServer
  ): HTTPClientHandler {
    // Creates the http client handler.
    const httpClientHandler: HTTPClientHandler = new HTTPClientHandler(
      client,
      server
    );

    // Returns the client handler.
    return httpClientHandler;
  }
}
