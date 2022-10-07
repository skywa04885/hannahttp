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
import net from "net";
import { HTTPClientSocket } from "./HTTPClientSocket";

export enum HTTPServerSocketEvent {
  ClientConnected = "ClientConnected",
  Listening = "listening",
  Error = "error",
  Close = "close",
}

export class HTTPServerSocket extends EventEmitter {
  public constructor(public readonly server: net.Server) {
    super();
  }

  /**
   * Wraps the given socket in a http server.
   * @param server the server to wrap.
   * @returns the wrapped server.
   */
  public static fromServer(server: net.Server) {
    return new HTTPServerSocket(server);
  }

  /**
   * Listens the current server.
   * @param port the port to listen on.
   * @param hostname the hostname to listen on.
   * @param backlog the backlog.
   */
  public listen(port: number, hostname: string, backlog: number): this {
    // Registers the other listeners.
    this._registerListeners();

    // Starts listening.
    this.server.listen(port, hostname, backlog);

    // Returns the current instance.
    return this;
  }

  /**
   * Destroys the http server socket.
   * @returns the current instance.
   */
  public destroy(): this {
    // Unregisters all the listener.
    this.removeAllListeners();

    // Returns the current instance.
    return this;
  }

  /**
   * Registers all the listeners.
   */
  protected _registerListeners(): void {
    this.server.on("close", () => this._onCloseEvent());
    this.server.on("listening", () => this._onListeningEvent());
    this.server.on("connection", (clientSocket: net.Socket) =>
      this._onConnectionEvent(clientSocket)
    );
    this.server.on("error", (error: Error) => this._onError(error));
  }

  /**
   * Gets called when the server has emitted a close event.
   */
  protected _onCloseEvent(): void {
    // Emits the event.
    this.emit(HTTPServerSocketEvent.Close);
  }

  /**
   * Gets called when a new client socket has connected.
   * @param clientSocket the client socket that connected.
   */
  protected _onConnectionEvent(clientSocket: net.Socket): void {
    // Wraps the client socket in the http client socket.
    const httpClientSocket: HTTPClientSocket =
      HTTPClientSocket.fromSocket(clientSocket);

    // Emits the event with the new client socket.
    this.emit(HTTPServerSocketEvent.ClientConnected, httpClientSocket);
  }

  /**
   * Gets called when the server is listening.
   */
  protected _onListeningEvent(): void {
    // Emits the event.
    this.emit(HTTPServerSocketEvent.Listening);
  }

  /**
   * Gets called when an error has been emitted.
   * @param error the error that has been emitted.
   */
  protected _onError(error: Error): void {
    // Emits the event.
    this.emit(HTTPServerSocketEvent.Error, error);
  }
}
