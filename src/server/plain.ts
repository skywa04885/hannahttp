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

import { HTTPClientSocket } from "../client-socket";
import net from "net";
import { HTTPClientHandler } from "../client-handler";
import { HTTPRouter } from "../router/base";
import { HTTPSettings } from "../settings";
import { HTTPServer } from "./base";

export class HTTPServerPlain extends HTTPServer {
  protected _server?: net.Server;

  public constructor(
    port: number,
    hostname: string,
    backlog: number,
    router: HTTPRouter,
    settings: HTTPSettings
  ) {
    super(port, hostname, backlog, router, settings);
  }

  protected _onConnection(client: net.Socket): void {
    const httpClientSocket: HTTPClientSocket = HTTPClientSocket.fromSocket(client);
    HTTPClientHandler.fromClientAndServer(httpClientSocket, this);
  }

  public start(): Promise<void> {
    return new Promise<void>((resolve, reject): void => {
      // Throws an error if the server is there.
      if (this._server) return resolve();

      // Creates the tls server.
      this._server = net.createServer();
      
      // Adds the event listeners.
      this._server.on('connection', (client: net.Socket) => this._onConnection(client));

      // Listens the server.
      this._server.listen(this.port, this.hostname, this.backlog, () =>
        resolve()
      );
    });
  }

  public stop(): Promise<void> {
    return new Promise<void>((resolve, reject): void => {
      // Throws an error if the server isn't there.
      if (!this._server) return resolve();

      // Closes the server.
      this._server.close((err?: Error) => {
        this._server = undefined;
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }
}
