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

import { request } from "http";
import { HTTPContentType } from "../HTTPContentType";
import { HTTPHeaderType } from "../HTTPHeaderType";
import { HTTPPathMatch } from "../HTTPPathMatch";
import {
  HTTPRequest,
  HTTPRequestBufferBody,
  HTTPRequestEvent,
} from "../HTTPRequest";
import { HTTPResponse } from "../HTTPResponse";
import { HTTPRouterCallback, HTTPRouterNextFunction } from "../HTTPRouter";

interface IBodyReaderOptions {}

/**
 * Constructs a middleware to read a body.
 * @param options the options for the body reader.
 * @returns the middleware to read the body into a buffer.
 */
export const bodyReader = (
  options?: IBodyReaderOptions
): HTTPRouterCallback => {
  return (
    match: HTTPPathMatch,
    request: HTTPRequest,
    response: HTTPResponse,
    next: HTTPRouterNextFunction
  ): void => {
    // Gets the content length string, if not there just call the next function/
    const contentLengthString: string | null =
      request.headers!.getSingleHeader("content-length") ?? null;
    if (contentLengthString === null) return next();

    // Gets the content length number, and if it's not valid (<= 0) go to next route.
    const contentLength: number = parseInt(contentLengthString);
    if (contentLength <= 0) return next();

    // Adds an event listener for when the state changed.
    request.once(HTTPRequestEvent.Finished, next);

    // Starts reading the body.
    request.loadBufferBody(contentLength);
  };
};

interface IJSONBodyparserOptions {}

/**
 * Constructs a middleware to parse a json body.
 * @param options the options for the json body parser.
 * @returns the middleware to parse a json body.
 */
export const jsonBodyParser = (
  options?: IJSONBodyparserOptions
): HTTPRouterCallback => {
  return (
    match: HTTPPathMatch,
    request: HTTPRequest,
    response: HTTPResponse,
    next: HTTPRouterNextFunction
  ): void => {
    // If the request body is not json, just go to the next callback.
    if (
      request.headers!.getSingleHeader(HTTPHeaderType.ContentType) !==
      HTTPContentType.ApplicationJson
    )
      return next();

    // Gets the request body and interprets it as a buffer body.
    const bufferBody: HTTPRequestBufferBody =
      request.body as HTTPRequestBufferBody;

    // Get the string version of the buffer in the request body.
    const bodyString: string = bufferBody.buffer.toString("utf-8");

    // Parses the json, and puts it in the request user data.
    const bodyObject: any = JSON.parse(bodyString);
    request.u = {};
    request.u.body = bodyObject;

    // Continues to the next route.
    next();
  };
};
