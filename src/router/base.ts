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

import { HTTPRequest } from "../http/request";
import { HTTPResponse } from "../http/response";
import { HTTPMethod } from "../http/method";
import { HTTPPathMatcher } from "./path-matcher";
import { HTTPPathMatch } from "./path-match";

export class HTTPRouter {
  /**
   * Handles the given request.
   * @param request the request to handle.
   * @param response the response for the handled request.
   * @param path the optional path for when we're dealing with vhosts.
   * @returns a promise that resolves once the request is handled.
   */
  public async handle(
    request: HTTPRequest,
    response: HTTPResponse,
    path: string | null = null
  ): Promise<void> {
    throw new Error("Not implemented!");
  }
}
