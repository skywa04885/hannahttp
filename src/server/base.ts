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

import { HTTPRouter } from "../router/base";
import { HTTPSettings } from "../settings";

export class HTTPServer {
  public constructor(
    public readonly port: number,
    public readonly hostname: string,
    public readonly backlog: number,
    public readonly router: HTTPRouter,
    public readonly settings: HTTPSettings
  ) {}

  public async start(): Promise<void> {
    throw new Error("Not implemented!");
  }

  public async stop(): Promise<void> {
    throw new Error("Not implemented!");
  }

  public async restart(): Promise<void> {
    throw new Error("Not implemented!");
  }
}