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

import {
  HTTPRequest,
  HTTPRequestBufferBody,
  HTTPRequestEvent,
} from "./HTTPRequest";
import { HTTPResponse, HTTPResponseState } from "./HTTPResponse";
import { HTTPRouter } from "./HTTPRouter";
import { HTTPClientSocket } from "./HTTPClientSocket";
import { HTTPSession } from "./HTTPSession";
import { HTTPServer } from "./HTTPServer";
import { HTTPMethod } from "./HTTPMethod";

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

    // Pipes all the received data to the request.
    this.client.socket.pipe(this._request);

    // Handles the even where the request headers are loaded (enough to handle the request).
    this._request.on(HTTPRequestEvent.HeadersLoaded, () => this._onRequest());
  }

  /**
   * Gets called when a request is ready to be processed.
   * @returns a promise that resolves once the request has been handled.
   */
  protected async _onRequest(): Promise<void> {
    // Creates the response, this will be used to respond to the request.
    const response: HTTPResponse = new HTTPResponse(
      this._request,
      this._session,
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

    // Waits for the request to be handled.
    await this.server.router.handle(this._request, response);

    // Resets the request so we can receive the next one.
    this._request.reset();
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
