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

import { HTTPClientSocket } from "./HTTPClientSocket";
import net from "net";
import { HTTPClientHandler } from "./HTTPClientHandler";
import { HTTPRouter } from "./HTTPRouter";
import { HTTPServerSocket, HTTPServerSocketEvent } from "./HTTPServerSocket";
import { HTTPSettings } from "./HTTPSettings";

export class HTTPServer {
  public constructor(
    protected readonly _serverSocket: HTTPServerSocket,
    public readonly router: HTTPRouter,
    public readonly settings: HTTPSettings
  ) {}

  protected _onClientConnected(clientSocket: HTTPClientSocket): void {

    clientSocket.socket.on('error', (err: Error): void => {
      console.log(err);
    });
    HTTPClientHandler.fromClientAndServer(clientSocket, this);
  }
}

export class HTTPServerPlain extends HTTPServer {
  /**
   * Constructs a new plain text http server.
   * @param router the router to use.
   * @param settings the settings for the server.
   */
  public constructor(router: HTTPRouter, settings: HTTPSettings) {
    // Calls the super constructor.
    super(HTTPServerSocket.fromServer(net.createServer()), router, settings);

    // Registers the event listeners.
    this._serverSocket.on(
      HTTPServerSocketEvent.ClientConnected,
      (httpClientSocket: HTTPClientSocket) =>
        this._onClientConnected(httpClientSocket)
    );
  }

  /**
   * Destroys the current server.
   */
  public destroy() {
    // Removes the event listeners.
    this._serverSocket.removeAllListeners();

    // Destroys the socket.
    this._serverSocket.destroy();
  }

  /**
   * Listens the http server.
   * @param port the port.
   * @param hostname the hostname.
   * @param backlog the backlog.
   * @returns the current instance.
   */
  public listen(port: number, hostname: string, backlog: number): this {
    this._serverSocket.listen(port, hostname, backlog);
    return this;
  }
}
