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

import { EventEmitter, Readable } from "stream";
import fs from "fs";
import net from "net";
import tls from "tls";
import { buffer } from "stream/consumers";

////////////////////////////////////////////////////
// (GLOBAL) HTTP Client Socket
////////////////////////////////////////////////////

export enum HTTPClientSocketLogLevel {
  Trace = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

export class HTTPClientSocket {

  /**
   * Constructs a new http client socket.
   * @param socket the socket to use.
   */
  public constructor(public readonly socket: net.Socket) {
  }

  /**
   * Wraps the given socket in a http client socket.
   * @param socket the socket to wrap.
   * @returns the wrapped socket.
   */
  public static fromSocket(socket: net.Socket) {
    return new HTTPClientSocket(socket);
  }

  /**
   * If the socket is tls or not.
   * @returns the boolean indicating if the socket is tls or not.
   */
  public get secure(): boolean {
    return this.socket instanceof tls.TLSSocket;
  }

  /**
   * Destroys the socket.
   * @returns the current instance.
   */
  public destroy(): this {
    this.socket.destroy();
    return this;
  }

  public trace(...items: any[]): this {
    return this.log(HTTPClientSocketLogLevel.Trace, ...items);
  }

  public log(level: HTTPClientSocketLogLevel, ...items: any[]): this {
    // Produces the line we'll print.
    const line: string = `[${this.socket.remoteFamily} ${this.socket.remoteAddress}:${this.socket.remotePort} ${level}] ${items.map((item: any): string => item.toString()).join(' ')}`

    // Prints the line.
    if (level === HTTPClientSocketLogLevel.Error) console.error(line);
    else console.log(line);

    // Returns the current instance.
    return this;
  }
}
