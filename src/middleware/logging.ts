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

import { HTTPPathMatch } from "../HTTPPathMatch";
import { HTTPRequest, HTTPRequestEvent } from "../HTTPRequest";
import { HTTPResponse } from "../HTTPResponse";
import { HTTPRouterCallback, HTTPRouterNextFunction } from "../HTTPRouter";

export interface ISimpleLoggerOptions {}

/**
 * Constructs a piece of middleware to log requests.
 * @param options the options for the logger.
 * @returns the middleware to perform the simple logging.
 */
export const useLogging = (options?: ISimpleLoggerOptions): HTTPRouterCallback => {
  return async (
    match: HTTPPathMatch,
    request: HTTPRequest,
    response: HTTPResponse,
  ): Promise<boolean> => {
    console.info(`${request.method} ${request.rawUri!} ${request.version}:`);
    for (const header of request.headers!.iterator()) {
      if (Array.isArray(header.value)) {
        console.info(`\t${header.key}: `);
        for (const value of header.value) console.trace(`\t\t${value}`);
      } else console.info(`\t${header.key}: ${header.value}`);
    }

    return true;
  };
};
