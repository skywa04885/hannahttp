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

import { HTTPHeaderType } from "../http/header";
import { HTTPPathMatch } from "../router/path-match"
import { HTTPRequest } from "../http/request"
import { HTTPResponse } from "../http/response"
import { HTTPSimpleRouterCallback } from "../router/simple-router";

export interface IUseCookiesOptions {}

export interface IUseCookiesBody {
  cookies: {[key: string]: string};
}

/**
 * Constructs a piece of middleware to parse cookies.
 * @param options the options for the piece of middleware.
 * @returns the piece of middleware used to parse cookies.
 */
export const useCookies = (options?: IUseCookiesOptions): HTTPSimpleRouterCallback => {
  options = Object.assign({}, options);

  return async (
    match: HTTPPathMatch,
    request: HTTPRequest,
    response: HTTPResponse,
  ): Promise<boolean> => {
    // Gets the reference to the request userdata as cookies body.
    const u: IUseCookiesBody = request.u as IUseCookiesBody;
    u.cookies = {};

    // Gets the list of cookies, if null just return since there are none.
    const cookies: string[] | null = request.headers?.getHeader(HTTPHeaderType.Cookie) ?? null;
    if (cookies === null) return true;

    // Loops over all the cookies and parses them.
    for (const cookie of cookies) {
      // Processes the cookies inside the cookie, or something.... This mechanism sucks.
      cookie.split(';').forEach((pair: string): void => {
        // Cleans up the pair.
        pair.trim();

        // Splits the cookie into it's segment.
        const segments: string[] = pair.split('=');
        if (segments.length !== 2)
          throw new Error(`Segment count of cookie not equal to 2 but: ${segments.length}`);
        
        // Gets the key and the value from the segments.
        let [key, value]: [string, string] = segments as [string, string];

        // Prepares the key and the value.
        key = key.trim();
        value = decodeURIComponent(value);

        // Sets the cookie in the request body.
        u.cookies[key] = value;
      });
    }

    // Calls the next piece of middleware.
    return true;
  };
}