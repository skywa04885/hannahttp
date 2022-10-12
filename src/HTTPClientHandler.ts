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

import { HTTPRequest, HTTPRequestBufferBody, HTTPRequestEvent } from "./HTTPRequest";
import {
  HTTPResponse,
  HTTPResponseState,
} from "./HTTPResponse";
import { HTTPRouter } from "./HTTPRouter";
import { HTTPClientSocket } from "./HTTPClientSocket";

export class HTTPClientHandler {
  public _request: HTTPRequest; // The request object & parser (allows pipelining).

  public constructor(
    public readonly httpClientSocket: HTTPClientSocket,
    public readonly httpRouter: HTTPRouter
  ) {
    this._request = new HTTPRequest();

    // Registers the socket events.
    this.httpClientSocket.socket.on("data", (chunk: Buffer) =>
      this._onHttpClientSocketDataEvent(chunk)
    );
    this._request.on(HTTPRequestEvent.RequestHeadersLoaded, () =>
      this._onRequestFinishedLoadingEvent()
    );
  }

  /**
   * Gets called when a request finished the loading phase.
   */
  protected _onRequestFinishedLoadingEvent() {
    // Creates the http response.
    const response: HTTPResponse = new HTTPResponse(
      this._request.version!,
      this.httpClientSocket,
      () => this._request.reset()
    );

    // Handles the request and response in the router.
    this.httpRouter.handle(this._request, response);
  }

  /**
   * Forwards the received data from the socket to the request.
   * @param chunk the chunk of data we've received.
   */
  protected _onHttpClientSocketDataEvent(chunk: Buffer): void {
    this._request.write(chunk);
  }

  public static fromHttpClientSocket(
    httpClientSocket: HTTPClientSocket,
    httpRouter: HTTPRouter
  ): HTTPClientHandler {
    // Creates the http client handler.
    const httpClientHandler: HTTPClientHandler = new HTTPClientHandler(
      httpClientSocket,
      httpRouter
    );

    // Returns the client handler.
    return httpClientHandler;
  }
}
